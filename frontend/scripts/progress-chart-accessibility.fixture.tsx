// Run separately so DOM globals and boundary mocks cannot leak into other tests.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { Window as TestWindow } from "happy-dom";
import { act, type ReactNode } from "react";
import { todayLocalISO } from "@/lib/dates";
import { addLocalDateDays, localDateToDate } from "@/lib/nutrition";

const dom = new TestWindow({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  ResizeObserver: window.ResizeObserver,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
const today = todayLocalISO();
const middle = addLocalDateDays(today, -1);
const start = addLocalDateDays(today, -2);
const stamp = (day: string) => {
  const date = localDateToDate(day);
  assert(date);
  return date.getTime();
};

mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => ({}),
    useNavigate: () => () => undefined,
  }),
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));
mock.module("@/components/shell/area-tabs", () => ({ AreaTabs: () => null }));
mock.module("@/components/progress/quick-entry-forms", () => ({
  QuickBodyMeasurementForm: () => null,
  QuickDailyEnergyForm: () => null,
}));
mock.module("@/components/today-energy-estimate", () => ({ TodayEnergyEstimate: () => null }));
// Body's photo card reads its own count; it isn't a chart (see progress-photos.fixture.tsx).
mock.module("@/components/progress-photos/photo-summary-card", () => ({
  PhotoSummaryCard: () => null,
}));
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
mock.module("@/lib/use-local-today", () => ({ useLocalToday: () => today }));
mock.module("@/lib/graphql", () => ({
  gqlRequest: () => {
    throw new Error("Chart labels must use the plotted query data without extra requests");
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { ResponsiveContainer } = await import("recharts");
const { Route: Muscles } = await import("@/routes/_authed/progress/muscles");
const { Route: Strength } = await import("@/routes/_authed/progress/strength");
const { Route: Overview } = await import("@/routes/_authed/progress/overview");
const { formatChartDate, metricFormat } = await import("@/lib/metric-format");
const { weekStartOf, weeklyVolumeLabel } = await import("@/lib/strength-progress");
const { chartWindow } = await import("@/lib/rolling-average");
const { calorieHistoryQueryKey } = await import("@/lib/hooks/use-calorie-history");
const { Route: Body } = await import("@/routes/_authed/progress/body/index");
const { Route: Energy } = await import("@/routes/_authed/progress/energy/index");
const { bodyMeasurementsQueryKey } = await import("@/lib/hooks/use-body-measurements");
const { dailyEnergyListQueryKey, dailyEnergyRangeQueryKey } = await import(
  "@/lib/hooks/use-daily-energy"
);
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
});
// Muscles and Strength (and Overview) read their default 8-week periods.
client.setQueryData(["progress", "muscles", today, 56, "test-user"], {
  muscleSetProgress: [
    {
      day: start,
      muscleGroup: "chest",
      rollingDirectSets: 8,
      rollingIndirectSets: 0,
      rollingWeightedSets: 8,
    },
    {
      day: today,
      muscleGroup: "chest",
      rollingDirectSets: 12,
      rollingIndirectSets: 1,
      rollingWeightedSets: 12.5,
    },
  ],
});
client.setQueryData(["progress", "strength", today, 8, "test-user"], {
  strengthProgress: [
    ...[92.5, 100, null].map((estimatedOneRepMax, index) => ({
      exerciseId: "bench",
      sessionId: `bench-${index}`,
      startedAt: new Date(stamp([start, middle, today][index] ?? today)).toISOString(),
      volume: 500,
      estimatedOneRepMax,
      exercise: { id: "bench", name: "Bench Press" },
    })),
    ...[0, 100].map((volume, index) => ({
      exerciseId: "row",
      sessionId: `row-${index}`,
      startedAt: new Date(stamp(index === 0 ? start : today)).toISOString(),
      volume,
      estimatedOneRepMax: null,
      exercise: { id: "row", name: "Row" },
    })),
  ],
});
// Body and Energy: every measurement, the energy list (with its count), the
// energy-out chart's 30-day range and the Calories card's 30-day history.
client.setQueryData(bodyMeasurementsQueryKey("test-user"), {
  bodyMeasurements: [
    { id: "body-3", measuredOn: today, weightKg: 80.9, bodyFatPct: 17.5 },
    { id: "body-2", measuredOn: middle, weightKg: 81.7, bodyFatPct: 18.2 },
    { id: "body-1", measuredOn: start, weightKg: 82.4, bodyFatPct: null },
  ],
});
const energyRows = [
  { id: "energy-1", energyOn: start, activeKcal: 350, restingKcal: 1800 },
  { id: "energy-2", energyOn: middle, activeKcal: null, restingKcal: 1750 },
  { id: "energy-3", energyOn: today, activeKcal: 0, restingKcal: null },
];
client.setQueryData(dailyEnergyListQueryKey("test-user"), {
  pages: [
    {
      dailyEnergyEntries: [...energyRows].reverse().map((row) => ({ ...row, notes: null })),
      dailyEnergyEntriesAggregate: { aggregate: { count: energyRows.length } },
    },
  ],
  pageParams: [0],
});
const energyRange = chartWindow(30, today);
client.setQueryData(dailyEnergyRangeQueryKey(energyRange.start, today, "test-user"), {
  dailyEnergyEntries: energyRows,
});
client.setQueryData(calorieHistoryQueryKey(energyRange.fetchFrom, today, "test-user"), {
  nutritionDays: [
    [start, 1000, 200],
    [middle, 1000, 250],
    [today, 400, 200],
  ].map(([logDate, grams, snapshotKcalPer100g]) => ({
    id: `day-${logDate}`,
    logDate,
    nutritionLogEntries: [{ id: `log-${logDate}`, grams, snapshotKcalPer100g }],
  })),
  dailyEnergyEntries: energyRows,
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
type ChartRoute = typeof Muscles | typeof Strength | typeof Overview | typeof Body | typeof Energy;
async function checkChart(route: ChartRoute, labels: string[], keyboard = true) {
  const Component = route.options.component;
  assert(Component);
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <ResponsiveContainer width={640} height={240}>
          <Component />
        </ResponsiveContainer>
      </QueryClientProvider>,
    ),
  );
  const selector = keyboard ? 'svg[role="application"]' : 'svg[role="img"]';
  for (
    let attempt = 0;
    attempt < 50 && container.querySelectorAll(selector).length === 0;
    attempt += 1
  ) {
    // biome-ignore lint/performance/noAwaitInLoops: Let real Recharts resolve dimensions and state.
    await settle();
  }
  const charts = [...container.querySelectorAll(selector)];
  assert.deepEqual(
    charts.map((chart) => chart.getAttribute("aria-label")),
    labels,
  );
  if (keyboard) {
    const chart = charts[0];
    assert(chart);
    assert.equal(chart.getAttribute("tabindex"), "0", "Keep Recharts keyboard accessibility");
    assert.equal(chart.closest('[role="img"]'), null, "Do not hide the interactive SVG");
    await settle(() => chart.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true })));
    const tooltip = container.querySelector<HTMLElement>(".recharts-tooltip-wrapper");
    assert.equal(tooltip?.style.visibility, "visible");
  }
  for (const query of client.getQueryCache().getAll()) {
    assert.equal(query.state.error, null, "Seeded chart queries must not fail silently");
  }
}

