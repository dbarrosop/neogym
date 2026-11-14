// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act, type ReactNode, useState } from "react";

const dom = new Window({ url: "http://localhost" });
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
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

const { createRoot } = await import("react-dom/client");
const { FoodPicker } = await import("@/components/food-picker");
const { MealPicker } = await import("@/components/meal-picker");

const food = (id: string, name: string, isPublic: boolean) => ({
  id,
  name,
  isPublic,
  kcalPer100g: 100,
  fatPer100g: 1,
  carbsPer100g: 2,
  proteinPer100g: 3,
  fiberPer100g: 0,
  sugarPer100g: 0,
});
const chia = food("chia", "Chia seeds", false);
const foods = [chia, food("kvarg", "Kvarg naturell 0%", true), food("orange", "Orange", true)];
const meals = [
  {
    id: "breakfast",
    name: "Breakfast",
    mealIngredients: [{ id: "i1", position: 1, grams: 30, foodId: "chia", food: chia }],
  },
];

const changes: string[] = [];

function Harness() {
  const [foodId, setFoodId] = useState("");
  const [selectFoodId, setSelectFoodId] = useState("chia");
  const [mealId, setMealId] = useState("");
  return (
    <div>
      <label htmlFor="food-search">Food</label>
      <FoodPicker
        id="food-search"
        foods={foods}
        value={foodId}
        onChange={(next) => {
          changes.push(`search:${next}`);
          setFoodId(next);
        }}
      />
      <span id="ingredient-label">Ingredient 1</span>
      <FoodPicker
        mode="select"
        aria-labelledby="ingredient-label"
        foods={foods}
        value={selectFoodId}
        onChange={(next) => {
          changes.push(`select:${next}`);
          setSelectFoodId(next);
        }}
      />
      <MealPicker meals={meals} value={mealId} onChange={setMealId} mode="select" />
    </div>
  );
}

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
await act(() => root.render(<Harness />));

const query = <T extends Element>(selector: string) => {
  const element = container.querySelector<T>(selector);
  assert(element, `Missing ${selector}`);
  return element;
};
const key = async (target: Element, value: string) =>
  act(() => {
    target.dispatchEvent(new window.KeyboardEvent("keydown", { key: value, bubbles: true }));
  });
const type = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  assert(setter);
  await act(() => {
    setter.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
};

// Search mode: the labelled input is the combobox.
const search = query<HTMLInputElement>("#food-search");
assert.equal(search.getAttribute("role"), "combobox");
assert.equal(search.getAttribute("aria-label"), null, "a <label for> names it; no override");
assert.equal(search.getAttribute("aria-expanded"), "false");
await act(() => search.focus());
assert.equal(search.getAttribute("aria-expanded"), "true");
const listboxId = search.getAttribute("aria-controls");
assert(listboxId);
const listbox = document.getElementById(listboxId);
assert.equal(listbox?.getAttribute("role"), "listbox");
assert.equal(listbox?.querySelectorAll('[role="option"]').length, 3);
assert.equal(
  listbox?.querySelectorAll('[role="option"]')[1]?.textContent?.includes("public"),
  true,
);

await type(search, "orang");
assert.equal(listbox?.isConnected, true);
const firstMatch = search.getAttribute("aria-activedescendant");
assert(firstMatch, "typing highlights the first match");
assert.equal(document.getElementById(firstMatch)?.textContent?.startsWith("Orange"), true);
await key(search, "Enter");
assert.deepEqual(changes, ["search:orange"]);
assert.equal(search.value, "Orange");
assert.equal(search.getAttribute("aria-expanded"), "false");

// Escape closes the list before any dialog listening on the document sees it.
let documentEscapes = 0;
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") {
      documentEscapes += 1;
    }
  },
  { capture: true },
);
await key(search, "ArrowDown");
assert.equal(search.getAttribute("aria-expanded"), "true");
await key(search, "Escape");
assert.equal(search.getAttribute("aria-expanded"), "false");
assert.equal(documentEscapes, 0);
await key(search, "Escape");
assert.equal(documentEscapes, 1, "a closed picker lets Escape through");

// Select mode: a labelled trigger showing the choice, then a search panel.
const trigger = query<HTMLButtonElement>('button[aria-labelledby="ingredient-label"]');
assert.equal(trigger.getAttribute("role"), "combobox");
assert.equal(trigger.getAttribute("aria-haspopup"), "listbox");
assert.equal(trigger.textContent, "Chia seeds");
await act(() => trigger.click());
assert.equal(trigger.getAttribute("aria-expanded"), "true");
const panelSearch = query<HTMLInputElement>('input[aria-label="Search foods"]');
assert.equal(document.activeElement, panelSearch, "the panel's search field takes focus");
const selectListbox = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
assert(selectListbox);
assert.equal(
  selectListbox.querySelector('[aria-selected="true"]')?.textContent?.startsWith("Chia seeds"),
  true,
);
await key(panelSearch, "ArrowDown");
await key(panelSearch, "Enter");
assert.deepEqual(changes, ["search:orange", "select:kvarg"]);
assert.equal(trigger.getAttribute("aria-expanded"), "false");
assert.equal(document.activeElement, trigger, "choosing returns focus to the trigger");
assert.equal(trigger.textContent?.startsWith("Kvarg naturell 0%"), true);
assert.equal(trigger.textContent?.includes("public"), true);

await act(() => trigger.click());
await key(query<HTMLInputElement>('input[aria-label="Search foods"]'), "Escape");
assert.equal(trigger.getAttribute("aria-expanded"), "false");
assert.equal(document.activeElement, trigger);

// Unnamed pickers fall back to their own name.
const mealTrigger = query<HTMLButtonElement>('button[aria-label="Meal"]');
assert.equal(mealTrigger.textContent, "Choose a meal");

await act(() => root.unmount());
process.stdout.write("Food and meal pickers expose combobox, listbox and keyboard behaviour.\n");
