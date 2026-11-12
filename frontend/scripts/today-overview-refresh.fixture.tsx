// Run in a subprocess so DOM globals, the clock and module mocks stay isolated.
import { mock, setSystemTime } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ReactNode } from "react";
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
// The estimate has its own query; this fixture exercises only the overview consumer.
mock.module("@/components/today-energy-estimate", () => ({ TodayEnergyEstimate: () => null }));

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
  yesterdayNutrition: [],
  yesterdayEnergy: [],
  bodyMeasurements: [],
};
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
  yesterdayEnergy: [{ id: "yesterday-energy", activeKcal: 300, restingKcal: 1500 }],
  bodyMeasurements: [{ id: "body", measuredOn: "2026-06-01", weightKg: 80, bodyFatPct: 20 }],
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
function card(title: string) {
  const heading = [...container.querySelectorAll("h2")].find(
    (element) => element.textContent === title,
  );
  assert(heading?.parentElement?.parentElement, `Missing ${title} card`);
  return heading.parentElement.parentElement;
}

try {
  await settle(() => renderToday(true));
  assert.equal(requests.length, 1);
  await settle(() => requests[0]?.resolve(initial));
  await waitFor(() => !!container.querySelector('[aria-label="0 kilocalories logged"]'));
  assert(card("Nutrition").textContent?.includes("Nothing logged yet today."));

  await settle(() => renderToday(false));
  const cached = client.getQueryState(overviewKey);
  assert(cached);
  assert.equal(cached.isInvalidated, false);
  assert.equal(cached.dataUpdatedAt, Date.now(), "The overview is still inside staleTime");

  // Return without any writer invalidating Today, within the same 30-second freshness window.
  await settle(() => renderToday(true));
  await waitFor(() => requests.length === 2);
  assert(container.querySelector('[aria-label="0 kilocalories logged"]'));
  assert(card("Balance").textContent?.includes("No energy logged for yesterday."));
  assert(card("Body").textContent?.includes("No measurements in the last three weeks."));

  await settle(() => requests[1]?.resolve(updated));
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
  const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  assert(
    card("Balance").querySelector(
      `[aria-label="Energy out: resting ${format.format(1500)}, active ${format.format(300)} kilocalories"]`,
    ),
  );
  assert(card("Body").textContent?.includes("80.00 kg"));
  assert.equal(requests.length, 2, "One overview request is made per visit");
} finally {
  act(() => root.unmount());
  client.clear();
  setSystemTime();
  await dom.happyDOM.close();
}
console.info("Today revalidates fresh cached nutrition, energy and body data on return.");
