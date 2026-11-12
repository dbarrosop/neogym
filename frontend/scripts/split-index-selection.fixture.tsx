// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, useEffect } from "react";
import type { JournalEntriesQuery, SessionsIndexQuery, WorkoutsIndexQuery } from "@/gql/graphql";

const dom = new TestWindow({ url: "http://localhost", width: 1280 });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const selections: { to: string; id: string; replace: boolean }[] = [];
const search = { labels: ["selected-label"], visibility: "mine" };
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  getRouteApi: () => ({ useSearch: () => search }),
  Navigate: ({
    to,
    params,
    replace,
  }: {
    to: string;
    params: Record<string, string>;
    replace: boolean;
  }) => {
    const id = params["id"] ?? params["sessionId"] ?? params["workoutId"];
    assert(id);
    useEffect(() => {
      selections.push({ to, id, replace });
    }, [to, id, replace]);
    return null;
  },
}));
let pending = Promise.withResolvers<unknown>();
let requests = 0;
let expectedOperation = "";
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode) => {
    assert.equal(getOperationAST(document)?.name?.value, expectedOperation);
    requests += 1;
    return pending.promise;
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider, onlineManager } = await import("@tanstack/react-query");
const { Route: journal } = await import("@/routes/_authed/me/journal/_split/index");
const { Route: sessions } = await import("@/routes/_authed/train/sessions/_split/index");
const { Route: workouts } = await import("@/routes/_authed/train/workouts/_split/index");
const cases = [
  {
    route: journal,
    to: "/me/journal/$id",
    key: ["journal_entries", "index", search.labels],
    operation: "JournalEntries",
    dataFor: (ids: string[]) => ({
      pages: [
        {
          journalEntries: ids.map((id) => ({
            id,
            entryDate: "2026-06-01",
            title: id,
            body: "Notes",
            journalEntryLabels: [],
          })),
        } satisfies JournalEntriesQuery,
      ],
      pageParams: [0],
    }),
  },
  {
    route: sessions,
    to: "/train/sessions/$sessionId",
    key: ["sessions", "index"],
    operation: "SessionsIndex",
    dataFor: (ids: string[]) => ({
      pages: [
        {
          workoutSessions: ids.map((id) => ({
            id,
            startedAt: "2026-06-01T12:00:00Z",
            workout: null,
            workoutSessionExercises_aggregate: { aggregate: { count: 0 } },
            workoutSessionExercises: [],
          })),
        } satisfies SessionsIndexQuery,
      ],
      pageParams: [0],
    }),
  },
  {
    route: workouts,
    to: "/train/workouts/$workoutId",
    key: ["workouts", "index"],
    operation: "WorkoutsIndex",
    dataFor: (ids: string[]) =>
      ({
        workouts: ["filtered-out", ...ids].map((id) => ({
          id,
          name: id,
          description: null,
          isPublic: id === "filtered-out",
          workoutExercises_aggregate: { aggregate: { count: 0 } },
          workoutLabels: [
            { labelId: "selected-label", label: { id: "selected-label", name: "Focus" } },
          ],
        })),
        labels: [],
      }) satisfies WorkoutsIndexQuery,
  },
];
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Flush React/query notifications between polls.
    await settle();
    if (condition()) {
      return;
    }
  }
  throw new Error("Timed out waiting for split index query");
}
async function verifyPane(testCase: (typeof cases)[number]) {
  const Pane = testCase.route.options.component;
  assert(Pane);
  expectedOperation = testCase.operation;
  const staleTime = 30_000;
  const client = new QueryClient({
    defaultOptions: {
      // Match the production freshness window; refetch failures must not redirect.
      queries: { staleTime, refetchOnWindowFocus: false, retry: false },
    },
  });
  const mount = () =>
    settle(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Pane />
        </QueryClientProvider>,
      ),
    );
  const unmount = () => settle(() => root.render(null));
  const seed = (ids: string[], updatedAt = Date.now()) => {
    client.setQueryData(testCase.key, testCase.dataFor(ids), { updatedAt });
    selections.length = 0;
    pending = Promise.withResolvers<unknown>();
  };
  const respond = (ids: string[]) => {
    const data = testCase.dataFor(ids);
    // Infinite query caches wrap pages, but gqlRequest returns one GraphQL page.
    return settle(() => pending.resolve("pages" in data ? data.pages[0] : data));
  };
  const invalidate = () => client.invalidateQueries({ queryKey: [testCase.key[0]] });
  const assertSelected = (id: string) => {
    assert.deepEqual(selections, [{ to: testCase.to, id, replace: true }]);
  };

  // A fresh cache still opens instantly, without an extra request.
  const beforeFresh = requests;
  seed(["first", "next"]);
  await mount();
  assertSelected("first");
  assert.equal(requests, beforeFresh);
  await unmount();

  // Journal/workout edit pages leave the list inactive when deletion invalidates it.
  seed(["deleted", "next"]);
  await invalidate();
  const beforeRefetch = requests;
  await mount();
  await waitFor(() => requests > beforeRefetch);
  assert.equal(client.getQueryState(testCase.key)?.fetchStatus, "fetching");
  assert.deepEqual(selections, [], "Never select the deleted row during refetch");
  await respond(["next"]);
  await waitFor(() => selections.length > 0);
  assertSelected("next");
  await unmount();

  // Failure leaves the old cache stale: it must not enable the redirect again.
  seed(["deleted", "next"]);
  await invalidate();
  await mount();
  await settle(() => pending.reject(new Error("Refetch failed")));
  await waitFor(() => client.getQueryState(testCase.key)?.status === "error");
  assert.deepEqual(selections, [], "Failed revalidation must not reopen deleted data");
  pending = Promise.withResolvers<unknown>();
  await settle(() => {
    void invalidate();
  });
  await respond(["next"]);
  await waitFor(() => selections.length > 0);
  assertSelected("next");
  await unmount();

  // Deleting the last matching item renders the existing empty detail state.
  seed(["deleted"]);
  await invalidate();
  await mount();
  assert.equal(container.textContent, "");
  await respond([]);
  await waitFor(() => container.textContent?.includes("Nothing selected") === true);
  assert.deepEqual(selections, []);
  await unmount();

  // A paused offline refetch is not proof that cached rows still exist either.
  seed(["deleted"]);
  await invalidate();
  onlineManager.setOnline(false);
  const beforePaused = requests;
  await mount();
  assert.equal(client.getQueryState(testCase.key)?.fetchStatus, "paused");
  assert.equal(requests, beforePaused);
  assert.deepEqual(selections, []);
  await settle(() => onlineManager.setOnline(true));
  await waitFor(() => requests > beforePaused);
  await respond([]);
  await waitFor(() => container.textContent?.includes("Nothing selected") === true);
  await unmount();

  // Below 1100 px only the list shows; an active list refetch also blocks selection
  // if the viewport widens before the response arrives (as with session deletion).
  dom.happyDOM.setViewport({ width: 1099 });
  seed(["deleted", "next"]);
  await mount();
  assert.deepEqual(selections, []);
  await settle(() => {
    void invalidate();
  });
  await settle(() => dom.happyDOM.setViewport({ width: 1100 }));
  assert.deepEqual(selections, []);
  await respond(["next"]);
  await waitFor(() => selections.length > 0);
  assertSelected("next");
  await unmount();

  // Aging alone does not refetch idle data, so the empty state must stay visible.
  dom.happyDOM.setViewport({ width: 1280 });
  const beforeIdle = requests;
  seed([], Date.now() - staleTime + 500);
  await mount();
  const query = client.getQueryCache().find({ queryKey: testCase.key });
  assert(query);
  assert.equal(query.isStale(), false);
  assert(container.textContent?.includes("Nothing selected"));
  await waitFor(() => query.isStale());
  assert.equal(query.state.fetchStatus, "idle");
  assert(container.textContent?.includes("Nothing selected"));
  assert.deepEqual(selections, []);
  assert.equal(requests, beforeIdle);
  await unmount();

  // Widening after staleTime still selects the first row without an extra request.
  dom.happyDOM.setViewport({ width: 1099 });
  seed(["first", "next"], Date.now() - staleTime + 500);
  await mount();
  assert.equal(query.isStale(), false);
  assert.deepEqual(selections, []);
  await waitFor(() => query.isStale());
  assert.equal(query.state.fetchStatus, "idle");
  await settle(() => dom.happyDOM.setViewport({ width: 1100 }));
  assertSelected("first");
  assert.equal(requests, beforeIdle);
  await unmount();
  client.clear();
}

try {
  for (const testCase of cases) {
    // biome-ignore lint/performance/noAwaitInLoops: Each pane uses isolated cache state and DOM.
    await verifyPane(testCase);
  }
  console.info(
    "Split indexes block unconfirmed rows, survive failed/paused refetches, and preserve idle-stale empty/widening states.",
  );
} finally {
  onlineManager.setOnline(true);
  await settle(() => root.unmount());
  dom.happyDOM.abort();
}
