// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ComponentProps } from "react";
import {
  type InsertWorkoutSessionCardioEntryMutationVariables,
  type InsertWorkoutSessionStrengthSetMutationVariables,
  MuscleGroups_Enum,
  type PriorSessionsPerExerciseQuery,
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
let session: Session;
let prior: PriorSessionsPerExerciseQuery;
let historyUnavailable = false;
let detailReads = 0;
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode, variables: Record<string, unknown>) => {
    switch (getOperationAST(document)?.name?.value) {
      case "SessionDetail":
        detailReads += 1;
        return Promise.resolve({ workoutSession: structuredClone(session) });
      case "PriorSessionsPerExercise":
        return historyUnavailable
          ? Promise.reject(new Error("History unavailable"))
          : Promise.resolve(structuredClone(prior));
      case "EarlierWorkoutSessions":
        return Promise.resolve({ workoutSessions: [] });
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
  return <output aria-label="Rest label">{timer?.label}</output>;
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
async function openSession(exercises: Exercise[], references: number[] = [], templated = false) {
  const Page = Route.options.component;
  assert(Page);
  await settle(() => root.render(null));
  client.clear();
  window.localStorage.clear();
  session = {
    id: "session",
    startedAt: "2026-06-01T12:00:00Z",
    workout: templated ? { id: "workout", name: "Workout" } : null,
    workoutSessionExercises: exercises,
  };
  prior = {
    exercises: exercises.map((item, index) => ({
      id: item.exercise.id,
      workoutSessionExercises:
        references[index] === undefined
          ? []
          : [
              {
                id: `prior-${item.id}`,
                workoutSession: { id: "previous", startedAt: "2026-05-30T12:00:00Z" },
                workoutSessionStrengthSets:
                  item.exercise.kind === "cardio"
                    ? []
                    : Array.from({ length: references[index] ?? 0 }, (_, i) => ({
                        id: `prior-set-${i}`,
                        setNumber: i + 1,
                        weight: 50,
                        reps: 8,
                      })),
                workoutSessionCardioEntries:
                  item.exercise.kind === "cardio"
                    ? Array.from({ length: references[index] ?? 0 }, (_, i) => ({
                        id: `prior-entry-${i}`,
                        entryNumber: i + 1,
                        metrics: { duration_s: 60 },
                      }))
                    : [],
              },
            ],
    })),
  };
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <RestTimerProvider>
          <Page />
          <TimerLabel />
        </RestTimerProvider>
      </QueryClientProvider>,
    ),
  );
  await waitFor(() => client.isFetching() === 0);
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
  assert.equal(
    container.querySelector('[aria-label="Rest label"]')?.textContent,
    `${name} · set ${number + 1} next`,
  );
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
  for (const number of [1, 2, 3]) {
    // biome-ignore lint/performance/noAwaitInLoops: Exercise consecutive real mutations/refetches.
    const { form, weight } = await logSet("Squat", number);
    assert.equal(card("Squat").querySelector("form"), form);
    assert.equal(form.getAttribute("aria-label"), `Log set ${number + 1}`);
    assert.equal(document.activeElement, weight);
  }
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
  assert.deepEqual(errors, []);
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("Session logging stays open without history and advances only at a reference count.");
