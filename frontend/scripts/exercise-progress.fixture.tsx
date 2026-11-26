// Keep the controlled clock, DOM globals and module mocks isolated from other tests.
import { mock, setSystemTime } from "bun:test";
import assert from "node:assert/strict";
import { Window as TestWindow } from "happy-dom";
import { act, type ComponentProps } from "react";
import type { TrendChartProps } from "@/components/charts/trend-chart";
import { buildTrendChartModel } from "@/components/charts/trend-chart-model";
import {
  ExerciseCategories_Enum,
  type ExerciseDetailQuery,
  MuscleGroups_Enum,
} from "@/gql/graphql";

setSystemTime(new Date(2026, 10, 14, 12));
const dom = new TestWindow({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
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
mock.module("@/components/storage-image", () => ({
  AlternatingStorageImage: () => null,
  StorageImage: () => null,
}));
mock.module("@/lib/graphql", () => ({
  gqlRequest: () => {
    throw new Error("Exercise progress must render the seeded query data");
  },
}));
// The chart primitive has its own fixture; record what the page asks it to draw.
const charts: TrendChartProps[] = [];
mock.module("@/components/charts/trend-chart", () => ({
  TrendChart: (props: TrendChartProps) => {
    charts.push(props);
    return <figure aria-label={props.title} />;
  },
}));

// Weekly Romanian deadlifts (Web · ExerciseDetail) plus one older session outside 90 days.
const sessions: [string, number, number[]][] = [
  ["2026-07-01", 120, [10, 10, 10]],
  ["2026-10-08", 125, [10, 9, 9]],
  ["2026-10-15", 130, [9, 8, 8]],
  ["2026-10-22", 130, [10, 8, 6]],
  ["2026-10-29", 135, [9, 8, 7]],
  ["2026-11-05", 135, [10, 9, 8]],
  ["2026-11-12", 140, [6, 7, 6]],
];
const data: ExerciseDetailQuery = {
  exercise: {
    id: "rdl",
    name: "Romanian Deadlift",
    instructions: [],
    image1FileId: null,
    image2FileId: null,
    level: null,
    category: ExerciseCategories_Enum.Strength,
    kind: "strength",
    equipment: null,
    primaryMuscleGroup: MuscleGroups_Enum.Hamstrings,
    strength: { doubleWeight: false, force: null, mechanic: null },
    cardio: null,
    secondaryMuscleGroups: [],
    workoutSessionExercises: sessions.map(([day, weight, reps], index) => ({
      id: `wse-${index}`,
      workoutSession: {
        id: `session-${index}`,
        startedAt: new Date(`${day}T07:00:00`).toISOString(),
        workout: { id: "lower-a", name: "Lower A" },
      },
      workoutSessionStrengthSets: reps.map((count, set) => ({
        id: `set-${index}-${set}`,
        setNumber: set + 1,
        reps: count,
        weight,
      })),
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
client.setQueryData(["exercises", "detail", "rdl"], data);
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);

function show(id: string) {
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <ExerciseDetail key={id} exerciseId={id} />
      </QueryClientProvider>,
    );
  });
}
function latestChart() {
  const props = charts.at(-1);
  assert(props);
  return buildTrendChartModel({ ...props, locale: "en-GB" });
}
function progress() {
  const section = container.querySelector<HTMLElement>('section[aria-label="Progress"]');
  assert(section, "Missing Progress card");
  return section;
}
function chartDates() {
  const chart = charts.at(-1);
  assert(chart, "No chart rendered");
  return chart.series.map((series) => series.points.map((point) => point.date));
}
function choosePeriod(label: string) {
  const option = [...progress().querySelectorAll("label")].find(
    (item) => item.textContent === label,
  );
  const input = option?.querySelector("input");
  assert(input, `Missing period ${label}`);
  act(() => input.click());
}

try {
  show("rdl");
  const text = progress().textContent ?? "";
  assert(text.includes("7 sessions"), text);
  // Tiles: the latest session against the one before it; declines stay neutral.
  assert(text.includes("Volume−27.0%2,660 kgweight × reps, all sets"), text);
  assert(text.includes("Est. 1RM−4.1%172.7 kgEpley"), text);
  assert(text.includes("Volume is weight × reps across all sets."));
  for (const change of progress().querySelectorAll(".text-positive")) {
    assert.fail(`Declines must not read as gains: ${change.textContent}`);
  }

  // One chart: volume on the left in Chart 1, Est. 1RM on the right in Chart 2, one point per session.
  const chart = charts.at(-1);
  assert(chart);
  assert.equal(chart.title, "Romanian Deadlift volume and estimated one-rep max");
  assert.equal(chart.period, "session");
  assert.deepEqual(
    chart.series.map(({ id, color, axis, legendLabel }) => ({ id, color, axis, legendLabel })),
    [
      { id: "volume", color: "chart-1", axis: undefined, legendLabel: "Volume (kg)" },
      { id: "e1rm", color: "chart-2", axis: "right", legendLabel: "Est. 1RM (kg)" },
    ],
  );
  // 90 days by default: the July session stays out of the chart but counts in the header.
  const checked = progress().querySelector<HTMLInputElement>('input[type="radio"]:checked');
  assert.equal(checked?.closest("label")?.textContent, "90 d");
  const ninetyDays = sessions.slice(1).map(([day]) => day);
  assert.deepEqual(chartDates(), [ninetyDays, ninetyDays]);
  assert.deepEqual(
    charts.at(-1)?.series[0]?.points.map((point) => point.value),
    [3_500, 3_250, 3_120, 3_240, 3_645, 2_660],
  );

  choosePeriod("30 d");
  const thirtyDays = ["2026-10-22", "2026-10-29", "2026-11-05", "2026-11-12"];
  assert.deepEqual(chartDates(), [thirtyDays, thirtyDays]);
  choosePeriod("1 y");
  const year = sessions.map(([day]) => day);
  assert.deepEqual(chartDates(), [year, year]);

  // History: the session's sets compactly, Est. 1RM right-aligned on every width.
  const firstRow = container.querySelector('section[aria-label="History"] tbody tr');
  assert.deepEqual(
    [...(firstRow?.querySelectorAll("td") ?? [])].map((cell) => cell.textContent),
    [
      `${new Date("2026-11-12T07:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })}Lower A`,
      "140 × 6 · 7 · 6",
      "172.7 kg",
      "2,660 kg",
    ],
  );

  const rdl = data.exercise;
  assert(rdl);
  const morning = rdl.workoutSessionExercises.at(-1);
  assert(morning);
  // Supply observations in reverse time order on the same local date.
  const evening = {
    ...morning,
    id: "evening",
    workoutSession: { ...morning.workoutSession, id: "pm", startedAt: "2026-11-12T16:00:00+01:00" },
    workoutSessionStrengthSets: [{ id: "pm-set", setNumber: 1, reps: 1, weight: 160 }],
  };
  client.setQueryData(["exercises", "detail", "two-sessions"], {
    exercise: { ...rdl, workoutSessionExercises: [evening, morning] },
  });
  show("two-sessions");
  const strength = latestChart();
  assert.deepEqual(
    strength.rows.map((row) => [row.x, row.date, row.values]),
    [
      [0, "2026-11-12", { s0: 2660, s1: 140 * (1 + 7 / 30) }],
      [1, "2026-11-12", { s0: 160, s1: 160 }],
    ],
  );
  assert.deepEqual(
    strength.rows.map((row) => row.entries.length),
    [2, 2],
  );
  assert(strength.label.includes("latest 160 kg"));

  client.setQueryData(["exercises", "detail", "run"], {
    exercise: {
      ...rdl,
      id: "run",
      name: "Treadmill Running",
      kind: "cardio",
      category: ExerciseCategories_Enum.Cardio,
      strength: null,
      cardio: {
        metricsSchema: {
          type: "object",
          additionalProperties: false,
          required: ["duration_s"],
          properties: {
            distance_km: {
              "x-label": "Distance",
              "x-unit": "km",
              "x-format": "decimal",
              "x-order": 1,
            },
            duration_s: { "x-label": "Duration", "x-format": "duration_seconds", "x-order": 2 },
            hr: {
              "x-label": "Avg Heart Rate",
              "x-unit": "bpm",
              "x-format": "average",
              "x-order": 3,
            },
          },
        },
      },
      workoutSessionExercises: [
        {
          ...evening,
          workoutSessionStrengthSets: [],
          workoutSessionCardioEntries: [
            { id: "pm1", entryNumber: 1, metrics: { distance_km: 2, duration_s: 600, hr: 140 } },
            { id: "pm2", entryNumber: 2, metrics: { duration_s: 360, hr: 155 } },
          ],
        },
        {
          ...morning,
          workoutSessionStrengthSets: [],
          workoutSessionCardioEntries: [
            { id: "am", entryNumber: 1, metrics: { distance_km: 1, duration_s: 310 } },
          ],
        },
      ],
    },
  });
  show("run");
  const cardio = latestChart();
  assert.deepEqual(
    cardio.rows.map((row) => [row.x, row.date, row.entries[0]?.value]),
    [
      [0, "2026-11-12", 1],
      [1, "2026-11-12", 2],
    ],
  );
  assert(cardio.label.includes("lowest 1 km, highest 2 km"));
  const intervals = container.querySelectorAll(
    'section[aria-label="History"] tbody tr:first-child li',
  );
  assert.deepEqual(
    [...intervals].map((row) => row.textContent),
    [
      "Entry 1Distance: 2 kmDuration: 10:00Avg Heart Rate: 140 bpm",
      "Entry 2Duration: 6:00Avg Heart Rate: 155 bpm",
    ],
  );
} finally {
  act(() => root.unmount());
  client.clear();
  setSystemTime();
  await dom.happyDOM.close();
}
console.info("Exercise progress charts volume and Est. 1RM per session for the chosen period.");
