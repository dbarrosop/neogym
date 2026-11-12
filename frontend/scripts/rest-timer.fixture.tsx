// Run in a subprocess so browser globals and the clock stay isolated.
import { mock, setSystemTime, spyOn } from "bun:test";
import assert from "node:assert/strict";
import { Window as TestWindow } from "happy-dom";
import { act, type ReactNode, useSyncExternalStore } from "react";
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
let owner: string | null = "account-a";
const authListeners = new Set<() => void>();
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => {
    const userId = useSyncExternalStore(
      (listener) => {
        authListeners.add(listener);
        return () => authListeners.delete(listener);
      },
      () => owner,
    );
    return { user: userId ? { id: userId } : null, isAuthenticated: userId !== null };
  },
}));
// Keep the real account-bound shell and timer UI, without unrelated chrome queries.
mock.module("@/components/breadcrumbs", () => ({ Breadcrumbs: () => null }));
mock.module("@/components/shell/app-sidebar", () => ({
  AppSidebar: ({ footer }: { footer: ReactNode }) => <aside>{footer}</aside>,
}));
mock.module("@/components/shell/mobile-tab-bar", () => ({ MobileTabBar: () => null }));
mock.module("@/components/shell/public-top-bar", () => ({ PublicTopBar: () => null }));
const toasts: { title: string; description: string | null | undefined }[] = [];
mock.module("sonner", () => ({
  toast: (title: string, options?: { description?: string | null }) => {
    toasts.push({ title, description: options?.description });
  },
}));
const timeouts = new Map<number, () => void>();
let nextTimeout = 0;
const timeout = spyOn(window as Window, "setTimeout").mockImplementation((callback) => {
  assert.equal(typeof callback, "function");
  nextTimeout += 1;
  timeouts.set(nextTimeout, callback as () => void);
  return nextTimeout;
});
const clearTimeout = spyOn(window, "clearTimeout").mockImplementation((handle) => {
  timeouts.delete(handle as number);
});

const { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } =
  await import("@tanstack/react-router");
const { createRoot } = await import("react-dom/client");
const { useRestTimer } = await import("@/lib/rest-timer");
const { StartRestButton } = await import("@/components/shell/rest-timer");
const { AppFrame } = await import("@/components/shell/app-frame");
const { useAuth } = await import("@/lib/nhost/auth-provider");

function Shell() {
  const { isAuthenticated } = useAuth();
  return <AppFrame>{isAuthenticated ? <Outlet /> : <p>Signed out</p>}</AppFrame>;
}
function Today() {
  const { start, defaultSeconds } = useRestTimer();
  return (
    <main>
      <h1>Today</h1>
      <output aria-label="Default rest">{defaultSeconds}</output>
      <button type="button" onClick={() => start()}>
        Start unlinked rest
      </button>
      <button type="button" onClick={() => start({ label: "Squat · set 2 next", sessionId })}>
        Start labelled rest
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
function storedTimer(): RestTimerState & { userId: string } {
  const raw = window.localStorage.getItem(stateKey);
  assert(raw, "Missing persisted timer");
  return JSON.parse(raw) as RestTimerState & { userId: string };
}
async function switchAccount(nextOwner: string | null) {
  await settle(() => {
    owner = nextOwner;
    for (const listener of [...authListeners]) {
      listener();
    }
  });
}
async function expireTimer(endsAt: number) {
  await settle(() => {
    setSystemTime(endsAt + 1);
    const pending = [...timeouts.values()];
    timeouts.clear();
    for (const callback of pending) {
      callback();
    }
  });
}
async function goToToday() {
  await settle(() => router.navigate({ to: "/today" }));
  assert.equal(router.state.location.pathname, "/today");
}
async function startSessionRest() {
  await settle(() => router.navigate({ to: "/train/sessions/$sessionId", params: { sessionId } }));
  await settle(() => button("Rest 90 s").click());
  assert.equal(storedTimer().sessionId, sessionId);
  assert.equal(storedTimer().userId, owner);
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
async function verifyUnlinkedTimer(timer: object) {
  window.localStorage.setItem(stateKey, JSON.stringify(timer));
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
  const owned = { ...legacy, userId: owner };
  await verifyUnlinkedTimer(owned);
  await verifyUnlinkedTimer({ ...owned, sessionId: null });
  // Timers from before ownership was recorded cannot safely be attributed.
  window.localStorage.setItem(stateKey, JSON.stringify({ ...legacy, sessionId }));
  await mount("/today");
  assert.equal(timers().length, 0);
  assert.equal(window.localStorage.getItem(stateKey), null);
  for (const invalidId of [42, {}, [], ""]) {
    window.localStorage.setItem(stateKey, JSON.stringify({ ...owned, sessionId: invalidId }));
    // biome-ignore lint/performance/noAwaitInLoops: Remount to exercise each persisted invalid value.
    await mount("/today");
    assert.equal(timers().length, 0);
    assert.equal(window.localStorage.getItem(stateKey), null);
  }
  // A sign-out cancels expiry; the same owner can still restore before it ends.
  window.localStorage.setItem("neogym-rest-seconds", "60");
  await mount("/today");
  await settle(() => button("Start labelled rest").click());
  const beforeSignOut = storedTimer();
  assert(timers()[0]?.textContent?.includes("Squat · set 2 next"));
  await switchAccount(null);
  assert(container.textContent?.includes("Signed out"));
  assert.equal(timers().length, 0);
  assert.equal(timeouts.size, 0);
  await switchAccount("account-a");
  assert.deepEqual(storedTimer(), beforeSignOut);
  assert.equal(timers().length, 2);

  // Another account must not see the prior owner's timer or get its expiry toast.
  await switchAccount(null);
  await switchAccount("account-b");
  assert.equal(timers().length, 0);
  assert.equal(window.localStorage.getItem(stateKey), null);
  assert.equal(container.querySelector('[aria-label="Default rest"]')?.textContent, "60");
  await expireTimer(beforeSignOut.endsAt);
  assert.deepEqual(toasts, []);

  // Switching owners without an intermediate signed-out render also cancels memory state.
  await settle(() => button("Start labelled rest").click());
  const beforeSwitch = storedTimer();
  assert.equal(beforeSwitch.userId, "account-b");
  await switchAccount("account-a");
  assert.equal(timers().length, 0);
  assert.equal(window.localStorage.getItem(stateKey), null);
  await expireTimer(beforeSwitch.endsAt);
  assert.deepEqual(toasts, []);

  // Ownership checks must not disable normal timer completion for the current user.
  await settle(() => button("Start labelled rest").click());
  await expireTimer(storedTimer().endsAt);
  assert.equal(timers().length, 0);
  assert.deepEqual(toasts, [{ title: "Rest over", description: "Squat · set 2 next" }]);
  process.stdout.write(
    "Rest timers preserve session links and same-owner restores, and isolate account changes and expiry.\n",
  );
} finally {
  await settle(() => root.unmount());
  timeout.mockRestore();
  clearTimeout.mockRestore();
  dom.happyDOM.abort();
  dom.close();
}
