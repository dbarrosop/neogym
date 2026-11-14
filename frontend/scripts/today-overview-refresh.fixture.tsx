// Run in a subprocess so DOM globals, the clock and module mocks stay isolated.
import { mock, setSystemTime } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ReactNode } from "react";
import type { TrendChartProps } from "@/components/charts/trend-chart";
import type { TodayOverviewQuery } from "@/gql/graphql";

setSystemTime(new Date(2026, 5, 1, 12, 40));
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
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children }: { children: ReactNode }) => <a href="#test">{children}</a>,
}));
// The estimate has its own query; this fixture checks only what Today hands it.
const estimateProps: Record<string, unknown>[] = [];
mock.module("@/components/today-energy-estimate", () => ({
  TodayEnergyEstimate: (props: Record<string, unknown>) => {
    estimateProps.push(props);
    return null;
  },
}));
// Recharts needs layout Happy DOM lacks; record the series and spoken summary instead.
const { buildTrendChartModel } = await import("@/components/charts/trend-chart-model");
mock.module("@/components/charts/trend-chart", () => ({
  TrendChart: (props: TrendChartProps) => (
    <div
      className="trend-chart-stub"
      role="img"
      aria-label={buildTrendChartModel(props).label}
      data-series={JSON.stringify(
        props.series.map((series) => ({
          name: series.name,
          color: series.color,
          axis: series.axis ?? "left",
          points: series.points,
        })),
      )}
    />
  ),
}));

const requests: ReturnType<typeof Promise.withResolvers<TodayOverviewQuery>>[] = [];
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode) => {
    assert.equal(getOperationAST(document)?.name?.value, "TodayOverview");
    const request = Promise.withResolvers<TodayOverviewQuery>();
    requests.push(request);
    return request.promise;
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Route } = await import("@/routes/_authed/today");
const Today = Route.options.component;
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});
const overviewKey = ["today", "overview", "2026-06-01", "test-user"];
const initial: TodayOverviewQuery = {
  todaySessions: [],
  latestSession: [],
  recentSessions: { aggregate: { count: 0 } },
  todayNutrition: [],
  todayEnergy: [],
  bodyMeasurements: [],
};
const energyUpdatedAt = "2026-06-01T10:15:00Z";
const updated: TodayOverviewQuery = {
  ...initial,
  todayNutrition: [
    {
      id: "today-nutrition",
      nutritionPlan: null,
      nutritionLogEntries: [
        {
          id: "logged-food",
          grams: 100,
          snapshotKcalPer100g: 250,
          snapshotProteinPer100g: 20,
          snapshotCarbsPer100g: 30,
          snapshotFatPer100g: 6,
          snapshotFiberPer100g: 0,
          snapshotSugarPer100g: 0,
        },
      ],
    },
  ],
  todayEnergy: [
    { id: "today-energy", activeKcal: 300, restingKcal: 1500, updatedAt: energyUpdatedAt },
  ],
  bodyMeasurements: [
    { id: "body-previous", measuredOn: "2026-05-31", weightKg: 82, bodyFatPct: null },
    { id: "body", measuredOn: "2026-06-01", weightKg: 80, bodyFatPct: 20 },
  ],
};
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
  throw new Error(`Timed out waiting for Today overview: ${container.textContent}`);
}
function renderToday(visible: boolean) {
  assert(Today);
  root.render(
    <QueryClientProvider client={client}>{visible ? <Today /> : null}</QueryClientProvider>,
  );
}
function retryButton() {
  const button = [...container.querySelectorAll("button")].find(
    (element) => element.textContent === "Retry",
  );
  assert(button, "The overview error offers Retry");
  return button;
}
function card(title: string) {
  const heading = [...container.querySelectorAll("h2")].find(
    (element) => element.textContent === title,
  );
  assert(heading?.parentElement?.parentElement, `Missing ${title} card`);
  return heading.parentElement.parentElement;
}
function bodyChart() {
  const chart = card("Body").querySelector(".trend-chart-stub");
  assert(chart, "The Body card draws its chart");
  return {
    label: chart.getAttribute("aria-label") ?? "",
    series: JSON.parse(chart.getAttribute("data-series") ?? "[]") as {
      name: string;
      color: string;
      axis: string;
      points: { date: string; value: number }[];
    }[],
  };
}
const kcal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const shortDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short" });

