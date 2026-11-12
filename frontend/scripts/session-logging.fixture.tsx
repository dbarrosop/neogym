// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import {
  type DocumentNode,
  type FieldNode,
  getOperationAST,
  type SelectionSetNode,
  valueFromASTUntyped,
} from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ComponentProps } from "react";
import {
  type EarlierWorkoutSessionsQuery,
  type EarlierWorkoutSessionsQueryVariables,
  type InsertWorkoutSessionCardioEntryMutationVariables,
  type InsertWorkoutSessionStrengthSetMutationVariables,
  MuscleGroups_Enum,
  type PriorSessionsPerExerciseQuery,
  type PriorSessionsPerExerciseQueryVariables,
  type SessionDetailQuery,
} from "@/gql/graphql";

const dom = new TestWindow({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  Node: window.Node,
  NodeFilter: window.NodeFilter,
  Element: window.Element,
  DocumentFragment: window.DocumentFragment,
  MutationObserver: window.MutationObserver,
  CustomEvent: window.CustomEvent,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ sessionId: "session" }),
  }),
  useNavigate: () => () => undefined,
  Link: ({ children, className }: ComponentProps<"a">) => (
    <a href="#test" className={className}>
      {children}
    </a>
  ),
}));
mock.module("@/lib/storage", () => ({ fileUrl: () => "#test-image" }));

const errors: string[] = [];
mock.module("sonner", () => ({ toast: { error: (message: string) => errors.push(message) } }));
type Session = NonNullable<SessionDetailQuery["workoutSession"]>;
type Exercise = Session["workoutSessionExercises"][number];
type HistoryRow =
  PriorSessionsPerExerciseQuery["exercises"][number]["workoutSessionExercises"][number] & {
    workoutId: string | null;
  };
type EarlierRow = EarlierWorkoutSessionsQuery["workoutSessions"][number] & { workoutId: string };
let session!: Session;
let prior: { id: string; workoutSessionExercises: HistoryRow[] }[];
let earlier: EarlierRow[];
let historyUnavailable = false;
let detailReads = 0;

