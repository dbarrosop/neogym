// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window } from "happy-dom";
import { act, type ComponentProps } from "react";
import type { DailyIntakeLogQuery } from "@/gql/graphql";

const dom = new Window({ url: "http://localhost", width: 375, height: 812 });
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
  IS_REACT_ACT_ENVIRONMENT: true,
});
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
mock.module("@tanstack/react-router", () => ({
  useNavigate: () => () => undefined,
  Link: ({ children, ...props }: ComponentProps<"a">) => (
    <a href="#test" aria-current={props["aria-current"]} aria-label={props["aria-label"]}>
      {children}
    </a>
  ),
}));
mock.module("@/components/today-energy-estimate", () => ({ TodayEnergyEstimate: () => null }));
const errors: string[] = [];
const successes: string[] = [];
mock.module("sonner", () => ({
  toast: {
    error: (message: string) => errors.push(message),
    success: (message: string) => successes.push(message),
  },
}));

function entry(id: string, name: string, kcal: number, groupId: string | null) {
  return {
    id,
    source: "food",
    foodId: id,
    nutritionLogMealId: groupId,
    slotTime: "12:00:00",
    grams: 100,
    position: 0,
    snapshotFoodName: name,
    snapshotKcalPer100g: kcal,
    snapshotProteinPer100g: 0,
    snapshotFatPer100g: 0,
    snapshotCarbsPer100g: 0,
    snapshotFiberPer100g: 0,
    snapshotSugarPer100g: 0,
  };
}
const day: DailyIntakeLogQuery["nutritionDays"][number] = {
  id: "day",
  logDate: "2026-06-01",
  nutritionPlanId: null,
  nutritionLogMeals: [
    {
      id: "lunch",
      mealId: null,
      nutritionPlanMealId: null,
      name: "Lunch",
      position: 0,
      slotTime: "12:00:00",
      nutritionLogEntries: [
        entry("rice", "Rice", 150, "lunch"),
        entry("chicken", "Chicken", 150, "lunch"),
      ],
    },
    {
      id: "snack",
      mealId: null,
      nutritionPlanMealId: null,
      name: "Snack",
      position: 1,
      slotTime: "12:00:00",
      nutritionLogEntries: [entry("yogurt", "Yogurt", 150, "snack")],
    },
  ],
  nutritionLogEntries: [entry("tea", "Tea", 10, null)],
};
const daily: DailyIntakeLogQuery = {
  nutritionDays: [day],
  dailyEnergyEntries: [],
  nutritionPlans: [],
  meals: [],
  foods: [],
};
type DeleteResult = { deleteNutritionLogMeal: { id: string } };
const deleteRequests: string[] = [];
let pendingDelete: { resolve: () => void; reject: (error: Error) => void } | undefined;
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode, variables: Record<string, unknown>) => {
    switch (getOperationAST(document)?.name?.value) {
      case "DailyIntakeLog":
        return Promise.resolve(structuredClone(daily));
      case "NutritionWeekStrip":
        return Promise.resolve({
          nutritionDays: [
            {
              id: day.id,
              logDate: day.logDate,
              nutritionLogEntries: [
                ...day.nutritionLogEntries,
                ...day.nutritionLogMeals.flatMap((group) => group.nutritionLogEntries),
              ],
            },
          ],
        });
      case "DeleteNutritionLogMeal": {
        const id = variables["id"];
        assert.equal(typeof id, "string");
        deleteRequests.push(id as string);
        const pending = Promise.withResolvers<DeleteResult>();
        pendingDelete = {
          reject: pending.reject,
          resolve: () => {
            const index = day.nutritionLogMeals.findIndex((group) => group.id === id);
            assert(index >= 0);
            day.nutritionLogMeals.splice(index, 1);
            pending.resolve({ deleteNutritionLogMeal: { id: id as string } });
          },
        };
        return pending.promise;
      }
      default:
        throw new Error("Unexpected GraphQL operation");
    }
  },
}));

