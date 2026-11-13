// Keep DOM globals and request-boundary mocks isolated from other tests.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST, valueFromASTUntyped } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ComponentProps } from "react";
import {
  ExerciseCategories_Enum,
  type ExercisesIndexQuery,
  MuscleGroups_Enum,
  type RecentlyLoggedExercisesQuery,
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
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => ({}),
    useNavigate: () => () => undefined,
  }),
  Link: ({ children, className }: ComponentProps<"a">) => (
    <a href="#exercise" className={className}>
      {children}
    </a>
  ),
}));
mock.module("@/components/shell/area-tabs", () => ({ AreaTabs: () => null }));

const exercises: ExercisesIndexQuery["exercises"] = [
  ["strength", "Bench press"],
  ["cardio", "Treadmill"],
  ["skipped", "Skipped exercise"],
  ["earlier", "Previously logged exercise"],
].map(([id, name]) => ({
  id,
  name: name as string,
  category: id === "cardio" ? ExerciseCategories_Enum.Cardio : ExerciseCategories_Enum.Strength,
  primaryMuscleGroup: MuscleGroups_Enum.Chest,
  isPublic: true,
  secondaryMuscleGroups: [],
}));
type HistoryRow = RecentlyLoggedExercisesQuery["workoutSessionExercises"][number] & {
  strengthSets: number;
  cardioEntries: number;
};
function history(
  id: string,
  exerciseId: string,
  day: string,
  strengthSets = 0,
  cardioEntries = 0,
): HistoryRow {
  return {
    id,
    exerciseId,
    workoutSession: { id: `session-${day}`, startedAt: `${day}T12:00:00Z` },
    strengthSets,
    cardioEntries,
  };
}
// A newly started template can exhaust the row budget with skipped exercises.
let rows = [
  ...Array.from({ length: 81 }, (_, index) =>
    history(`empty-${index}`, index % 2 === 0 ? "skipped" : "earlier", "2026-03-04"),
  ),
  history("strength-new", "strength", "2026-03-03", 1),
  history("cardio", "cardio", "2026-03-02", 0, 1),
  history("earlier", "earlier", "2026-03-01", 1),
  history("strength-old", "strength", "2026-02-28", 1),
];
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode) => {
    const operation = getOperationAST(document);
    if (operation?.name?.value === "ExercisesIndex") {
      return Promise.resolve({ exercises });
    }
    assert.equal(operation?.name?.value, "RecentlyLoggedExercises");
    const field = operation?.selectionSet.selections[0];
    assert(field?.kind === "Field");
    assert.equal(field.name.value, "workoutSessionExercises");
    const args = Object.fromEntries(
      (field.arguments ?? []).map((argument) => [
        argument.name.value,
        structuredClone(valueFromASTUntyped(argument.value)),
      ]),
    );
    // Assert the actual generated request, not a separately copied query. The
    // existence predicates must run on the server before ordering and limiting.
    assert.deepEqual(args, {
      where: { _or: [{ workoutSessionStrengthSets: {} }, { workoutSessionCardioEntries: {} }] },
      order_by: { workoutSession: { startedAt: "desc" } },
      limit: 80,
    });
    return Promise.resolve({
      workoutSessionExercises: rows
        .filter((row) => row.strengthSets > 0 || row.cardioEntries > 0)
        .sort((a, b) => b.workoutSession.startedAt.localeCompare(a.workoutSession.startedAt))
        .slice(0, args["limit"])
        .map(({ strengthSets: _strengthSets, cardioEntries: _cardioEntries, ...row }) => row),
    });
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Route } = await import("@/routes/_authed/train/exercises/index");
const Exercises = Route.options.component;
assert(Exercises);
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
async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Flush React/query notifications between polls.
    await settle();
    for (const key of ["index", "recent"]) {
      assert.equal(client.getQueryState(["exercises", key])?.error ?? null, null);
    }
    if (condition()) {
      return;
    }
  }
  assert.fail("Exercises did not finish rendering");
}
function label(day: string) {
  return `last ${new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}`;
}

try {
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Exercises />
      </QueryClientProvider>,
    ),
  );
  await waitFor(() => !!container.querySelector('section[aria-label="Recently logged"]'));
  const recent = container.querySelector('section[aria-label="Recently logged"]');
  assert(recent);
  assert.deepEqual(
    [...recent.querySelectorAll("li a")].map((link) => link.textContent),
    [
      `Bench pressChest · ${label("2026-03-03")}`,
      `TreadmillChest · ${label("2026-03-02")}`,
      `Previously logged exerciseChest · ${label("2026-03-01")}`,
    ],
  );
  const skipped = [...container.querySelectorAll("li a")].find((link) =>
    link.textContent?.includes("Skipped exercise"),
  );
  assert(skipped, "Skipped exercises must remain in the catalog");
  assert(!skipped.textContent?.includes("last "), "Skipped exercises have no last-logged label");

  rows = rows.filter((row) => row.strengthSets === 0 && row.cardioEntries === 0);
  await settle(() => client.invalidateQueries({ queryKey: ["exercises", "recent"] }));
  await waitFor(() => !container.querySelector('section[aria-label="Recently logged"]'));
  assert(!container.textContent?.includes("last "), "Empty history has no last-logged labels");
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("Exercise recency includes logged strength/cardio only, before the row limit.");