function field(selection: SelectionSetNode | undefined, name: string): FieldNode {
  const node = selection?.selections.find(
    (item) => item.kind === "Field" && (item.alias?.value ?? item.name.value) === name,
  );
  assert(node?.kind === "Field", `Missing GraphQL field ${name}`);
  return node;
}
function argument<T>(node: FieldNode, name: string, variables: Record<string, unknown>): T {
  const arg = node.arguments?.find((item) => item.name.value === name);
  assert(arg, `Missing GraphQL argument ${name}`);
  return structuredClone(valueFromASTUntyped(arg.value, variables)) as T;
}
function priorResponse(document: DocumentNode, variables: Record<string, unknown>) {
  const { before, workoutId, hasWorkout, exerciseIds } =
    variables as PriorSessionsPerExerciseQueryVariables;
  assert.equal(before, session.startedAt);
  assert.equal(workoutId, session.workoutId ?? null);
  assert.equal(hasWorkout, !!session.workoutId);
  const exercises = field(getOperationAST(document)?.selectionSet, "exercises");
  assert.deepEqual(argument(exercises, "where", variables), { id: { _in: exerciseIds } });
  const history = field(exercises.selectionSet, "workoutSessionExercises");
  const sameWorkout = field(exercises.selectionSet, "sameWorkoutSessions");
  assert.deepEqual(
    sameWorkout.directives?.map((directive) => ({
      name: directive.name.value,
      args: directive.arguments?.map((arg) => valueFromASTUntyped(arg.value, variables)),
    })),
    [{ name: "include", args: [hasWorkout] }],
  );
  function select(rows: HistoryRow[], node: FieldNode, preferred: boolean) {
    // Check the real generated document at the request boundary, then emulate
    // its filtering/order/limit over an unfiltered pool (including skipped rows).
    assert.deepEqual(argument(node, "where", variables), {
      workoutSession: {
        startedAt: { _lt: before },
        ...(preferred ? { workoutId: { _eq: workoutId } } : {}),
      },
      _or: [{ workoutSessionStrengthSets: {} }, { workoutSessionCardioEntries: {} }],
    });
    assert.deepEqual(argument(node, "order_by", variables), {
      workoutSession: { startedAt: "desc" },
    });
    assert.equal(argument(node, "limit", variables), 3);
    return rows
      .filter(
        (row) =>
          row.workoutSession.startedAt < before &&
          (!preferred || row.workoutId === workoutId) &&
          (row.workoutSessionStrengthSets.length > 0 || row.workoutSessionCardioEntries.length > 0),
      )
      .sort((a, b) => b.workoutSession.startedAt.localeCompare(a.workoutSession.startedAt))
      .slice(0, 3);
  }
  return {
    exercises: prior
      .filter((item) => exerciseIds.includes(item.id))
      .map((item) => ({
        id: item.id,
        workoutSessionExercises: select(item.workoutSessionExercises, history, false),
        ...(hasWorkout
          ? { sameWorkoutSessions: select(item.workoutSessionExercises, sameWorkout, true) }
          : {}),
      })),
  };
}
function earlierResponse(document: DocumentNode, variables: Record<string, unknown>) {
  const { before, workoutId } = variables as EarlierWorkoutSessionsQueryVariables;
  const sessions = field(getOperationAST(document)?.selectionSet, "workoutSessions");
  assert.deepEqual(argument(sessions, "where", variables), {
    startedAt: { _lt: before },
    workoutId: { _eq: workoutId },
  });
  assert.deepEqual(argument(sessions, "order_by", variables), { startedAt: "desc" });
  const limit = argument<number>(sessions, "limit", variables);
  return {
    workoutSessions: earlier
      .filter((row) => row.startedAt < before && row.workoutId === workoutId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit),
  };
}
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode, variables: Record<string, unknown>) => {
    switch (getOperationAST(document)?.name?.value) {
      case "SessionDetail":
        detailReads += 1;
        return Promise.resolve({ workoutSession: structuredClone(session) });
      case "PriorSessionsPerExercise":
        return historyUnavailable
          ? Promise.reject(new Error("History unavailable"))
          : Promise.resolve(structuredClone(priorResponse(document, variables)));
      case "EarlierWorkoutSessions":
        return Promise.resolve(structuredClone(earlierResponse(document, variables)));
      case "InsertWorkoutSessionStrengthSet": {
        const { obj } = variables as InsertWorkoutSessionStrengthSetMutationVariables;
        const exercise = session.workoutSessionExercises.find(
          (item) => item.id === obj.workoutSessionExerciseId,
        );
        assert(exercise);
        assert.equal(typeof obj.setNumber, "number");
        assert.equal(typeof obj.reps, "number");
        const id = `${exercise.id}-set-${obj.setNumber}`;
        exercise.workoutSessionStrengthSets.push({
          id,
          setNumber: obj.setNumber as number,
          reps: obj.reps as number,
          weight: obj.weight,
        });
        return Promise.resolve({ insertWorkoutSessionStrengthSet: { id } });
      }
      case "InsertWorkoutSessionCardioEntry": {
        const { obj } = variables as InsertWorkoutSessionCardioEntryMutationVariables;
        const exercise = session.workoutSessionExercises.find(
          (item) => item.id === obj.workoutSessionExerciseId,
        );
        assert(exercise);
        assert.equal(typeof obj.entryNumber, "number");
        const id = `${exercise.id}-entry-${obj.entryNumber}`;
        exercise.workoutSessionCardioEntries.push({
          id,
          entryNumber: obj.entryNumber as number,
          metrics: obj.metrics,
        });
        return Promise.resolve({ insertWorkoutSessionCardioEntry: { id } });
      }
      default:
        throw new Error("Unexpected GraphQL operation");
    }
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { RestTimerProvider, useRestTimer } = await import("@/lib/rest-timer");
const { Route } = await import("@/routes/_authed/train/sessions/_split/$sessionId");
function TimerLabel() {
  const { timer } = useRestTimer();
  return (
    <output aria-label="Rest label" data-session-id={timer?.sessionId}>
      {timer?.label}
    </output>
  );
}
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: Number.POSITIVE_INFINITY },
    mutations: { gcTime: Number.POSITIVE_INFINITY },
  },
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
    if (condition()) {
      return;
    }
  }
  throw new Error(`Timed out waiting for session UI: ${document.body.textContent}`);
}
function button(label: string, within: ParentNode = container) {
  const element = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => (item.getAttribute("aria-label") ?? item.textContent) === label,
  );
  assert(element, `Missing button: ${label}`);
  return element;
}
function card(name: string) {
  const element = container.querySelector<HTMLElement>(`section[aria-label="${name}"]`);
  assert(element, `Missing expanded card: ${name}`);
  return element;
}
function collapsed(name: string) {
  const element = [
    ...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'),
  ].find((item) => item.querySelector("strong")?.textContent === name);
  assert(element, `Missing collapsed card: ${name}`);
  return element;
}
function fill(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  setter.call(input, value);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}
function exercise(name: string, position = 0, kind = "strength"): Exercise {
  return {
    id: `session-${name}`,
    position,
    exercise: {
      id: name,
      name,
      kind,
      primaryMuscleGroup: MuscleGroups_Enum.Quadriceps,
      image1FileId: null,
      image2FileId: null,
      strength: kind === "strength" ? { doubleWeight: false } : null,
      cardio:
        kind === "cardio"
          ? {
              metricsSchema: {
                type: "object",
                required: ["duration_s"],
                properties: {
                  duration_s: {
                    type: "integer",
                    minimum: 0,
                    "x-label": "Duration",
                    "x-format": "duration_seconds",
                  },
                },
              },
            }
          : null,
    },
    workoutSessionStrengthSets: [],
    workoutSessionCardioEntries: [],
  };
}
function historyRow(
  id: string,
  startedAt: string,
  count: number,
  workoutId: string | null = "workout",
  weight = 50,
  kind = "strength",
): HistoryRow {
  return {
    id,
    workoutId,
    workoutSession: { id, startedAt },
    workoutSessionStrengthSets:
      kind === "cardio"
        ? []
        : Array.from({ length: count }, (_, i) => ({
            id: `${id}-set-${i}`,
            setNumber: i + 1,
            weight,
            reps: 8,
          })),
    workoutSessionCardioEntries:
      kind === "cardio"
        ? Array.from({ length: count }, (_, i) => ({
            id: `${id}-entry-${i}`,
            entryNumber: i + 1,
            metrics: { duration_s: 60 },
          }))
        : [],
  };
}
function earlierRow(row: HistoryRow): EarlierRow {
  return {
    id: row.id,
    startedAt: row.workoutSession.startedAt,
    workoutId: row.workoutId ?? "workout",
    workoutSessionExercises: [
      {
        id: row.id,
        exercise: { id: "Squat", strength: { doubleWeight: false } },
        workoutSessionStrengthSets: row.workoutSessionStrengthSets,
      },
    ],
  };
}
async function openSession(
  exercises: Exercise[],
  references: number[] = [],
  templated = false,
  options: { history?: typeof prior; earlier?: EarlierRow[] } = {},
) {
  const Page = Route.options.component;
  assert(Page);
  await settle(() => root.render(null));
  client.clear();
  window.localStorage.clear();
  session = {
    id: "session",
    startedAt: "2026-06-01T12:00:00Z",
    workoutId: templated ? "workout" : null,
    workout: templated ? { id: "workout", name: "Workout" } : null,
    workoutSessionExercises: exercises,
  };
  prior =
    options.history ??
    exercises.map((item, index) => ({
      id: item.exercise.id,
      workoutSessionExercises:
        references[index] === undefined
          ? []
          : [
              historyRow(
                `prior-${item.id}`,
                "2026-05-30T12:00:00Z",
                references[index] ?? 0,
                templated ? "workout" : null,
                50,
                item.exercise.kind ?? "strength",
              ),
            ],
    }));
  earlier = options.earlier ?? [];
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <RestTimerProvider userId="test-user">
          <Page />
          <TimerLabel />
        </RestTimerProvider>
      </QueryClientProvider>,
    ),
  );
  await waitFor(() => client.isFetching() === 0);
  if (!historyUnavailable) {
    for (const query of client.getQueryCache().findAll()) {
      assert.equal(query.state.error, null, `Failed fixture query: ${query.queryHash}`);
    }
  }
}
async function logSet(name: string, number: number) {
  const form = card(name).querySelector<HTMLFormElement>(`form[aria-label="Log set ${number}"]`);
  assert(form);
  const weight = form.querySelector<HTMLInputElement>(
    `input[aria-label="Weight in kg for set ${number}"]`,
  );
  const reps = form.querySelector<HTMLInputElement>(`input[aria-label="Reps for set ${number}"]`);
  assert(weight && reps);
  await settle(() => {
    fill(weight, "50");
    fill(reps, "8");
    weight.focus();
  });
  const readsBefore = detailReads;
  await settle(() =>
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })),
  );
  await waitFor(() => detailReads > readsBefore && client.isFetching() === 0);
  const timer = container.querySelector('[aria-label="Rest label"]');
  assert.equal(timer?.textContent, `${name} · set ${number + 1} next`);
  assert.equal(timer?.getAttribute("data-session-id"), "session");
  return { form, weight };
}
async function logEntry(name: string, number: number) {
  await settle(() => button("Add entry", card(name)).click());
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  assert(dialog);
  assert(dialog.textContent?.includes(`Add entry ${number}`));
  const duration = dialog.querySelector<HTMLInputElement>('input[aria-label="Duration seconds"]');
  assert(duration);
  await settle(() => fill(duration, "60"));
  const readsBefore = detailReads;
  await settle(() => button("Log entry", dialog).click());
  await waitFor(
    () =>
      detailReads > readsBefore &&
      client.isFetching() === 0 &&
      !document.querySelector('[role="dialog"]'),
  );
}

