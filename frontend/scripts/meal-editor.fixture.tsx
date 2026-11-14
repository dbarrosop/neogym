// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act, type ReactNode } from "react";

const dom = new Window({ url: "http://localhost", width: 1280, height: 900 });
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

let currentMealId = "breakfast";
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ mealId: currentMealId }),
  }),
  useNavigate: () => () => undefined,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
mock.module("@/components/breadcrumbs", () => ({ Breadcrumbs: () => null }));

const food = (id: string, name: string, kcal: number, isPublic: boolean) => ({
  id,
  name,
  userId: isPublic ? null : "test-user",
  isPublic,
  kcalPer100g: kcal,
  fatPer100g: 1,
  carbsPer100g: 2,
  proteinPer100g: 10,
  fiberPer100g: 0,
  sugarPer100g: 0,
});
const foods = [food("skyr", "Skyr natural", 63, false), food("oats", "Rolled oats", 379, true)];
const meals: Record<string, unknown> = {
  breakfast: {
    id: "breakfast",
    name: "Breakfast",
    description: "Oats and skyr",
    mealIngredients: [
      { id: "i1", foodId: "oats", grams: 60, position: 0 },
      { id: "i2", foodId: "skyr", grams: 200, position: 1 },
    ],
    nutritionPlanMeals: [
      { id: "s1", nutritionPlan: { id: "cut", name: "Cut" } },
      { id: "s2", nutritionPlan: { id: "maintenance", name: "Maintenance ~2200" } },
      { id: "s3", nutritionPlan: { id: "maintenance", name: "Maintenance ~2200" } },
    ],
  },
  shake: {
    id: "shake",
    name: "Recovery shake",
    description: null,
    mealIngredients: [{ id: "i3", foodId: "skyr", grams: 300, position: 0 }],
    nutritionPlanMeals: [],
  },
};

type Document = { definitions: Array<{ name?: { value: string } }> };
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: Document, variables?: { id?: string }) => {
    const operation = document.definitions[0]?.name?.value;
    if (operation === "EditMeal") {
      return Promise.resolve({ meal: meals[variables?.id ?? ""] ?? null });
    }
    if (operation === "MealFormFoods") {
      return Promise.resolve({ foods });
    }
    return Promise.reject(new Error(`Unexpected ${operation}`));
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Route: EditMeal } = await import("@/routes/_authed/nutrition/meals/$mealId_.edit");

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
let container = document.createElement("div");
let root = createRoot(container);

async function show(mealId: string) {
  const Component = EditMeal.options.component;
  assert(Component);
  currentMealId = mealId;
  act(() => root.unmount());
  container.remove();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Component />
      </QueryClientProvider>,
    );
  });
  await waitFor(() => container.querySelector('[aria-label="Grams of Skyr natural"]'));
}

async function waitFor<T>(read: () => T | null | undefined | false, timeoutMs = 2_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = read();
    if (value) {
      return value;
    }
    // biome-ignore lint/performance/noAwaitInLoops: Flush React/query notifications between polls.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error("Timed out waiting for the meal editor");
}

function button(label: string) {
  const element = container.querySelector(`button[aria-label="${label}"]`);
  assert(element instanceof window.HTMLButtonElement, `button "${label}"`);
  return element;
}

function buttonByText(text: string) {
  const element = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  assert(element, `button with text "${text}"`);
  return element;
}

function rowTexts() {
  return [...container.querySelectorAll("li")].map((row) =>
    [...row.querySelectorAll("p")].map((cell) => cell.textContent),
  );
}

async function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  await act(() => {
    setter.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

try {
  await show("breakfast");

  // Ingredients card: heading with count, rows in position order, per-row kcal.
  const heading = [...container.querySelectorAll("h2")].find((h) =>
    h.textContent?.startsWith("Ingredients"),
  );
  assert.equal(heading?.textContent, "Ingredients · 2");
  assert.deepEqual(rowTexts(), [["227 kcal"], ["126 kcal"]]);
  const pickers = [...container.querySelectorAll('button[role="combobox"]')];
  assert.deepEqual(
    pickers.map((picker) => [picker.getAttribute("aria-label"), picker.textContent]),
    [
      ["Food for ingredient 1", "Rolled oatspublic"],
      ["Food for ingredient 2", "Skyr natural"],
    ],
  );

  // Row actions are named after their food; the ends can't move further.
  assert.equal(button("Move Rolled oats up").disabled, true);
  assert.equal(button("Move Rolled oats down").disabled, false);
  assert.equal(button("Move Skyr natural down").disabled, true);
  assert(button("Remove Skyr natural"));

  // Grams edits update the row and the live totals beside the form.
  const totals = () =>
    container.querySelector('section[aria-label="Live meal totals"]')?.textContent ?? "";
  assert(totals().includes("353 kcal"), totals());
  const oatsGrams = container.querySelector('input[aria-label="Grams of Rolled oats"]');
  assert(oatsGrams instanceof window.HTMLInputElement);
  assert.equal(oatsGrams.value, "60");
  await typeInto(oatsGrams, "100");
  assert.deepEqual(rowTexts(), [["379 kcal"], ["126 kcal"]]);
  assert(totals().includes("505 kcal"), totals());
  await typeInto(oatsGrams, "");
  assert.deepEqual(rowTexts(), [["—"], ["126 kcal"]]);

  // Reordering moves the row and its names.
  await act(() => button("Move Skyr natural up").click());
  assert.equal(button("Move Skyr natural up").disabled, true);
  assert.equal(button("Move Rolled oats down").disabled, true);

  // Plans that use the meal block delete, each named once.
  const danger = [...container.querySelectorAll("section")].find((section) =>
    section.textContent?.startsWith("Delete this meal"),
  );
  assert(danger);
  assert(
    danger.textContent?.includes(
      "Used in 2 plans (Cut, Maintenance ~2200). Remove it there first.",
    ),
    danger.textContent ?? "",
  );
  assert.equal(buttonByText("Delete meal").disabled, true);

  // An unused meal can be deleted; the confirmation names it.
  await show("shake");
  assert.equal(container.textContent?.includes("Used in"), false);
  assert(container.textContent?.includes("Days already logged keep their snapshot."));
  const deleteButton = buttonByText("Delete meal");
  assert.equal(deleteButton.disabled, false);
  await act(() => deleteButton.click());
  const confirm = await waitFor(() => document.querySelector('[role="alertdialog"]'));
  assert.equal(confirm.querySelector("h2")?.textContent, "Delete Recovery shake?");
  assert(confirm.textContent?.includes("This can't be undone."));
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("The meal editor shows per-row kcal, named row actions and blocks plan-used deletes.");
