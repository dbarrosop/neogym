// Run in a subprocess: DOM globals and module mocks must not leak into other Bun tests.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window } from "happy-dom";
import { act, type ReactNode, useSyncExternalStore } from "react";

const dom = new Window({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  Node: window.Node,
  Element: window.Element,
  DocumentFragment: window.DocumentFragment,
  MutationObserver: window.MutationObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});

let owner: string | null = "account-a";
const authListeners = new Set<() => void>();
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => ({
    user: useSyncExternalStore(
      (listener) => {
        authListeners.add(listener);
        return () => authListeners.delete(listener);
      },
      () => owner,
    )
      ? { id: owner }
      : null,
  }),
}));
mock.module("@tanstack/react-router", () => ({
  useNavigate: () => () => undefined,
  Link: ({ children }: { children: ReactNode }) => <a href="#test">{children}</a>,
}));

const { todayLocalISO } = await import("@/lib/dates");
const { addLocalDateDays } = await import("@/lib/nutrition");
const today = todayLocalISO();

function dailyResponse(userId: string, caloriesIn: number, hasEnergy = true) {
  return {
    nutritionDays: [
      {
        id: `${userId}-day`,
        logDate: today,
        nutritionPlanId: null as string | null,
        nutritionLogMeals: [],
        nutritionLogEntries: [
          {
            id: `${userId}-entry`,
            source: "food",
            foodId: `${userId}-food`,
            nutritionLogMealId: null,
            grams: 100,
            position: 0,
            slotTime: "12:00:00",
            snapshotFoodName: `${userId} lunch`,
            snapshotKcalPer100g: caloriesIn,
            snapshotFatPer100g: 0,
            snapshotCarbsPer100g: 0,
            snapshotProteinPer100g: 0,
            snapshotFiberPer100g: 0,
            snapshotSugarPer100g: 0,
          },
        ],
      },
    ],
    dailyEnergyEntries: hasEnergy
      ? [
          {
            activeKcal: userId === "account-a" ? 777 : 200,
            restingKcal: userId === "account-a" ? 1000 : 600,
          },
        ]
      : [],
    nutritionPlans: [
      {
        id: "plan",
        name: "Test plan",
        nutritionPlanMeals: [],
        nutritionPlanFoods: [],
      },
    ],
    meals: [],
    foods: [],
  };
}

function estimateResponse(userId: string, hasEnergy = true) {
  const data = dailyResponse(userId, userId === "account-a" ? 600 : 90, hasEnergy);
  return {
    dailyEnergyEntries: [
      ...data.dailyEnergyEntries.map((entry) => ({ ...entry, energyOn: today })),
      {
        energyOn: addLocalDateDays(today, -1),
        activeKcal: null,
        restingKcal: userId === "account-a" ? 1600 : 1800,
      },
    ],
    nutritionDays: data.nutritionDays,
  };
}

type DailyResponse = ReturnType<typeof dailyResponse>;
const dailyResponses = new Map([
  ["account-a", dailyResponse("account-a", 600)],
  ["account-b", dailyResponse("account-b", 150, false)],
]);
const estimateResponses = new Map([
  ["account-a", estimateResponse("account-a")],
  ["account-b", estimateResponse("account-b", false)],
]);
const requests: { owner: string; operation: string; variables: Record<string, unknown> }[] = [];
const delayedDaily = new Map<string, Promise<DailyResponse>>();

mock.module("@/lib/graphql", () => ({
  gqlRequest: async (document: DocumentNode, variables: Record<string, unknown>) => {
    assert(owner, "No requests may start while signed out");
    const operation = getOperationAST(document)?.name?.value;
    assert(operation);
    requests.push({ owner, operation, variables });
    switch (operation) {
      case "DailyIntakeLog": {
        const pending = delayedDaily.get(owner);
        return pending ? await pending : structuredClone(dailyResponses.get(owner));
      }
      case "TodayEnergyEstimate":
        return structuredClone(estimateResponses.get(owner));
      case "UpdateNutritionLogEntry": {
        const entry = dailyResponses.get(owner)?.nutritionDays[0]?.nutritionLogEntries[0];
        assert(entry);
        assert.equal(variables["id"], entry.id);
        entry.grams = (variables["set"] as { grams: number }).grams;
        return { updateNutritionLogEntry: { id: entry.id } };
      }
      case "UpdateNutritionDayPlan": {
        const day = dailyResponses.get(owner)?.nutritionDays[0];
        assert(day);
        assert.equal(
          variables["id"],
          day.id,
          "ensureDay must use the current owner's exact cache key",
        );
        day.nutritionPlanId = variables["nutritionPlanId"] as string;
        return { updateNutritionDay: { id: day.id, nutritionPlanId: day.nutritionPlanId } };
      }
      default:
        throw new Error(`Unexpected operation: ${operation}`);
    }
  },
}));

