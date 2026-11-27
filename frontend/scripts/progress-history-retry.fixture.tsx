// Keep the real route, list/footer and TanStack Query observers; mock only I/O and chart drawing.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window } from "happy-dom";
import { act, type ReactNode } from "react";
import type { TrendChartProps } from "@/components/charts/trend-chart";

const dom = new Window({ url: "http://localhost" });
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
  useRouterState: () => "/progress/energy",
  Link: ({ children }: { children: ReactNode }) => <a href="#record">{children}</a>,
}));
mock.module("@/lib/nhost/auth-provider", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
mock.module("@/lib/use-local-today", () => ({ useLocalToday: () => "2026-06-30" }));
mock.module("@/components/charts/trend-chart", () => ({
  TrendChart: ({ title, series }: TrendChartProps) => (
    <figure aria-label={title} data-last={series[0]?.points.at(-1)?.value} />
  ),
}));
mock.module("@/components/today-energy-estimate", () => ({ TodayEnergyEstimate: () => null }));
mock.module("@/components/progress/quick-entry-forms", () => ({
  QuickDailyEnergyForm: () => null,
  QuickBodyMeasurementForm: () => null,
}));

let failEnergyOffset: number | null = 30;
const firstListRead = Promise.withResolvers<never>();
let listPending = true;
let failRange = false;
let failCalories = false;
let rangeActive = 500;
let consumed = 2400;
let failBody = false;
const offsets: number[] = [];
const energyRows = Array.from({ length: 42 }, (_, index) => ({
  id: `energy-${index}`,
  energyOn: new Date(Date.UTC(2026, 5, 29 - index)).toISOString().slice(0, 10),
  restingKcal: 1600,
  activeKcal: 500,
  notes: null,
}));
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode, variables?: { offset: number; limit: number }) => {
    switch (getOperationAST(document)?.name?.value) {
      case "DailyEnergyList": {
        assert(variables);
        const { offset, limit } = variables;
        offsets.push(offset);
        if (listPending) {
          return firstListRead.promise;
        }
        if (offset === failEnergyOffset) {
          return Promise.reject(new Error("Failed to fetch"));
        }
        return Promise.resolve({
          dailyEnergyEntries: energyRows.slice(offset, offset + limit),
          dailyEnergyEntriesAggregate: { aggregate: { count: energyRows.length } },
        });
      }
      case "DailyEnergyRange":
        if (failRange) {
          return Promise.reject(new Error("Range failed"));
        }
        return Promise.resolve({
          dailyEnergyEntries: energyRows
            .slice(0, 5)
            .toReversed()
            .map((row) => ({
              ...row,
              activeKcal: rangeActive,
            })),
        });
      case "CalorieHistory":
        if (failCalories) {
          return Promise.reject(new Error("Calories failed"));
        }
        return Promise.resolve({
          nutritionDays: [
            {
              logDate: "2026-06-29",
              nutritionLogEntries: [{ grams: 100, snapshotKcalPer100g: consumed }],
            },
          ],
          dailyEnergyEntries: energyRows.slice(0, 1),
        });
      case "BodyMeasurements":
        if (failBody) {
          return Promise.reject(new Error("Failed to fetch"));
        }
        return Promise.resolve({
          bodyMeasurements: energyRows.slice(0, 15).map(({ id, energyOn }) => ({
            id,
            measuredOn: energyOn,
            weightKg: 80,
            bodyFatPct: null,
            notes: null,
          })),
        });
      case "ProgressPhotoSummary":
        return Promise.resolve({
          progressPhotosAggregate: { aggregate: { count: 0, max: { takenOn: null } } },
        });
      default:
        throw new Error("Unexpected operation");
    }
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Route: Energy } = await import("@/routes/_authed/progress/energy/index");
const { Route: Body } = await import("@/routes/_authed/progress/body/index");
const { dailyEnergyListQueryKey } = await import("@/lib/hooks/use-daily-energy");
const { CALORIE_HISTORY_QUERY_KEY } = await import("@/lib/hooks/use-calorie-history");
const { bodyMeasurementsQueryKey } = await import("@/lib/hooks/use-body-measurements");
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
}
async function waitFor(ready: () => boolean) {
  for (let attempt = 0; attempt < 40 && !ready(); attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: flush async query state before the next check.
    await settle();
  }
  assert(ready(), `Unexpected UI: ${container.textContent}`);
}
function button(label: string, within: ParentNode = container) {
  const match = [...within.querySelectorAll("button")].find(
    (element) => element.textContent === label,
  );
  assert(match, `Missing ${label}`);
  return match;
}
function section(label: string) {
  const element = container.querySelector(`section[aria-label="${label}"]`);
  assert(element, `Missing section ${label}`);
  return element;
}

const chartReading = (title: string) =>
  container.querySelector(`figure[aria-label^="${title}"]`)?.getAttribute("data-last");

