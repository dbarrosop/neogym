// Run in a subprocess so DOM globals, the clock and module mocks stay isolated.
import { mock, setSystemTime, spyOn } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window as TestWindow } from "happy-dom";
import { act, type ReactNode } from "react";
import type { DailyIntakeLogQuery, TodayOverviewQuery } from "@/gql/graphql";
import type { PlanLogMaterialization } from "@/lib/nutrition";

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
  useNavigate: () => () => undefined,
  Link: ({ children }: { children: ReactNode }) => <a href="#test">{children}</a>,
}));
// Energy estimates are independent of the plan timeline and clock under test.
mock.module("@/components/today-energy-estimate", () => ({ TodayEnergyEstimate: () => null }));

let minuteTick: (() => void) | undefined;
const interval = spyOn(window as Window, "setInterval").mockImplementation((callback, delay) => {
  assert.equal(delay, 60_000);
  assert.equal(typeof callback, "function");
  minuteTick = callback as () => void;
  return 1;
});
const clearInterval = spyOn(window, "clearInterval").mockImplementation(() => undefined);

const food = {
  id: "eggs",
  name: "Eggs",
  isPublic: true,
  kcalPer100g: 150,
  proteinPer100g: 13,
  fatPer100g: 10,
  carbsPer100g: 1,
  fiberPer100g: 0,
  sugarPer100g: 0,
};
const meal = {
  id: "oatmeal",
  name: "Oatmeal",
  mealIngredients: [{ id: "ingredient", grams: 100, position: 0, food }],
};
const plan: DailyIntakeLogQuery["nutritionPlans"][number] = {
  id: "plan",
  name: "Daily plan",
  nutritionPlanMeals: [{ id: "plan-meal", position: 0, slotTime: "13:00:00", meal }],
  nutritionPlanFoods: ["08:00:00", "13:00:00", "14:00:00", null].map((slotTime, index) => ({
    id: `plan-food-${index}`,
    position: 1,
    grams: 100,
    slotTime,
    food,
  })),
};
let entryId = 0;
function loggedEntry(slotTime: string | null, name: string, grams = 100, position = 0) {
  return {
    id: `entry-${entryId++}`,
    source: "food",
    foodId: food.id,
    slotTime,
    grams,
    position,
    snapshotFoodName: name,
    snapshotKcalPer100g: food.kcalPer100g,
    snapshotProteinPer100g: food.proteinPer100g,
    snapshotFatPer100g: food.fatPer100g,
    snapshotCarbsPer100g: food.carbsPer100g,
    snapshotFiberPer100g: food.fiberPer100g,
    snapshotSugarPer100g: food.sugarPer100g,
  };
}
const day: DailyIntakeLogQuery["nutritionDays"][number] = {
  id: "day",
  logDate: "2026-06-01",
  nutritionPlanId: plan.id,
  nutritionLogMeals: [],
  nutritionLogEntries: [loggedEntry("13:00:45", "Coffee"), loggedEntry(null, "Untimed snack")],
};
const daily: DailyIntakeLogQuery = {
  nutritionDays: [day],
  dailyEnergyEntries: [],
  nutritionPlans: [plan],
  meals: [meal],
  foods: [food],
};
function overview(): TodayOverviewQuery {
  return {
    todaySessions: [],
    latestSession: [],
    recentSessions: { aggregate: { count: 0 } },
    todayNutrition: [
      {
        id: day.id,
        nutritionPlan: plan,
        nutritionLogEntries: [
          ...day.nutritionLogEntries,
          ...day.nutritionLogMeals.flatMap((group) => group.nutritionLogEntries),
        ],
      },
    ],
    yesterdayNutrition: [],
    yesterdayEnergy: [],
    bodyMeasurements: [],
  };
}
const slotRequests: PlanLogMaterialization[] = [];
let queryCount = 0;
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode, variables: PlanLogMaterialization) => {
    switch (getOperationAST(document)?.name?.value) {
      case "DailyIntakeLog":
        queryCount += 1;
        return Promise.resolve(structuredClone(daily));
      case "TodayOverview":
        queryCount += 1;
        return Promise.resolve(structuredClone(overview()));
      case "LogSelectedPlan": {
        slotRequests.push(variables);
        for (const object of variables.mealObjects) {
          day.nutritionLogMeals.push({
            ...object,
            id: `group-${day.nutritionLogMeals.length}`,
            nutritionLogEntries: object.nutritionLogEntries.data.map((entry) =>
              loggedEntry(entry.slotTime, food.name, entry.grams, entry.position),
            ),
          });
        }
        for (const object of variables.entryObjects) {
          day.nutritionLogEntries.push(
            loggedEntry(object.slotTime, food.name, object.grams, object.position),
          );
        }
        return Promise.resolve({
          insertNutritionLogMeals: { affected_rows: variables.mealObjects.length },
          insertNutritionLogEntries: { affected_rows: variables.entryObjects.length },
        });
      }
      default:
        throw new Error("Unexpected GraphQL operation");
    }
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { DailyIntakeLog } = await import("@/components/daily-intake-log");
const { Route } = await import("@/routes/_authed/today");
const { formatTimeOfDay } = await import("@/lib/nutrition");
const Today = Route.options.component;
assert(Today);
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
  throw new Error(`Timed out waiting for UI: ${container.textContent}`);
}
function card(time: string | null, status: "planned" | "logged") {
  const label = time ? formatTimeOfDay(time) : "No time";
  const element = container.querySelector<HTMLElement>(`section[aria-label="${label}, ${status}"]`);
  assert(element, `Missing ${label}, ${status} card`);
  return element;
}
function assertPlanVisible() {
  const cards = container.querySelectorAll('[aria-label="Timeline"] > section');
  assert.deepEqual(
    [...cards].map((element) => element.getAttribute("aria-label")),
    [
      `${formatTimeOfDay("08:00")}, planned`,
      `${formatTimeOfDay("13:00")}, logged`,
      `${formatTimeOfDay("13:00")}, planned`,
      `${formatTimeOfDay("14:00")}, planned`,
      "No time, logged",
      "No time, planned",
    ],
  );
  const planned = card("13:00", "planned");
  assert(planned.textContent?.includes("Oatmeal"));
  assert(planned.textContent?.includes("Eggs"));
  assert(planned.textContent?.includes("Log slot"));
  assert(!planned.textContent?.includes("Logged"));
  assert(card(null, "planned").textContent?.includes("Log slot"));
}
function nextSlotText() {
  const label = [...container.querySelectorAll("#today span")].find(
    (element) => element.textContent === "Next in plan",
  );
  return label?.parentElement?.textContent ?? "";
}
async function logSlot(time: string | null, expectedRows: number) {
  const button = card(time, "planned").querySelector<HTMLButtonElement>("button");
  assert(button);
  const requestCount = slotRequests.length;
  await settle(() => button.click());
  await waitFor(
    () =>
      slotRequests.length === requestCount + 1 &&
      card(time ?? "12:40", "logged").querySelectorAll("li").length === expectedRows &&
      !button.disabled,
  );
  assert(card(time, "planned").textContent?.includes("Log slot"));
}

