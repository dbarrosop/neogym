// Isolate browser globals and request mocks from other tests.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSchema, type DocumentNode, execute } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ComponentProps, type ComponentType } from "react";
import {
  type ExercisesWorkoutSessionExercisesArgs,
  MuscleGroups_Enum,
  type Query_RootExercisesArgs,
  type WorkoutDetailQuery,
  type WorkoutExerciseLastSetsQuery,
} from "@/gql/graphql";

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
    params: _params,
    ...props
  }: ComponentProps<"a"> & { to: string; params: unknown }) => <a {...props} href="#exercise" />,
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
type Occurrence =
  WorkoutExerciseLastSetsQuery["exercises"][number]["workoutSessionExercises"][number] & {
    startedAt: string;
  };
function occurrence(id: string, day: number, sets: [number, number][] = []): Occurrence {
  return {
    id,
    startedAt: `2026-11-${String(day).padStart(2, "0")}T12:00:00Z`,
    workoutSessionStrengthSets: sets.map(([weight, reps], index) => ({
      id: `${id}-${index}`,
      weight,
      reps,
    })),
  };
}
const histories = new Map<string, Occurrence[]>([
  [
    "bench",
    [
      occurrence("older-heavier", 1, [[100, 1]]),
      occurrence("new-empty", 20),
      occurrence("skipped-2", 19),
      occurrence("skipped-1", 18),
      occurrence("latest-logged", 17, [
        [60, 12],
        [80, 5],
        [80, 8],
      ]),
    ],
  ],
  ["bodyweight", [occurrence("bw-logged", 16, [[0, 10]])]],
  ["never-logged", [occurrence("empty", 20)]],
  ["cardio", []],
]);
const workout: NonNullable<WorkoutDetailQuery["workout"]> = {
  id: workoutId,
  name: "Test workout",
  description: null,
  isPublic: true,
  userId: null,
  workoutLabels: [],
  workoutExercises: [...histories.keys()].map((id, position) => ({
    id: `template-${id}`,
    position,
    exercise: {
      id,
      name: id,
      kind: id === "cardio" ? "cardio" : "strength",
      strength: id === "cardio" ? null : { doubleWeight: false },
      primaryMuscleGroup: MuscleGroups_Enum.Chest,
      image1FileId: null,
      image2FileId: null,
    },
  })),
};
let historyReads = 0;
mock.module("@/lib/graphql", () => ({
  gqlRequest: async (document: DocumentNode, variables: Record<string, unknown>) => {
    const result = await execute({
      schema,
      document,
      variableValues: variables,
      rootValue: {
        workout: () => workout,
        workoutStrengthReport: () => [],
        exercises: ({ where }: Query_RootExercisesArgs) =>
          [...histories]
            .filter(([id]) => where?.id?._in?.includes(id))
            .map(([id, rows]) => ({
              id,
              workoutSessionExercises: (args: ExercisesWorkoutSessionExercisesArgs) => {
                historyReads += 1;
                // Check the actual generated request at its GraphQL resolver boundary.
                assert.deepEqual(structuredClone(args), {
                  where: { workoutSessionStrengthSets: {} },
                  order_by: [{ workoutSession: { startedAt: "desc" } }],
                  limit: 1,
                });
                return rows
                  .filter((row) => row.workoutSessionStrengthSets.length > 0)
                  .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
                  .slice(0, args.limit ?? undefined);
              },
            })),
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
async function waitForHistory() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Flush React/query notifications between polls.
    await settle();
    assert.equal(
      client.getQueryState(["workouts", "last-sets", workoutId, [...histories.keys()]])?.error ??
        null,
      null,
    );
    if (historyReads === histories.size && container.textContent?.includes("80 kg × 8")) {
      return;
    }
  }
  assert.fail(`Last top sets did not finish rendering: ${container.textContent}`);
}
try {
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Detail />
      </QueryClientProvider>,
    ),
  );
  await waitForHistory();
  assert.deepEqual(
    [...container.querySelectorAll("tbody tr")].map((row) => [
      row.querySelector("a")?.textContent?.trim(),
      row.lastElementChild?.textContent,
    ]),
    [
      ["benchChest", "80 kg × 8"],
      ["bodyweightChest", "BW × 10"],
      ["never-loggedChest", "—"],
      ["cardioChest", "Cardio"],
    ],
  );
} finally {
  await settle(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("workout last sets fixture passed");
