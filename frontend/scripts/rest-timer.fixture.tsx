// Run in a subprocess so browser globals and the clock stay isolated.
import { setSystemTime } from "bun:test";
import assert from "node:assert/strict";
import { Window as TestWindow } from "happy-dom";
import { act } from "react";
import type { RestTimerState } from "@/lib/rest-timer";

setSystemTime(new Date(2026, 5, 1, 12));
const dom = new TestWindow({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } =
  await import("@tanstack/react-router");
const { createRoot } = await import("react-dom/client");
const { RestTimerProvider, useRestTimer } = await import("@/lib/rest-timer");
const { RestTimerCard, RestTimerPill, StartRestButton } = await import(
  "@/components/shell/rest-timer"
);

function Shell() {
  return (
    <RestTimerProvider>
      <RestTimerCard />
      <RestTimerPill />
      <Outlet />
    </RestTimerProvider>
  );
}
function Today() {
  const { start } = useRestTimer();
  return (
    <main>
      <h1>Today</h1>
      <button type="button" onClick={() => start()}>
        Start unlinked rest
      </button>
    </main>
  );
}
function Session() {
  const { sessionId } = sessionRoute.useParams();
  return (
    <main>
      <h1>Session {sessionId}</h1>
      <StartRestButton sessionId={sessionId} />
    </main>
  );
}
const rootRoute = createRootRoute({ component: Shell });
const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/today",
  component: Today,
});
const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/train/sessions/$sessionId",
  component: Session,
});
const routeTree = rootRoute.addChildren([todayRoute, sessionRoute]);
const sessionId = "origin-session";
const sessionPath = `/train/sessions/${sessionId}`;
const stateKey = "neogym-rest-timer";
function createTestRouter(path: string) {
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMinMs: 0,
  });
}
let router = createTestRouter(sessionPath);
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function mount(path: string) {
  await settle(() => root.render(null));
  router = createTestRouter(path);
  await router.load();
  await settle(() => root.render(<RouterProvider router={router} />));
}
function button(label: string, within: ParentNode = container) {
  const element = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => (item.getAttribute("aria-label") ?? item.textContent) === label,
  );
  assert(element, `Missing button: ${label}`);
  return element;
}
function timers() {
  return [...container.querySelectorAll<HTMLElement>('section[aria-label="Rest timer"]')];
}
function sessionLink(index: number) {
  const link = timers()[index]?.querySelector<HTMLAnchorElement>("a");
  assert(link, "Missing timer session link");
  assert.equal(link.getAttribute("href"), sessionPath);
  // Name from content includes the card's Rest/next-set context without an aria-label override.
  // Chromium omits the role="timer" countdown from the name, not the link's content.
  // These assertions check DOM structure, not browser-computed accessible names.
  assert.equal(link.getAttribute("aria-label"), null);
  assert.equal(link.getAttribute("aria-labelledby"), null);
  assert.equal(link.querySelector(".sr-only")?.textContent, "Open session: ");
  assert(link.querySelector('[role="timer"]'));
  if (index === 0) {
    assert.equal(link.querySelector("strong")?.textContent, "Rest");
  }
  assert.equal(link.querySelectorAll("button").length, 0, "Actions must be outside the link");
  return link;
}
function storedTimer(): RestTimerState {
  const raw = window.localStorage.getItem(stateKey);
  assert(raw, "Missing persisted timer");
  return JSON.parse(raw) as RestTimerState;
}
async function goToToday() {
  await settle(() => router.navigate({ to: "/today" }));
  assert.equal(router.state.location.pathname, "/today");
}
async function startSessionRest() {
  await settle(() => router.navigate({ to: "/train/sessions/$sessionId", params: { sessionId } }));
  await settle(() => button("Rest 90 s").click());
  assert.equal(storedTimer().sessionId, sessionId);
  await goToToday();
}
async function verifyActions(index: number) {
  const before = storedTimer();
  const section = timers()[index];
  assert(section);
  await settle(() => button("+30 s", section).click());
  assert.equal(router.state.location.pathname, "/today");
  assert.deepEqual(storedTimer(), {
    ...before,
    duration: before.duration + 30,
    endsAt: before.endsAt + 30_000,
  });
  sessionLink(index);
  await settle(() => button(index === 0 ? "Skip" : "Skip rest", section).click());
  assert.equal(router.state.location.pathname, "/today");
  assert.equal(timers().length, 0);
  assert.equal(window.localStorage.getItem(stateKey), null);
}
async function verifyLegacyTimer(legacy: object) {
  window.localStorage.setItem(stateKey, JSON.stringify(legacy));
  await mount("/today");
  assert.equal(timers().length, 2);
  assert(timers().every((section) => section.querySelector("a") === null));
  assert(timers()[0]?.textContent?.includes("Legacy rest"));
  await settle(() => button("+30 s", timers()[0]).click());
  assert.equal(storedTimer().sessionId, null);
  assert.equal(storedTimer().label, "Legacy rest");
  assert.equal(storedTimer().duration, 150);
  await settle(() => button("Skip rest", timers()[1]).click());
  assert.equal(window.localStorage.getItem(stateKey), null);
}

try {
  window.localStorage.clear();
  await mount(sessionPath);
  await startSessionRest();
  assert.equal(timers().length, 2);
  assert.equal(timers()[0]?.querySelector('[role="timer"]')?.textContent, "1:30");
  // Both the sidebar card and mobile pill navigate through the real router.
  await settle(() => sessionLink(0).click());
  assert.equal(router.state.location.pathname, sessionPath);
  await goToToday();
  await settle(() => sessionLink(1).click());
  assert.equal(router.state.location.pathname, sessionPath);
  await goToToday();
  await verifyActions(0);
  await startSessionRest();
  await verifyActions(1);

  // Reloading the provider retains the originating session and timer.
  await startSessionRest();
  const beforeReload = { ...storedTimer(), label: "Squat · set 2 next" };
  window.localStorage.setItem(stateKey, JSON.stringify(beforeReload));
  await mount("/today");
  assert.deepEqual(storedTimer(), beforeReload);
  assert(sessionLink(0).textContent?.includes(beforeReload.label));
  sessionLink(1);
  await settle(() => sessionLink(1).click());
  assert.equal(router.state.location.pathname, sessionPath);

  // A new timer without context must not inherit the previous session.
  await goToToday();
  await settle(() => button("Start unlinked rest").click());
  assert.equal(storedTimer().sessionId, null);
  assert(timers().every((section) => section.querySelector("a") === null));

  const legacy = { endsAt: Date.now() + 120_000, duration: 120, label: "Legacy rest" };
  await verifyLegacyTimer(legacy);
  await verifyLegacyTimer({ ...legacy, sessionId: null });
  for (const invalidId of [42, {}, [], ""]) {
    window.localStorage.setItem(stateKey, JSON.stringify({ ...legacy, sessionId: invalidId }));
    // biome-ignore lint/performance/noAwaitInLoops: Remount to exercise each persisted invalid value.
    await mount("/today");
    assert.equal(timers().length, 0);
    assert.equal(window.localStorage.getItem(stateKey), null);
  }
  process.stdout.write(
    "Rest timers link to their originating session, keep actions separate, and restore legacy state.\n",
  );
} finally {
  await settle(() => root.unmount());
  dom.happyDOM.abort();
  dom.close();
}