try {
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <DailyIntakeLog date={day.logDate} />
        <div id="today">
          <Today />
        </div>
      </QueryClientProvider>,
    ),
  );
  await waitFor(() => !!container.querySelector('[aria-label="Timeline"] > section'));
  // Unrelated intake sharing HH:MM (even with different seconds) must not hide the plan.
  assertPlanVisible();

  // A partial meal log must not hide the remaining food or remove the slot action.
  day.nutritionLogMeals.push({
    id: "partial-meal",
    mealId: meal.id,
    nutritionPlanMealId: "plan-meal",
    name: meal.name,
    position: 1,
    slotTime: "13:00:00",
    nutritionLogEntries: [loggedEntry("13:00:00", food.name)],
  });
  await settle(() => client.invalidateQueries({ queryKey: ["nutrition", "days"] }));
  assertPlanVisible();
  await logSlot("13:00", 4);
  assertPlanVisible();
  await logSlot("13:00", 6);
  assertPlanVisible();
  assert.equal(slotRequests[0]?.mealObjects.length, 1);
  assert.equal(slotRequests[0]?.entryObjects.length, 1);
  assert.equal(slotRequests[1]?.mealObjects.length, 1, "Re-log must append the entire slot");
  assert.equal(slotRequests[1]?.entryObjects.length, 1);
  await logSlot(null, 1);
  assert.equal(slotRequests[2]?.entryObjects[0]?.slotTime, "12:40");

  assert(nextSlotText().includes(formatTimeOfDay("13:00")), "Early logging does not skip a slot");
  const queriesBeforeTicks = queryCount;
  assert.equal(interval.mock.calls.length, 1);
  assert(minuteTick);
  await settle(() => {
    setSystemTime(new Date(2026, 5, 1, 13, 0));
    minuteTick?.();
  });
  assert(nextSlotText().includes(formatTimeOfDay("14:00")), "Minute ticks advance the slot");
  await settle(() => {
    setSystemTime(new Date(2026, 5, 1, 12, 50));
    window.dispatchEvent(new window.Event("focus"));
  });
  assert(nextSlotText().includes(formatTimeOfDay("13:00")), "Focus resamples local time");
  await settle(() => {
    setSystemTime(new Date(2026, 5, 1, 14, 1));
    document.dispatchEvent(new window.Event("visibilitychange"));
  });
  assert.equal(nextSlotText(), "", "No future timed slots remain; untimed slots are not next");
  assert.equal(queryCount, queriesBeforeTicks, "Clock updates do not refetch the overview");
} finally {
  act(() => root.unmount());
  assert.deepEqual(clearInterval.mock.calls, [[1]]);
  client.clear();
  interval.mockRestore();
  clearInterval.mockRestore();
  setSystemTime();
  await dom.happyDOM.close();
}
console.info(
  "Planned slot actions survive same-time intake and re-logging; Today advances with the local clock.",
);