try {
  const EnergyPage = Energy.options.component;
  assert(EnergyPage);
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <EnergyPage />
      </QueryClientProvider>,
    ),
  );
  // Both uncached charts request data without waiting for any history page.
  await waitFor(
    () =>
      chartReading("Active and resting") === "500" &&
      chartReading("Calories consumed") === "2400" &&
      chartReading("Net calories") === "300",
  );
  const trend = section("Energy trend");
  assert(trend.querySelector('input[type="radio"]:checked'));
  assert(container.querySelector('section[aria-labelledby] input[type="radio"]:checked'));
  assert.equal(container.querySelector('section[aria-label="Energy days"]'), null);
  await settle(() => {
    listPending = false;
    firstListRead.reject(new Error("History failed"));
  });
  await waitFor(() => container.textContent?.includes("Couldn't load energy days") === true);
  assert.equal(section("Energy trend"), trend);
  assert.equal(chartReading("Active and resting"), "500");
  assert.equal(chartReading("Net calories"), "300");
  offsets.length = 0;
  await settle(() => button("Retry").click());
  await waitFor(() => container.textContent?.includes("7 of 42 days") === true);
  const history = section("Energy days");
  for (const count of [14, 21, 28, 30]) {
    // biome-ignore lint/performance/noAwaitInLoops: each click advances a single visible page.
    await settle(() => button("Load more", history).click());
    assert.equal(history.querySelectorAll("tbody tr").length, count);
  }
  await waitFor(() => !!history.querySelector('[role="alert"]'));
  assert.deepEqual(offsets, [0, 30]);
  assert.equal(section("Energy days"), history);
  assert.equal(section("Energy trend"), trend);
  assert(history.textContent?.includes("30 of 42 days"));
  failEnergyOffset = null;
  await settle(() => button("Retry", history).click());
  await waitFor(() => history.textContent?.includes("35 of 42 days") === true);
  assert.deepEqual(offsets, [0, 30, 30], "Retry does not refetch already-loaded pages");
  assert(!history.querySelector('[role="alert"]'));

  failEnergyOffset = 0;
  await settle(() => client.invalidateQueries({ queryKey: dailyEnergyListQueryKey("me") }));
  await waitFor(() => container.textContent?.includes("Couldn't load energy days") === true);
  assert.equal(section("Energy days"), history);
  assert.equal(section("Energy trend"), trend);
  assert(history.textContent?.includes("35 of 42 days"));
  failEnergyOffset = null;
  await settle(() => button("Retry").click());
  await waitFor(() => !container.querySelector('[role="alert"]'));
  assert(history.textContent?.includes("35 of 42 days"));

  const listRequests = offsets.length;
  failRange = true;
  await settle(() => client.invalidateQueries({ queryKey: ["daily_energy", "range"] }));
  await waitFor(() => trend.textContent?.includes("Couldn't load the energy trend") === true);
  assert.equal(chartReading("Active and resting"), "500");
  assert(trend.querySelector('input[type="radio"]:checked'));
  failRange = false;
  rangeActive = 650;
  await settle(() => button("Retry", trend).click());
  await waitFor(
    () => chartReading("Active and resting") === "650" && !trend.querySelector('[role="alert"]'),
  );

  const calories = container
    .querySelector('figure[aria-label^="Calories consumed"]')
    ?.closest("section");
  assert(calories);
  failCalories = true;
  await settle(() => client.invalidateQueries({ queryKey: CALORIE_HISTORY_QUERY_KEY }));
  await waitFor(() => calories.textContent?.includes("Couldn't load calories") === true);
  assert.equal(chartReading("Calories consumed"), "2400");
  assert.equal(chartReading("Net calories"), "300");
  failCalories = false;
  consumed = 2300;
  await settle(() => button("Retry", calories).click());
  await waitFor(
    () => chartReading("Calories consumed") === "2300" && chartReading("Net calories") === "200",
  );
  assert(!calories.querySelector('[role="alert"]'));
  assert.equal(offsets.length, listRequests, "Chart retries leave the history query alone");

  const BodyPage = Body.options.component;
  assert(BodyPage);
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <BodyPage />
      </QueryClientProvider>,
    ),
  );
  await waitFor(() => container.textContent?.includes("7 of 15 entries") === true);
  const measurements = section("Measurements");
  const bodyTrendHeading = () =>
    [...container.querySelectorAll("h2")].find((node) => node.textContent === "Weight & body fat");
  const bodyTrend = bodyTrendHeading();
  assert(bodyTrend);
  const photoSummary = bodyTrend.closest("section")?.nextElementSibling;
  assert.equal(photoSummary?.querySelector("h2")?.textContent, "Progress photos");
  assert.equal(photoSummary?.nextElementSibling, measurements);
  await settle(() => button("Load more", measurements).click());
  failBody = true;
  await settle(() => client.invalidateQueries({ queryKey: bodyMeasurementsQueryKey("me") }));
  await waitFor(() => container.textContent?.includes("Couldn't load body measurements") === true);
  assert.equal(section("Measurements"), measurements);
  assert.equal(bodyTrendHeading(), bodyTrend);
  assert(measurements.textContent?.includes("14 of 15 entries"));
  failBody = false;
  await settle(() => button("Retry").click());
  await waitFor(() => !container.querySelector('[role="alert"]'));
  assert(measurements.textContent?.includes("14 of 15 entries"));
} finally {
  await act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("Progress preserves loaded rows and trends through paging and refetch errors.");
