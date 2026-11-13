// Run in a subprocess so browser globals and module mocks cannot leak into other tests.
import { mock, setSystemTime } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSchema, type DocumentNode, execute } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ComponentProps, type ComponentType } from "react";
import type { Query_RootWorkoutStrengthReportArgs, WorkoutDetailQuery } from "@/gql/graphql";

setSystemTime(new Date(2026, 10, 20, 12));
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
const workoutId = "00000000-0000-4000-8000-000000000001";
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useParams: () => ({ workoutId }),
  }),
  Link: ({
    to: _to,
    params,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    params: { sessionId: string };
  }) => <a {...props} href={`/train/sessions/${params.sessionId}`} />,
}));
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
mock.module("@/lib/hooks/use-start-session", () => ({
  useStartSession: () => ({ isPending: false, mutate: () => undefined }),
}));
mock.module("@/components/storage-image", () => ({ AlternatingStorageImage: () => null }));

const schema = buildSchema(
  readFileSync(
    new URL("../../backend/schemas/schema.nhost.user.graphqls", import.meta.url),
    "utf8",
  ),
);
type Row = WorkoutDetailQuery["workoutStrengthReport"][number];
const row = (id: string, day: number, volume: number): Row => ({
  sessionId: id,
  startedAt: `2026-11-${String(day).padStart(2, "0")}T12:00:00Z`,
  volume,
});
const positiveSessions = [100, 100, 250, 500, 1000, 2000].map((volume, index) =>
  row(`strength-${index}`, index + 10, volume),
);
const zeroSessions = ["empty", "cardio", "bodyweight"].map((id, index) => row(id, index + 16, 0));
let sessions = [...positiveSessions, ...zeroSessions];
let applyServerFilter = true;
mock.module("@/lib/graphql", () => ({
  gqlRequest: async (document: DocumentNode, variables: Record<string, unknown>) => {
    const result = await execute({
      schema,
      document,
      variableValues: variables,
      rootValue: {
        workout: () => ({
          id: workoutId,
          name: "Test workout",
          description: "Keep these workout notes visible.",
          isPublic: true,
          userId: "test-user",
          workoutLabels: [],
          workoutExercises: [],
        }),
        workoutStrengthReport: ({ where, limit }: Query_RootWorkoutStrengthReportArgs) =>
          sessions
            .filter((session) =>
              applyServerFilter ? Number(session.volume) > Number(where?.volume?._gt ?? -1) : true,
            )
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .slice(0, limit ?? undefined),
      },
    });
    assert.equal(result.errors, undefined);
    return result.data;
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Route } = await import("@/routes/_authed/train/workouts/_split/$workoutId");
const Detail = Route.options.component;
assert(Detail);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  throw new Error(`Timed out waiting for workout detail: ${container.textContent}`);
}
function bars() {
  return [...container.querySelectorAll<HTMLAnchorElement>("ol li a")];
}
await settle(() =>
  root.render(
    <QueryClientProvider client={client}>
      <Detail />
    </QueryClientProvider>,
  ),
);
await waitFor(() => bars().length === 6);
assert.deepEqual(
  bars().map((bar) => bar.getAttribute("href")),
  positiveSessions.map((session) => `/train/sessions/${session.sessionId}`),
);
assert.deepEqual(
  bars().map((bar) => bar.style.height),
  ["5%", "5%", "12.5%", "25%", "50%", "100%"],
);
assert(
  bars().at(-1)?.classList.contains("bg-primary"),
  "Highlight the latest positive-volume session",
);
assert(container.textContent?.includes("Keep these workout notes visible."));

sessions = zeroSessions;
await settle(() => client.invalidateQueries({ queryKey: ["workouts", "detail"] }));
await waitFor(() => !container.querySelector("ol"));
assert(!container.textContent?.includes("Volume by session"), "No chart for strength-free history");
assert(container.textContent?.includes("Keep these workout notes visible."));

// Isolate scaling defensively with an unfiltered response: zero must never acquire a positive height.
applyServerFilter = false;
sessions = [row("zero", 1, 0), row("positive", 2, 0.5)];
await settle(() => client.invalidateQueries({ queryKey: ["workouts", "detail"] }));
await waitFor(() => bars().length === 2);
assert.deepEqual(
  bars().map((bar) => bar.style.height),
  ["0%", "100%"],
);

await settle(() => root.unmount());
client.clear();
await dom.happyDOM.abort();
setSystemTime();
console.info("workout volume fixture passed");