// Import after DOM setup so React installs the real input event handling path.
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { DailyIntakeLog } = await import("@/components/daily-intake-log");
const { TodayEnergyEstimate } = await import("@/components/today-energy-estimate");
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false },
    // Mutation GC timers otherwise keep this isolated process alive after unmount.
    mutations: { gcTime: Number.POSITIVE_INFINITY },
  },
});
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const intakeKey = (userId: string) => ["nutrition", "days", today, userId];
const estimateKey = (userId: string) => ["nutrition", "energy-projection", today, userId];
const aBalance = {
  userId: "account-a",
  caloriesIn: 600,
  dailyEnergy: { activeKcal: 777, restingKcal: 1000 },
};
let foreignOverride = false;

function render() {
  root.render(
    <QueryClientProvider client={client}>
      <div id="intake">
        <DailyIntakeLog key={owner ?? "signed-out"} date={today} />
      </div>
      <div id="standalone">
        <TodayEnergyEstimate {...(foreignOverride ? { balance: aBalance } : {})} />
      </div>
    </QueryClientProvider>,
  );
}

function text(selector: string) {
  return container.querySelector(selector)?.textContent ?? "";
}

function estimateText(selector = "#intake") {
  const heading = [...container.querySelectorAll(`${selector} h3`)].find(
    (element) => element.textContent === "Estimated today",
  );
  return heading?.parentElement?.textContent ?? "";
}

function assertEstimate(selector: string, burned: number, net: number) {
  const format = (value: number, signed = false) =>
    `≈${value.toLocaleString(undefined, {
      maximumFractionDigits: 0,
      signDisplay: signed ? "exceptZero" : "auto",
    })} kcal`;
  const content = estimateText(selector);
  assert(content.includes(`Estimated burned today${format(burned)}`), content);
  assert(content.includes(`Estimated net today${format(net, true)}`), content);
  assert(!content.includes("Resting average:"), content);
  assert(!content.includes("Uses recent resting energy"), content);
}