try {
  // First-ever ad-hoc logging must retain the same next-set controls and focus.
  await openSession([exercise("Squat")]);
  await settle(() => button("Rest 90 s").click());
  assert.equal(
    container.querySelector('[aria-label="Rest label"]')?.getAttribute("data-session-id"),
    "session",
  );
  // Controls own their 44 px sizes, including inside the bordered stepper.
  for (const label of [
    "Decrease Weight in kg for set 1",
    "Increase Weight in kg for set 1",
    "Decrease Reps for set 1",
    "Increase Reps for set 1",
    "Collapse Squat",
    "Remove Squat from session",
  ]) {
    assert(button(label).classList.contains("size-11"), `${label} needs a 44 px target`);
  }
  assert(button("Log set").classList.contains("h-11"));
  const firstWeight = card("Squat").querySelector<HTMLInputElement>(
    'input[aria-label="Weight in kg for set 1"]',
  );
  assert(firstWeight);
  assert(firstWeight.classList.contains("h-11"));
  await settle(() => button("Increase Weight in kg for set 1").click());
  assert.equal(firstWeight.value, "2.5");
  await settle(() => button("Decrease Weight in kg for set 1").click());
  assert.equal(firstWeight.value, "0");
  for (const number of [1, 2, 3]) {
    // biome-ignore lint/performance/noAwaitInLoops: Exercise consecutive real mutations/refetches.
    const { form, weight } = await logSet("Squat", number);
    assert.equal(card("Squat").querySelector("form"), form);
    assert.equal(form.getAttribute("aria-label"), `Log set ${number + 1}`);
    assert.equal(document.activeElement, weight);
  }
  // Each row has one full-row native edit button, not a pencil-only target.
  for (const number of [1, 2]) {
    const edit = button(`Edit set ${number}`, card("Squat"));
    const row = edit.closest("tr");
    assert(row);
    assert.equal(row.querySelectorAll("button").length, 1);
    assert(row.classList.contains("relative"));
    assert(row.classList.contains("h-12"));
    assert(edit.classList.contains("absolute"));
    assert(edit.classList.contains("inset-0"));
    assert(edit.classList.contains("size-full"));
    // biome-ignore lint/performance/noAwaitInLoops: Open and dismiss each real set dialog.
    await settle(() => {
      edit.focus();
      assert.equal(document.activeElement, edit);
      edit.click();
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    assert(dialog);
    assert(dialog.textContent?.includes(`Edit set ${number}`));
    assert.equal(dialog.querySelector<HTMLInputElement>("#set-weight")?.value, "50");
    assert.equal(dialog.querySelector<HTMLInputElement>("#set-reps")?.value, "8");
    assert(button("Save", dialog));
    assert(button("Delete", dialog));
    await settle(() => button("Cancel", dialog).click());
    assert(!document.querySelector('[role="dialog"]'));
  }
  assert(card("Squat").textContent?.includes("Tap a logged set to edit or delete it."));
  await settle(() => button("Collapse Squat").click());
  assert(collapsed("Squat").querySelector('[aria-label="In progress"]'));
  assert(!collapsed("Squat").querySelector('[aria-label="Done"]'));

  // First-run templates must not jump to the next exercise after one set.
  await openSession([exercise("Squat"), exercise("Lunge", 1)], [], true);
  await logSet("Squat", 1);
  assert(card("Squat").querySelector('form[aria-label="Log set 2"]'));
  assert(collapsed("Lunge").querySelector('[aria-label="Not started"]'));
  await settle(() => {
    button("Collapse Squat").click();
    collapsed("Lunge").click();
  });
  await logSet("Lunge", 1);
  assert(card("Lunge").querySelector('form[aria-label="Log set 2"]'));
  assert(collapsed("Squat").querySelector('[aria-label="In progress"]'));

  // A real reference count still collapses the completed card and advances.
  await openSession([exercise("Squat"), exercise("Lunge", 1)], [3], true);
  await logSet("Squat", 1);
  await logSet("Squat", 2);
  assert(card("Squat").querySelector('form[aria-label="Log set 3"]'));
  await logSet("Squat", 3);
  assert(collapsed("Squat").querySelector('[aria-label="Done"]'));
  assert(card("Lunge").querySelector('form[aria-label="Log set 1"]'));

  // Empty or unavailable history cannot manufacture a one-set target.
  await openSession([exercise("Squat")], [0]);
  await logSet("Squat", 1);
  await settle(() => button("Collapse Squat").click());
  assert(collapsed("Squat").querySelector('[aria-label="In progress"]'));
  historyUnavailable = true;
  await openSession([exercise("Squat")]);
  await logSet("Squat", 1);
  assert(card("Squat").querySelector('form[aria-label="Log set 2"]'));
  historyUnavailable = false;

  // Cardio without history keeps Add entry available for consecutive intervals.
  await openSession([exercise("Intervals", 0, "cardio")]);
  await logEntry("Intervals", 1);
  assert(button("Add entry", card("Intervals")));
  await logEntry("Intervals", 2);
  await settle(() => button("Collapse Intervals").click());
  assert(collapsed("Intervals").querySelector('[aria-label="In progress"]'));

  // Historical interval counts use the same completion rule as strength.
  await openSession([exercise("Intervals", 0, "cardio"), exercise("Squat", 1)], [2]);
  await logEntry("Intervals", 1);
  assert(button("Add entry", card("Intervals")));
  await logEntry("Intervals", 2);
  assert(collapsed("Intervals").querySelector('[aria-label="Done"]'));
  assert(card("Squat").querySelector('form[aria-label="Log set 1"]'));

  // Same-workout history is independently bounded: four skipped rows and
  // three newer other-workout rows must not hide its last logged occurrence.
  const history = [
    historyRow("future", "2026-06-02T12:00:00Z", 4, "workout", 100),
    historyRow("same-time", "2026-06-01T12:00:00Z", 4, "workout", 110),
    ...[31, 30, 29, 28].map((day) => historyRow(`skipped-${day}`, `2026-05-${day}T12:00:00Z`, 0)),
    ...[27, 26, 25].map((day) =>
      historyRow(`other-${day}`, `2026-05-${day}T12:00:00Z`, 4, "other-workout", 90),
    ),
    historyRow("same-workout", "2026-05-20T12:00:00Z", 3, "workout", 60),
  ];
  const historyOptions = {
    history: [{ id: "Squat", workoutSessionExercises: history }],
    earlier: history.map(earlierRow),
  };
  await openSession([exercise("Squat"), exercise("Lunge", 1)], [], true, historyOptions);
  assert.equal(
    card("Squat").querySelector<HTMLInputElement>('input[aria-label="Weight in kg for set 1"]')
      ?.value,
    "60",
  );
  assert(card("Squat").textContent?.includes("Last time 60 × 8"));
  const earlierSection = container.querySelector('section[aria-label="Earlier Workout sessions"]');
  assert(earlierSection);
  assert.equal(earlierSection.querySelectorAll("li").length, 5);
  assert(!earlierSection.textContent?.includes("4 sets"));
  assert(earlierSection.textContent?.includes("3 sets"));
  await logSet("Squat", 1);
  assert(card("Squat").querySelector("tbody tr")?.textContent?.includes("60 × 8"));
  assert(card("Squat").querySelector('form[aria-label="Log set 2"]'));
  await logSet("Squat", 2);
  await logSet("Squat", 3);
  assert(collapsed("Squat").querySelector('[aria-label="Done"]'));
  assert(card("Lunge").querySelector('form[aria-label="Log set 1"]'));

  // A completed old session must not become incomplete against a later one.
  const completed = exercise("Squat");
  completed.workoutSessionStrengthSets = historyRow(
    "logged",
    session.startedAt,
    3,
  ).workoutSessionStrengthSets;
  await openSession([completed, exercise("Lunge", 1)], [], true, historyOptions);
  assert(collapsed("Squat").querySelector('[aria-label="Done"]'));
  assert(card("Lunge"));

  // With no logged same-workout history, fall back to earlier exercise history.
  const fallbackOptions = {
    history: [
      {
        id: "Squat",
        workoutSessionExercises: history.filter((row) => row.id !== "same-workout"),
      },
    ],
  };
  await openSession([exercise("Lunge"), exercise("Squat", 1)], [], true, fallbackOptions);
  assert(collapsed("Squat").textContent?.includes("Last time 90 kg × 8 · 8 · 8 · 8"));
  await settle(() => collapsed("Squat").click());
  assert(card("Squat").textContent?.includes("Last time 90 × 8"));

  // Ad-hoc sessions use the newest earlier logged exercise occurrence, not a workout preference.
  await openSession([exercise("Squat")], [], false, historyOptions);
  assert.equal(
    card("Squat").querySelector<HTMLInputElement>('input[aria-label="Weight in kg for set 1"]')
      ?.value,
    "90",
  );

  // Date/link changes must re-key both history queries even while the old key is fresh.
  await openSession([exercise("Squat")], [], true, historyOptions);
  session.startedAt = "2026-06-03T12:00:00Z";
  await settle(() =>
    client.setQueryData(["sessions", "detail", "session"], {
      workoutSession: structuredClone(session),
    }),
  );
  await waitFor(
    () =>
      card("Squat").querySelector<HTMLInputElement>('input[aria-label="Weight in kg for set 1"]')
        ?.value === "100" &&
      !!container
        .querySelector('section[aria-label="Earlier Workout sessions"]')
        ?.textContent?.includes("4 sets"),
  );
  session.workoutId = "other-workout";
  session.workout = { id: "other-workout", name: "Other workout" };
  await settle(() =>
    client.setQueryData(["sessions", "detail", "session"], {
      workoutSession: structuredClone(session),
    }),
  );
  await waitFor(
    () =>
      card("Squat").querySelector<HTMLInputElement>('input[aria-label="Weight in kg for set 1"]')
        ?.value === "90",
  );

  // A template whose catalog row is no longer visible still has a workout link.
  await openSession([exercise("Squat")], [], true, historyOptions);
  session.workout = null;
  await settle(() =>
    client.setQueryData(["sessions", "detail", "session"], {
      workoutSession: structuredClone(session),
    }),
  );
  assert.equal(
    card("Squat").querySelector<HTMLInputElement>('input[aria-label="Weight in kg for set 1"]')
      ?.value,
    "60",
  );

  // Cardio uses the identical earlier/nonempty/same-workout reference-count rule.
  await openSession([exercise("Intervals", 0, "cardio"), exercise("Squat", 1)], [], true, {
    history: [
      {
        id: "Intervals",
        workoutSessionExercises: [
          historyRow("future", "2026-06-02T12:00:00Z", 4, "workout", 0, "cardio"),
          historyRow("skipped", "2026-05-31T12:00:00Z", 0, "workout", 0, "cardio"),
          historyRow("other", "2026-05-30T12:00:00Z", 4, "other-workout", 0, "cardio"),
          historyRow("same-workout", "2026-05-20T12:00:00Z", 2, "workout", 0, "cardio"),
        ],
      },
    ],
  });
  await logEntry("Intervals", 1);
  assert(button("Add entry", card("Intervals")));
  await logEntry("Intervals", 2);
  assert(collapsed("Intervals").querySelector('[aria-label="Done"]'));
  assert(card("Squat"));
  assert.deepEqual(errors, []);
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info(
  "Session logging handles missing history and uses earlier logged same-workout references.",
);