try {
  await settle(() => renderToday(true));
  assert.equal(requests.length, 1);
  assert.equal(container.querySelectorAll(".animate-pulse").length, 8);
  assert(!container.textContent?.includes("Couldn't load today"));

  await settle(() => requests[0]?.reject(new Error("Overview unavailable")));
  await waitFor(() => container.textContent?.includes("Overview unavailable") ?? false);
  assert(container.textContent?.includes("Couldn't load today"));
  assert.equal(container.querySelectorAll(".animate-pulse").length, 0);
  assert.equal(container.querySelectorAll("h2").length, 0, "Failed cards are not loading");

  await settle(() => retryButton().click());
  await waitFor(() => requests.length === 2);
  assert.equal(container.querySelectorAll(".animate-pulse").length, 8);
  await settle(() => requests[1]?.resolve(initial));
  await waitFor(() => !!container.querySelector('[aria-label="0 kilocalories logged"]'));
  assert(card("Nutrition").textContent?.includes("Nothing logged yet today."));

  await settle(() => renderToday(false));
  const cached = client.getQueryState(overviewKey);
  assert(cached);
  assert.equal(cached.isInvalidated, false);
  assert.equal(cached.dataUpdatedAt, Date.now(), "The overview is still inside staleTime");

  // Return without any writer invalidating Today, within the same 30-second freshness window.
  await settle(() => renderToday(true));
  await waitFor(() => requests.length === 3);
  assert(container.querySelector('[aria-label="0 kilocalories logged"]'));
  // No energy row yet today: intake only, no out or net, and never yesterday's balance.
  assert(card("Balance").textContent?.includes("No energy recorded yet today."));
  assert(card("Balance").textContent?.includes("In 0 kcal so far"));
  assert(!card("Balance").querySelector('[role="img"]'));
  assert.deepEqual(estimateProps.at(-1), {
    variant: "today",
    balance: { userId: "test-user", caloriesIn: 0, dailyEnergy: null },
  });
  assert(card("Body").textContent?.includes("No measurements in the last three weeks."));
  assert(!card("Body").querySelector(".trend-chart-stub"));

  await settle(() => requests[2]?.resolve(updated));
  await waitFor(() => !!container.querySelector('[aria-label="250 kilocalories logged"]'));
  const nutrition = card("Nutrition");
  assert(!nutrition.textContent?.includes("Nothing logged yet today."));
  for (const [label, value] of [
    ["Protein", "20 g"],
    ["Carbs", "30 g"],
    ["Fat", "6 g"],
  ] as const) {
    const meter = [...nutrition.querySelectorAll("span")].find(
      (element) => element.textContent === label,
    );
    assert(meter?.parentElement?.textContent?.includes(value));
  }
  // Balance: today so far (250 in, 1,800 out recorded so far), stamped with the row's last write.
  const balance = card("Balance");
  const updatedTime = new Date(energyUpdatedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  assert(balance.textContent?.includes(`Today so far · ${updatedTime}`));
  assert.equal(balance.querySelector("strong")?.textContent, `−${kcal.format(1550)} kcal`);
  assert(balance.textContent?.includes(`In 250 · Out ${kcal.format(1800)}`));
  const split = balance.querySelector(
    `[aria-label="Energy out so far: resting ${kcal.format(1500)}, active 300 kilocalories"]`,
  );
  assert(split, "The resting/active split names both components");
  assert.deepEqual(
    [...split.children].map((segment) => segment.className),
    ["bg-chart-1", "bg-chart-2"],
    "Resting is Chart 1 and active Chart 2",
  );
  assert(balance.textContent?.includes(`Resting ${kcal.format(1500)}`));
  assert(balance.textContent?.includes("Active 300"));
  assert(!container.textContent?.toLowerCase().includes("yesterday"));
  assert.deepEqual(estimateProps.at(-1), {
    variant: "today",
    balance: {
      userId: "test-user",
      caloriesIn: 250,
      dailyEnergy: updated.todayEnergy[0],
    },
  });

  // Body: raw readings (not averages), weight on Chart 1 and body fat on Chart 2 on its own axis.
  const chart = bodyChart();
  assert.deepEqual(chart.series, [
    {
      name: "Weight",
      color: "chart-1",
      axis: "left",
      points: [
        { date: "2026-05-31", value: 82 },
        { date: "2026-06-01", value: 80 },
      ],
    },
    {
      name: "Body fat",
      color: "chart-2",
      axis: "right",
      points: [{ date: "2026-06-01", value: 20 }],
    },
  ]);
  assert(chart.label.startsWith("Weight and body fat, "), chart.label);
  assert(chart.label.includes("both lines start at the same height"), chart.label);
  assert(card("Body").textContent?.includes(`Weight · ${shortDate(new Date(2026, 5, 1))}`));
  assert(card("Body").textContent?.includes(`Body fat · ${shortDate(new Date(2026, 5, 1))}`));
  assert(card("Body").textContent?.includes("80 kg"));
  assert(card("Body").textContent?.includes("20.0 %"));
  const range = card("Body").querySelector('[aria-hidden="true"].justify-between');
  assert.deepEqual(
    [...(range?.children ?? [])].map((element) => element.textContent),
    [shortDate(new Date(2026, 4, 31)), shortDate(new Date(2026, 5, 1))],
    "The first and last plotted dates sit under the chart",
  );
  assert(!container.textContent?.includes("Couldn't load today"));
  assert.equal(container.querySelectorAll(".animate-pulse").length, 0);
  assert.equal(requests.length, 3, "One overview request is made per visit or Retry");

  await settle(() => renderToday(false));
  await settle(() => renderToday(true));
  await waitFor(() => requests.length === 4);
  await settle(() => requests[3]?.reject(new Error("Background refresh unavailable")));
  await waitFor(() => container.textContent?.includes("Background refresh unavailable") ?? false);
  for (const title of ["Training", "Nutrition", "Balance", "Body"]) {
    card(title);
  }
  assert(container.querySelector('[aria-label="250 kilocalories logged"]'));
  assert(card("Body").textContent?.includes("80 kg"));
  assert.equal(container.querySelectorAll(".animate-pulse").length, 0);

  await settle(() => retryButton().click());
  await waitFor(() => requests.length === 5);
  assert(retryButton().disabled, "Retry is disabled during a cached-data refetch");
  assert(container.querySelector('[aria-label="250 kilocalories logged"]'));
  await settle(() => requests[4]?.resolve(initial));
  await waitFor(() => !!container.querySelector('[aria-label="0 kilocalories logged"]'));
  assert(!container.textContent?.includes("Couldn't load today"));
  assert.equal(container.querySelectorAll(".animate-pulse").length, 0);

  // Either Body metric can be logged independently, including a valid zero body-fat value.
  for (const [weightKg, bodyFatPct] of [
    [null, 18.5],
    [null, 0],
    [80, null],
    [80, 20],
  ] as const) {
    // biome-ignore lint/performance/noAwaitInLoops: Render each measurement before checking its card.
    await settle(() =>
      client.setQueryData(overviewKey, {
        ...initial,
        bodyMeasurements: [{ id: "body", measuredOn: "2026-06-01", weightKg, bodyFatPct }],
      } satisfies TodayOverviewQuery),
    );
    const body = card("Body");
    assert(!body.textContent?.includes("No measurements in the last three weeks."));
    assert.equal(body.textContent?.includes("Weight ·"), weightKg !== null);
    assert.equal(body.textContent?.includes("Body fat ·"), bodyFatPct !== null);
    assert.deepEqual(
      [...body.querySelectorAll("strong")].map((element) => element.textContent),
      [
        ...(weightKg === null ? [] : [`${weightKg} kg`]),
        ...(bodyFatPct === null ? [] : [`${bodyFatPct.toFixed(1)} %`]),
      ],
    );
    // Each metric has its own 7-day average; one series alone stays on the left axis.
    assert.deepEqual(
      [...body.querySelectorAll("span")]
        .filter((element) => element.textContent?.startsWith("7-day avg"))
        .map((element) => element.textContent),
      [
        ...(weightKg === null ? [] : [`7-day avg ${weightKg.toFixed(1)}`]),
        ...(bodyFatPct === null ? [] : [`7-day avg ${bodyFatPct.toFixed(1)}`]),
      ],
    );
    assert.deepEqual(
      bodyChart().series.map((series) => [series.name, series.color, series.axis]),
      [
        ...(weightKg === null ? [] : [["Weight", "chart-1", "left"]]),
        ...(bodyFatPct === null
          ? []
          : [["Body fat", "chart-2", weightKg === null ? "left" : "right"]]),
      ],
    );
  }
  await settle(() => client.setQueryData(overviewKey, initial));
  assert(card("Body").textContent?.includes("No measurements in the last three weeks."));

  // Weight changes have no favourable direction without a goal, even when weight rises.
  for (const [priorWeight, currentWeight, expectedSummary] of [
    [80, 81.2, "7-day avg 81.2 · +1.2 vs prior week"],
    [80, 78.8, "7-day avg 78.8 · −1.2 vs prior week"],
    [80, 80, "7-day avg 80.0 · 0.0 vs prior week"],
    [null, 80, "7-day avg 80.0"],
  ] as const) {
    // biome-ignore lint/performance/noAwaitInLoops: Each weight summary must render before checking its styling.
    await settle(() =>
      client.setQueryData(overviewKey, {
        ...initial,
        bodyMeasurements: [
          ...(priorWeight === null
            ? []
            : [
                {
                  id: "body-prior-week",
                  measuredOn: "2026-05-25",
                  weightKg: priorWeight,
                  bodyFatPct: null,
                },
              ]),
          {
            id: "body-current-week",
            measuredOn: "2026-06-01",
            weightKg: currentWeight,
            bodyFatPct: null,
          },
        ],
      } satisfies TodayOverviewQuery),
    );
    const summary = [...card("Body").querySelectorAll("span")].find((element) =>
      element.textContent?.startsWith("7-day avg"),
    );
    assert(summary);
    assert.equal(summary.textContent, expectedSummary);
    assert(!summary.classList.contains("text-positive"), "Weight changes are not success states");
    assert(summary.classList.contains("text-muted-foreground"), "Weight summaries stay neutral");
  }

  // Count labels use singular only for one, in both Training card branches.
  for (const [exerciseCount, recentCount, recentLabel, exerciseLabel] of [
    [null, 0, "0 sessions", null],
    [null, 1, "1 session", null],
    [null, 2, "2 sessions", null],
    [0, 0, "0 sessions", "0 exercises"],
    [1, 1, "1 session", "1 exercise"],
    [2, 2, "2 sessions", "2 exercises"],
  ] as const) {
    const data: TodayOverviewQuery = {
      ...initial,
      recentSessions: { aggregate: { count: recentCount } },
      todaySessions:
        exerciseCount === null
          ? []
          : [
              {
                id: "today-session",
                startedAt: "2026-06-01T10:00:00Z",
                workout: { id: "workout", name: "Today's workout" },
                workoutSessionExercises: Array.from({ length: exerciseCount }, (_, index) => ({
                  id: `session-exercise-${index}`,
                  exercise: {
                    id: `exercise-${index}`,
                    name: `Exercise ${index + 1}`,
                    kind: "strength",
                    strength: { doubleWeight: false },
                  },
                  workoutSessionStrengthSets: [],
                  workoutSessionCardioEntries_aggregate: { aggregate: { count: 0 } },
                })),
              },
            ],
    };
    // biome-ignore lint/performance/noAwaitInLoops: Each case must render before checking its copy.
    await settle(() => client.setQueryData(overviewKey, data));
    const training = card("Training");
    const recentTile = [...training.querySelectorAll("span")].find(
      (element) => element.textContent === "Last 7 days",
    );
    assert.equal(recentTile?.nextElementSibling?.textContent, recentLabel);
    if (exerciseLabel === null) {
      assert(training.textContent?.includes("No session logged yet today."));
    } else {
      const subtitle = training.querySelector("a strong")?.nextElementSibling?.textContent;
      assert.equal(subtitle?.split(" · ").at(-1), exerciseLabel);
    }
  }
} finally {
  act(() => root.unmount());
  client.clear();
  setSystemTime();
  await dom.happyDOM.close();
}
console.info(
  "Today revalidates cached cards, recovers from errors and pluralizes training counts.",
);
