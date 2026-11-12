// Isolate the real local-day hook, controlled clock and boundary mocks from other tests.
import { mock, setSystemTime } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ReactNode } from "react";
import type { WebStrengthProgressQuery } from "@/gql/graphql";
import { localTimeZone } from "@/lib/dates";
import { addLocalDateDays, formatLocalDate, localDateToDate } from "@/lib/nutrition";

setSystemTime(new Date(2026, 2, 8, 23, 59)); // Sunday, after the US DST transition.
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
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => ({}),
    useNavigate: () => () => undefined,
  }),
  Link: ({ children }: { children: ReactNode }) => <a href="#exercise">{children}</a>,
}));
mock.module("@/components/shell/area-tabs", () => ({ AreaTabs: () => null }));
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
type Row = WebStrengthProgressQuery["strengthProgress"][number];
function row(day: string, name: string, volume: number): Row {
  const startedAt = localDateToDate(day);
  assert(startedAt);
  startedAt.setHours(12);
  return {
    exerciseId: name,
    sessionId: `${name}-${day}`,
    startedAt: startedAt.toISOString(),
    volume,
    estimatedOneRepMax: null,
    exercise: { id: name, name },
  };
}
const rows = [
  row("2026-02-26", "Expired", 100),
  row("2026-02-27", "Sunday cutoff", 200),
  row("2026-02-28", "Monday cutoff", 300),
  row("2026-03-08", "Sunday lift", 400),
  row("2026-03-09", "Monday lift", 500),
  row("2026-03-23", "Wake lift", 600),
];
type Variables = { from: string; through: string; timeZone: string };
const requests: Variables[] = [];
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode, variables: Variables) => {
    assert.equal(getOperationAST(document)?.name?.value, "WebStrengthProgress");
    requests.push(variables);
    return Promise.resolve({
      strengthProgress: rows.filter((entry) => {
        const day = formatLocalDate(new Date(entry.startedAt));
        return day >= variables.from && day <= variables.through;
      }),
    });
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Route } = await import("@/routes/_authed/progress/strength");
const Strength = Route.options.component;
assert(Strength);
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function waitForDay(day: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Flush real React Query notifications between polls.
    await settle();
    const query = client.getQueryState(["progress", "strength", day, 12, "test-user"]);
    assert.equal(query?.error ?? null, null);
    if (query?.status === "success" && container.querySelectorAll("ol > li").length === 12) {
      return;
    }
  }
  assert.fail(`Strength did not load ${day}`);
}
function assertWeek(monday: string, volume: number) {
  const date = localDateToDate(monday);
  assert(date);
  const label = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  assert.equal(
    container.querySelector("ol > li:last-child")?.getAttribute("title"),
    `Week of ${label}: ${volume} kg (so far)`,
  );
}
function assertRecent(names: string[]) {
  assert.deepEqual(
    [...container.querySelectorAll("section[aria-labelledby='recent-lifts'] strong")].map(
      (element) => element.textContent,
    ),
    names,
  );
}

try {
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Strength />
      </QueryClientProvider>,
    ),
  );
  await waitForDay("2026-03-08");
  assertWeek("2026-03-02", 400);
  assertRecent(["Monday cutoff", "Sunday cutoff", "Sunday lift"]);

  await settle(() => {
    setSystemTime(new Date(2026, 2, 9, 0, 1));
    window.dispatchEvent(new window.Event("focus"));
  });
  await waitForDay("2026-03-09");
  assertWeek("2026-03-09", 500);
  assertRecent(["Monday cutoff", "Monday lift", "Sunday lift"]);

  await settle(() => {
    setSystemTime(new Date(2026, 2, 23, 12));
    document.dispatchEvent(new window.Event("visibilitychange"));
  });
  await waitForDay("2026-03-23");
  assertWeek("2026-03-23", 600);
  assertRecent(["Wake lift"]);
  assert.deepEqual(
    requests,
    ["2026-03-08", "2026-03-09", "2026-03-23"].map((through) => ({
      from: addLocalDateDays(through, -(12 * 7 - 1)),
      through,
      timeZone: localTimeZone(),
    })),
  );
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
  setSystemTime();
}
console.info("Strength query, weekly buckets and ten-date exercise window advance together.");
