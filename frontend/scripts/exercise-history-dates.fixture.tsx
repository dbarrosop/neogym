// Keep the controlled clock, DOM globals and request mocks isolated from other tests.
import { mock, setSystemTime } from "bun:test";
import assert from "node:assert/strict";
import { Window as TestWindow } from "happy-dom";
import { act, type ComponentProps } from "react";
import {
  ExerciseCategories_Enum,
  type ExerciseDetailQuery,
  MuscleGroups_Enum,
} from "@/gql/graphql";

setSystemTime(new Date(2026, 0, 2, 12));
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
  Link: ({ children, className }: ComponentProps<"a">) => (
    <a href="#session" className={className}>
      {children}
    </a>
  ),
}));
mock.module("@/lib/hooks/use-start-session", () => ({
  useStartSession: () => ({ isPending: false, mutate: () => undefined }),
}));
mock.module("@/components/storage-image", () => ({ AlternatingStorageImage: () => null }));
mock.module("@/lib/graphql", () => ({
  gqlRequest: () => {
    throw new Error("Exercise history must render the seeded query data");
  },
}));

const cases = [
  { date: new Date(2026, 10, 13, 12), year: undefined },
  { date: new Date(2026, 0, 1, 12), year: undefined },
  // This is already January 2026 in UTC, but still December 2025 locally.
  { date: new Date(2025, 11, 31, 23, 30), year: "numeric" },
  { date: new Date(2025, 10, 13, 12), year: "numeric" },
  // The same weekday/day/month as 13 Nov 2026, six years earlier.
  { date: new Date(2020, 10, 13, 12), year: "numeric" },
] satisfies { date: Date; year: "numeric" | undefined }[];
const data: ExerciseDetailQuery = {
  exercise: {
    id: "bench",
    name: "Bench press",
    instructions: [],
    image1FileId: null,
    image2FileId: null,
    level: null,
    category: ExerciseCategories_Enum.Strength,
    kind: "strength",
    equipment: null,
    primaryMuscleGroup: MuscleGroups_Enum.Chest,
    strength: { doubleWeight: false, force: null, mechanic: null },
    cardio: null,
    secondaryMuscleGroups: [],
    workoutSessionExercises: cases.map(({ date }, index) => ({
      id: `wse-${index}`,
      workoutSession: { id: `session-${index}`, startedAt: date.toISOString(), workout: null },
      workoutSessionStrengthSets: [],
      workoutSessionCardioEntries: [],
    })),
  },
};
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { ExerciseDetail } = await import("@/components/exercise-detail");
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
});
client.setQueryData(["exercises", "detail", "bench"], data);
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);

try {
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <ExerciseDetail exerciseId="bench" />
      </QueryClientProvider>,
    );
  });
  const links = container.querySelectorAll('section[aria-label="History"] tbody td:first-child a');
  assert.equal(links.length, cases.length);
  for (const [index, { date, year }] of cases.entries()) {
    const expected = date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year,
    });
    assert.equal(links[index]?.textContent, `${expected}Bench press`);
  }
} finally {
  act(() => root.unmount());
  client.clear();
  setSystemTime();
  await dom.happyDOM.close();
}
console.info(
  "Strength history shows other years and keeps current-year dates compact in local time.",
);