// Muscles, Strength and Overview: spoken summaries (lowest, highest, average,
// latest; rolling averages skip their average; partial weeks named last).
const chartDate = (day: string) => formatChartDate(day);
/** The seeded strength volume by Monday week: this week partial, an earlier week complete. */
function weeklyVolumeSummary() {
  const volumes = new Map<string, number>();
  const sessions: [string, number][] = [
    [start, 500],
    [middle, 500],
    [today, 500],
    [start, 0],
    [today, 100],
  ];
  for (const [day, volume] of sessions) {
    const week = weekStartOf(day);
    volumes.set(week, (volumes.get(week) ?? 0) + volume);
  }
  const thisWeek = weekStartOf(today);
  const partial = `This week so far: ${weeklyVolumeLabel(volumes.get(thisWeek) ?? 0)}.`;
  const lastWeek = [...volumes.keys()].find((week) => week < thisWeek);
  if (!lastWeek) {
    return `Weekly strength volume. ${partial}`;
  }
  const week = chartDate(lastWeek);
  const value = weeklyVolumeLabel(volumes.get(lastWeek) ?? 0);
  return `Weekly strength volume, week of ${week}: latest ${value} in the week of ${week}. ${partial}`;
}
const bothAxes = "on the right; both lines start at the same height.";

