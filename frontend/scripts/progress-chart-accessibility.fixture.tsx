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
const dateLabel = (day: string) =>
  new Date(stamp(day)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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
const { Route: Body } = await import("@/routes/_authed/progress/body/index");
const { Route: Energy } = await import("@/routes/_authed/progress/energy/index");
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
});
client.setQueryData(["progress", "muscles", today, 60, "test-user"], {
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
client.setQueryData(["progress", "strength", today, 12, "test-user"], {
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
client.setQueryData(["body_measurements"], {
  bodyMeasurements: [
    { id: "body-3", measuredOn: today, weightKg: 80.9, bodyFatPct: 17.5 },
    { id: "body-2", measuredOn: middle, weightKg: 81.7, bodyFatPct: 18.2 },
    { id: "body-1", measuredOn: start, weightKg: 82.4, bodyFatPct: null },
  ],
});
client.setQueryData(["daily_energy"], {
  pages: [
    {
      dailyEnergyEntries: [
        { id: "energy-3", energyOn: today, activeKcal: 0, restingKcal: null },
        { id: "energy-2", energyOn: middle, activeKcal: null, restingKcal: 1750 },
        { id: "energy-1", energyOn: start, activeKcal: 350, restingKcal: 1800 },
      ],
    },
  ],
  pageParams: [0],
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
type ChartRoute = typeof Muscles | typeof Strength | typeof Body | typeof Energy;
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

try {
  await checkChart(Muscles, [
    `Chest weighted sets per rolling week: 8 sets on ${dateLabel(start)} to 12.5 sets on ${dateLabel(today)}; up 4.5 sets overall across 2 observations.`,
  ]);
  await checkChart(
    Strength,
    [
      "Bench Press estimated one-rep max: 92.5 kg to 100 kg; up 7.5 kg overall across 2 observations.",
      "Row volume: 0 kg to 100 kg; up 100 kg overall across 2 observations.",
    ],
    false,
  );
  await checkChart(Body, [
    `Weight: 82.4 kg on ${dateLabel(start)} to 80.9 kg on ${dateLabel(today)}; down 1.5 kg overall across 3 observations. Body fat: 18.2 % on ${dateLabel(middle)} to 17.5 % on ${dateLabel(today)}; down 0.7 % overall across 2 observations.`,
  ]);
  await checkChart(Energy, [
    `Active energy: 350 kcal on ${dateLabel(start)} to 0 kcal on ${dateLabel(today)}; down 350 kcal overall across 2 observations. Resting energy: 1,800 kcal on ${dateLabel(start)} to 1,750 kcal on ${dateLabel(middle)}; down 50 kcal overall across 2 observations.`,
  ]);
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("All four Progress sections expose endpoint trends and retain chart keyboard access.");