// Exercise the production query/mutation and real Radix dialog, not a dialog mock.
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { DailyIntakeLog } = await import("@/components/daily-intake-log");
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: Number.POSITIVE_INFINITY },
    mutations: { gcTime: Number.POSITIVE_INFINITY },
  },
});
const todayKey = ["today", "overview", day.logDate, "test-user"];
client.setQueryData(todayKey, { cached: true });
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
  throw new Error(`Timed out waiting for UI: ${document.body.textContent}`);
}
function button(label: string, within: ParentNode = document.body) {
  const element = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => (item.getAttribute("aria-label") ?? item.textContent) === label,
  );
  assert(element, `Missing button: ${label}`);
  return element;
}
function dialog() {
  const element = document.querySelector<HTMLElement>('[role="dialog"]');
  assert(element, "Expected a confirmation dialog");
  return element;
}
function assertTotals(kcal: number) {
  const total = container.querySelector('[aria-label="Day summary"] strong');
  assert.equal(total?.textContent, String(kcal));
  const weekDay = container.querySelector('[aria-label="Week"] [aria-current="date"]');
  assert(weekDay?.getAttribute("aria-label")?.includes(`${kcal} kilocalories logged`));
}
function deletion() {
  assert(pendingDelete, "Expected a pending delete request");
  return pendingDelete;
}

try {
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <DailyIntakeLog date={day.logDate} />
      </QueryClientProvider>,
    ),
  );
  await waitFor(
    () =>
      container
        .querySelector('[aria-label="Week"] [aria-current="date"]')
        ?.getAttribute("aria-label")
        ?.includes("460 kilocalories logged") === true,
  );
  assertTotals(460);
  const trigger = button("Delete Lunch and its entries");
  assert(trigger.classList.contains("size-11"), "The delete target must remain 44 px square");
  assert(trigger.classList.contains("shrink-0"), "A narrow chip must not shrink the delete target");
  await settle(() => trigger.click());
  assert(dialog().textContent?.includes("Delete Lunch?"));
  assert(dialog().textContent?.includes("its 2 items"));
  assert(dialog().textContent?.includes("This can't be undone."));
  assert.equal(document.activeElement, button("Cancel", dialog()));
  assert.equal(deleteRequests.length, 0, "Opening confirmation must not delete anything");
  await settle(() => button("Cancel", dialog()).click());
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(deleteRequests.length, 0);
  assert.equal(day.nutritionLogMeals.length, 2);
  assertTotals(460);

  await settle(() => trigger.click());
  await settle(() => button("Delete meal", dialog()).click());
  assert.deepEqual(deleteRequests, ["lunch"]);
  assert(button("Deleting…", dialog()).disabled);
  assert(button("Cancel", dialog()).disabled);
  assert(trigger.disabled);
  // A failed mutation must preserve both the logged items and the confirmation for retry.
  await settle(() => deletion().reject(new Error("Connection interrupted")));
  await waitFor(() => !button("Delete meal", dialog()).disabled);
  assert.deepEqual(errors, ["Failed to delete logged meal: Connection interrupted"]);
  assert.equal(day.nutritionLogMeals.length, 2);
  assertTotals(460);

  await settle(() => button("Delete meal", dialog()).click());
  assert.deepEqual(deleteRequests, ["lunch", "lunch"]);
  await settle(() => deletion().resolve());
  await waitFor(
    () =>
      !document.querySelector('[role="dialog"]') &&
      container.querySelectorAll('[aria-label="Timeline"] li').length === 2 &&
      container
        .querySelector('[aria-label="Week"] [aria-current="date"]')
        ?.getAttribute("aria-label")
        ?.includes("160 kilocalories logged") === true,
  );
  assert(!container.textContent?.includes("Rice"));
  assert(!container.textContent?.includes("Chicken"));
  assert(container.textContent?.includes("Yogurt"));
  assert(container.textContent?.includes("Tea"));
  assertTotals(160);
  assert.equal(client.getQueryState(todayKey)?.isInvalidated, true);
  assert.deepEqual(successes, ["Logged meal deleted"]);

  // The remaining meal's trigger still selects its own id/count after the timeline refetch.
  await settle(() => button("Delete Snack and its entries").click());
  assert(dialog().textContent?.includes("Delete Snack?"));
  assert(dialog().textContent?.includes("its 1 item will be deleted"));
  await settle(() => button("Cancel", dialog()).click());
  assert.deepEqual(deleteRequests, ["lunch", "lunch"]);
} finally {
  act(() => root.unmount());
  client.clear();
  container.remove();
  await dom.happyDOM.abort();
  dom.close();
  mock.restore();
}
console.info(
  "Logged meal deletion requires confirmation, preserves failed deletes, and refreshes totals after success.",
);