try {
  await checkChart(Muscles, [
    `Chest trailing seven-day weighted sets, ${chartDate(start)} to ${chartDate(today)}: lowest 8 sets, highest 12.5 sets, average ${metricFormat.sets(10.25)} sets, latest 12.5 sets on ${chartDate(today)}.`,
  ]);
  await checkChart(Strength, [
    weeklyVolumeSummary(),
    `Bench Press volume and estimated one-rep max, ${chartDate(start)} to ${chartDate(today)}. Volume: lowest 500 kg, highest 500 kg, average 500 kg, latest 500 kg on ${chartDate(today)}. Est. 1RM: lowest 92.5 kg, highest 100 kg, average ${metricFormat.estimatedOneRepMax(96.25)}, latest 100 kg on ${chartDate(middle)}. Volume on the left axis, Est. 1RM ${bothAxes}`,
    `Row volume, ${chartDate(start)} to ${chartDate(today)}: lowest 0 kg, highest 100 kg, average 50 kg, latest 100 kg on ${chartDate(today)}.`,
  ]);
  // Body: one chart per metric, daily readings under the 7-day average.
  const { weight, weightAverage, bodyFat: fat, kcal } = metricFormat;
  const weightMean = (82.4 + 81.7 + 80.9) / 3;
  const fatMean = (18.2 + 17.5) / 2;
  await checkChart(Body, [
    `Weight, daily readings and 7-day average, ${chartDate(start)} to ${chartDate(today)}. Daily: lowest 80.9 kg, highest 82.4 kg, average ${weight(weightMean)}, latest 80.9 kg on ${chartDate(today)}. 7-day avg: lowest ${weightAverage(weightMean)}, highest 82.4 kg, latest ${weightAverage(weightMean)} on ${chartDate(today)}.`,
    `Body fat, daily readings and 7-day average, ${chartDate(middle)} to ${chartDate(today)}. Daily: lowest 17.5 %, highest 18.2 %, average ${fat(fatMean)}, latest 17.5 % on ${chartDate(today)}. 7-day avg: lowest ${fat(fatMean)}, highest 18.2 %, latest ${fat(fatMean)} on ${chartDate(today)}.`,
  ]);
  // Energy: today's partial row closes the energy-out summary; Calories
  // consumed adds today's intake so far, net uses full days only.
  const signed = metricFormat.netKcal;
  await checkChart(Energy, [
    `Active and resting energy per day, ${chartDate(start)} to ${chartDate(middle)}. Active: latest 350 kcal on ${chartDate(start)}. Resting: lowest 1,750 kcal, highest 1,800 kcal, average 1,775 kcal, latest 1,750 kcal on ${chartDate(middle)}. Today so far: 0 kcal.`,
    `Calories consumed per day and 7-day average, ${chartDate(start)} to ${chartDate(middle)}. Daily: lowest ${kcal(2000)}, highest ${kcal(2500)}, average ${kcal(2250)}, latest ${kcal(2500)} on ${chartDate(middle)}. 7-day avg: lowest ${kcal(2000)}, highest ${kcal(2250)}, latest ${kcal(2250)} on ${chartDate(middle)}. Today so far: ${kcal(800)}.`,
    `Net calories, daily and 7-day average, ${chartDate(start)} to ${chartDate(middle)}. Daily: lowest ${signed(-150)}, highest ${signed(750)}, average ${signed(300)}, latest ${signed(750)} on ${chartDate(middle)}. 7-day avg: lowest ${signed(-150)}, highest ${signed(300)}, latest ${signed(300)} on ${chartDate(middle)}.`,
  ]);
  // "Average out" covers the full days in the chart's window, never today.
  const averageOut = () =>
    container.querySelector('section[aria-label="Energy trend"] dt')?.textContent?.trim();
  assert.equal(averageOut(), "Average out · 2 full days");
  await settle(() =>
    client.setQueryData(dailyEnergyRangeQueryKey(energyRange.start, today, "test-user"), {
      dailyEnergyEntries: energyRows.slice(0, 1),
    }),
  );
  assert.equal(averageOut(), "Average out · 1 full day");
  assert.equal(
    container.querySelector('section[aria-label="Energy days"] [aria-live]')?.textContent,
    "3 of 3 days",
  );

  // Overview: every card shares its section's cache (Muscles and Strength at
  // 8 weeks, Body's measurement list, Energy's 30-day calorie history);
  // Body and Energy are re-seeded here so the expectations below stay local.
  const overviewRange = chartWindow(30, today);
  client.setQueryData(bodyMeasurementsQueryKey("test-user"), {
    bodyMeasurements: [
      { id: "body-3", measuredOn: today, weightKg: 80.9, bodyFatPct: 17.5 },
      { id: "body-2", measuredOn: middle, weightKg: 81.7, bodyFatPct: 18.2 },
      { id: "body-1", measuredOn: start, weightKg: 82.4, bodyFatPct: null },
    ],
  });
  client.setQueryData(calorieHistoryQueryKey(overviewRange.fetchFrom, today, "test-user"), {
    nutritionDays: [
      {
        id: "day-1",
        logDate: start,
        nutritionLogEntries: [{ id: "log-1", grams: 1000, snapshotKcalPer100g: 200 }],
      },
      {
        id: "day-2",
        logDate: middle,
        nutritionLogEntries: [{ id: "log-2", grams: 1000, snapshotKcalPer100g: 250 }],
      },
      {
        id: "day-3",
        logDate: today,
        nutritionLogEntries: [{ id: "log-3", grams: 400, snapshotKcalPer100g: 200 }],
      },
    ],
    dailyEnergyEntries: [
      { id: "overview-energy-1", energyOn: start, activeKcal: 350, restingKcal: 1800 },
      { id: "overview-energy-2", energyOn: middle, activeKcal: 500, restingKcal: 1750 },
    ],
  });
  const weights = [82.4, (82.4 + 81.7) / 2, (82.4 + 81.7 + 80.9) / 3];
  const bodyFat = [18.2, (18.2 + 17.5) / 2];
  const net = metricFormat.netKcal;
  await checkChart(Overview, [
    weeklyVolumeSummary(),
    `Weight and body fat 7-day averages, ${chartDate(start)} to ${chartDate(today)}. Weight: lowest ${metricFormat.weightAverage(Math.min(...weights))}, highest ${metricFormat.weightAverage(Math.max(...weights))}, latest ${metricFormat.weightAverage(weights[2] ?? 0)} on ${chartDate(today)}. Body fat: lowest ${metricFormat.bodyFat(bodyFat[1] ?? 0)}, highest 18.2 %, latest ${metricFormat.bodyFat(bodyFat[1] ?? 0)} on ${chartDate(today)}. Weight on the left axis, Body fat ${bothAxes}`,
    `Net calories, daily and 7-day average, ${chartDate(start)} to ${chartDate(middle)}. Daily: lowest ${net(-150)}, highest ${net(250)}, average ${net(50)}, latest ${net(250)} on ${chartDate(middle)}. 7-day avg: lowest ${net(-150)}, highest ${net(50)}, latest ${net(50)} on ${chartDate(middle)}.`,
  ]);
  assert.equal(
    container.querySelector('[role="img"][aria-label^="Most trained"]')?.getAttribute("aria-label"),
    "Most trained muscles over the last 7 days: Chest 12.5",
  );
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("Progress charts announce their trends and retain chart keyboard access.");