async function settle(action: () => void = () => undefined) {
  await act(async () => {
    action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Each poll must flush React's async query notifications.
    await settle();
    if (condition()) {
      return;
    }
  }
  throw new Error(`Timed out waiting for UI: ${container.textContent}`);
}

async function signIn(userId: string | null) {
  await settle(() => {
    owner = userId;
    for (const listener of authListeners) {
      listener();
    }
    // Reopening the protected SPA route remounts its query without replacing the QueryClient.
    render();
  });
}

function cachedDay(data: DailyResponse) {
  return {
    ...structuredClone(data),
    day: structuredClone(data.nutritionDays[0]),
    dailyEnergy: structuredClone(data.dailyEnergyEntries[0] ?? null),
  };
}

function delayIntake(userId: string) {
  const pending = Promise.withResolvers<DailyResponse>();
  delayedDaily.set(userId, pending.promise);
  return async () => {
    delayedDaily.delete(userId);
    await settle(() =>
      pending.resolve(structuredClone(dailyResponses.get(userId) as DailyResponse)),
    );
  };
}

async function accountSwitchWithMissingToday() {
  // Legacy date-only data also remains in the same QueryClient across the SPA account switch.
  client.setQueryData(["nutrition", "days", today], cachedDay(dailyResponse("account-a", 600)));
  await settle(render);
  await waitFor(() => estimateText().includes("Estimated net today"));
  assertEstimate("#intake", 2377, -1777);
  assert(client.getQueryData(intakeKey("account-a")));
  const requestCount = requests.length;
  await signIn(null);
  assert.equal(text("#intake"), "");
  assert.equal(text("#standalone"), "");
  assert.equal(requests.length, requestCount);

  const finish = delayIntake("account-b");
  await signIn("account-b");
  await waitFor(() => estimateText("#standalone").includes("Not enough energy data."));
  assert.equal(client.getQueryState(intakeKey("account-b"))?.fetchStatus, "fetching");
  assert(!text("#intake").includes("account-a"));
  assert(!text("#intake").includes("≈"));
  assert(!estimateText("#standalone").includes("≈"));
  foreignOverride = true;
  await settle(render);
  assert(estimateText("#standalone").includes("Not enough energy data."));
  await finish();
  await waitFor(() => estimateText().includes("Not enough energy data."));
  assert(!estimateText().includes("Estimated burned today"));
  assert(!estimateText().includes("≈"));
  assert(text("#intake").includes("No energy logged"));
}

async function cachedBalancesStayOwnerScoped() {
  dailyResponses.set("account-b", dailyResponse("account-b", 900));
  estimateResponses.set("account-b", estimateResponse("account-b"));
  await signIn(null);
  client.setQueryData(intakeKey("account-b"), cachedDay(dailyResponse("account-b", 900)));
  client.setQueryData(estimateKey("account-b"), estimateResponse("account-b"));
  await signIn("account-a");
  assertEstimate("#intake", 2377, -1777);
  await signIn(null);
  const finish = delayIntake("account-b");
  await signIn("account-b");
  assert.equal(client.getQueryState(intakeKey("account-b"))?.fetchStatus, "fetching");
  assertEstimate("#intake", 2000, -1100);
  assert(!text("#intake").includes("account-a"));
  // A mismatched override must use B's scoped response, including B's food total.
  assertEstimate("#standalone", 2000, -1910);
  await finish();
  assertEstimate("#intake", 2000, -1100);
}

function findElement<T extends Element>(selector: string): T {
  const element = container.querySelector<T>(selector);
  assert(element, `Missing element: ${selector}`);
  return element;
}

async function foodEditsAndEnsureDay() {
  const estimateRequestCount = requests.filter(
    (request) => request.operation === "TodayEnergyEstimate",
  ).length;
  const intakeRequestCount = requests.filter(
    (request) => request.operation === "DailyIntakeLog",
  ).length;
  // Logged time slots are always expanded, so the entry's grams button is visible directly.
  await settle(() =>
    findElement<HTMLButtonElement>('#intake button[title="Click to edit grams"]').click(),
  );
  const input = findElement<HTMLInputElement>(
    '#intake input[aria-label="Grams for account-b lunch"]',
  );
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  await settle(() => {
    setter.call(input, "200");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const save = [...container.querySelectorAll<HTMLButtonElement>("#intake button")].find(
    (button) => button.textContent?.trim() === "Save",
  );
  assert(save);
  await settle(() => save.click());
  await waitFor(() => estimateText().includes("≈-200 kcal"));
  assertEstimate("#intake", 2000, -200);
  assertEstimate("#standalone", 2000, -1910);
  assert.equal(
    requests.filter((request) => request.operation === "TodayEnergyEstimate").length,
    estimateRequestCount,
    "Live intake totals must update without a sibling estimate refetch",
  );
  assert(
    requests.filter((request) => request.operation === "DailyIntakeLog").length >
      intakeRequestCount,
    "The date-prefix invalidation must refetch the owner-scoped day after food edits",
  );

  const select = findElement<HTMLSelectElement>(
    '#intake select[aria-label="Selected nutrition plan"]',
  );
  await settle(() => {
    select.value = "plan";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await waitFor(() => requests.some((request) => request.operation === "UpdateNutritionDayPlan"));
  const update = requests.find((request) => request.operation === "UpdateNutritionDayPlan");
  assert.equal(update?.variables["id"], "account-b-day");
  assert(!requests.some((request) => request.operation === "CreateNutritionDay"));
  assert.equal(
    client.getQueryData<{ day: { id: string } }>(intakeKey("account-a"))?.day.id,
    "account-a-day",
  );
}

try {
  await accountSwitchWithMissingToday();
  await cachedBalancesStayOwnerScoped();
  await foodEditsAndEnsureDay();
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info(
  "Daily intake isolates accounts across sign-out and delayed refetches; food-edit invalidation and exact ensureDay lookup remain live.",
);
