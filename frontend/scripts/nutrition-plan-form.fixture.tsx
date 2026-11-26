// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
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
  KeyboardEvent: window.KeyboardEvent,
  getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
mock.module("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  // The quick meal dialog's form imports the form-page breadcrumbs.
  useRouterState: () => "/nutrition/plans/new",
}));
const infos: string[] = [];
mock.module("sonner", () => ({
  toast: { info: (message: string) => infos.push(message), success: () => {}, error: () => {} },
}));

const food = (id: string, name: string, kcal: number, protein: number) => ({
  id,
  name,
  userId: "me",
  isPublic: false,
  kcalPer100g: kcal,
  proteinPer100g: protein,
  fatPer100g: 1,
  carbsPer100g: 10,
  fiberPer100g: 0,
  sugarPer100g: 0,
});
const bread = food("bread", "White bread", 260, 9);
const jam = food("jam", "Jam", 185, 0.5);
const kvarg = food("kvarg", "Kvarg naturell", 60, 10);
const meal = {
  id: "dinner",
  name: "Dinner",
  description: null,
  mealIngredients: [{ id: "i1", grams: 300, position: 0, food: kvarg }],
};
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode) => {
    assert.equal(getOperationAST(document)?.name?.value, "NutritionPlanFormPickers");
    return Promise.resolve({ meals: [meal], foods: [bread, jam, kvarg] });
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { NutritionPlanForm } = await import("@/components/nutrition-plan-form");
const { formatTimeOfDay } = await import("@/lib/nutrition");
type Values = Parameters<Parameters<typeof NutritionPlanForm>[0]["onSubmit"]>[0];

const submissions: Values[] = [];
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const valueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  "value",
)?.set;
assert(valueSetter);

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 10));
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
function slots() {
  return [...container.querySelectorAll<HTMLElement>('section[aria-label^="Time slot "]')];
}
function slot(time: string) {
  // Compare attributes directly: locale times can contain U+202F before AM/PM.
  const label = `Time slot ${formatTimeOfDay(time)}`;
  const element = slots().find((section) => section.getAttribute("aria-label") === label);
  assert(element, `Missing the ${time} slot`);
  return element;
}
function rowNames(section: HTMLElement) {
  return [...section.querySelectorAll("li")].map(
    (row) => row.querySelector("[data-picker-trigger]")?.textContent ?? "",
  );
}
function button(label: string, within: ParentNode = document.body) {
  const match = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => (element.getAttribute("aria-label") ?? element.textContent?.trim()) === label,
  );
  assert(match, `Missing button: ${label}`);
  return match;
}
async function type(input: HTMLInputElement, value: string) {
  await settle(() => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
async function setSlotTime(time: string, next: string) {
  const input = slot(time).querySelector<HTMLInputElement>('input[type="time"]');
  assert(input);
  await settle(() => input.focus());
  await type(input, next);
  await settle(() => input.blur());
}
async function submit() {
  const form = container.querySelector("form");
  assert(form);
  await settle(() => form.requestSubmit());
}

try {
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <NutritionPlanForm
          initialValues={{
            name: "Cut",
            description: "",
            entries: [
              {
                kind: "food",
                id: "f1",
                foodId: "bread",
                grams: 110,
                slotTime: "07:15:00",
                label: "",
                position: 0,
              },
              {
                kind: "food",
                id: "f2",
                foodId: "jam",
                grams: 40,
                slotTime: "07:15:00",
                label: "",
                position: 1,
              },
              {
                kind: "food",
                id: "f3",
                foodId: "kvarg",
                grams: 300,
                slotTime: "09:30:00",
                label: "",
                position: 0,
              },
              {
                kind: "meal",
                id: "m1",
                mealId: "dinner",
                slotTime: "17:30:00",
                label: "",
                position: 0,
              },
            ],
          }}
          submitLabel="Save"
          isSubmitting={false}
          onSubmit={(values) => submissions.push(values)}
          onCancel={() => undefined}
        />
      </QueryClientProvider>,
    ),
  );
  await waitFor(() => slots().length === 3 && rowNames(slot("07:15"))[0] === "White bread");
  assert.deepEqual(rowNames(slot("07:15")), ["White bread", "Jam"]);
  // The details card shows the live planned total; rows name their controls after the item.
  assert(container.textContent?.includes("Planned total"));
  button("Remove Jam");
  button("More actions for White bread");
  assert(container.querySelector('input[aria-label="White bread grams"]'));
  assert(slot("07:15").textContent?.includes("kcal · P"));

  const originalTime = slot("07:15").querySelector<HTMLInputElement>('input[type="time"]');
  assert(originalTime);
  await settle(() => originalTime.focus());
  await type(originalTime, "07:30");
  await settle(() =>
    originalTime.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  const breakfastTime = slot("07:30").querySelector<HTMLInputElement>('input[type="time"]');
  assert(breakfastTime);
  assert.notEqual(breakfastTime, originalTime, "Retiming recreates the time-keyed card");
  assert.equal(document.activeElement, breakfastTime, "Enter restores focus to the new Time input");
  assert.equal(submissions.length, 0, "Enter commits the time without submitting the form");

  // Typing a time that passes through another slot's time never merges until it is committed.
  await type(breakfastTime, "09:30");
  assert.equal(slots().length, 3, "The slot time waits for blur or Enter");
  // Tab to a control in the departing card: its blur commits and merges the slot.
  await settle(() => button("More actions for Jam", slot("07:30")).focus());
  await waitFor(() => slots().length === 2);
  assert.equal(document.activeElement, slot("09:30").querySelector('input[type="time"]'));
  assert.deepEqual(rowNames(slot("09:30")), ["Kvarg naturell", "White bread", "Jam"]);
  assert.deepEqual(infos, [`Joined the ${formatTimeOfDay("09:30")} slot`]);

  // An empty slot appears an hour after the latest one and is not saved until it has an entry.
  await settle(() => button("Add time slot").click());
  assert(slot("18:30").textContent?.includes("Empty, not saved"));
  await setSlotTime("18:30", "20:00");
  await settle(() => button(`Add food at ${formatTimeOfDay("20:00")}`).click());
  assert(!slot("20:00").textContent?.includes("Empty, not saved"));
  assert.equal(slot("20:00").querySelectorAll("li").length, 1);
  assert(document.querySelector('[role="listbox"]'), "+ Food opens the new row's food picker");

  // An unchosen food blocks saving with a message; removing the row clears it.
  await submit();
  assert.equal(submissions.length, 0);
  assert(container.textContent?.includes("Every food entry needs a selected food."));
  await settle(() => button("Remove new food").click());
  assert.equal(slots().length, 2, "Removing the only entry removes its slot");

  // The row menu moves one entry to another time; it joins that slot at the end.
  await settle(() => button("More actions for Kvarg naturell").click());
  const menu = document.querySelector('[role="menu"]');
  assert(menu, "The row menu opens");
  // Kvarg is first in its slot, so focus starts on the first enabled item.
  assert(button("Move up", menu).disabled);
  assert.equal(document.activeElement?.textContent, "Move down");
  await settle(() => button("Move to another time…", menu).click());
  const prompt = document.querySelector<HTMLElement>('[role="dialog"]');
  assert(prompt, "Move to another time opens a prompt");
  assert(prompt.textContent?.includes("Move Kvarg naturell"));
  const promptTime = prompt.querySelector<HTMLInputElement>('input[type="time"]');
  assert(promptTime);
  await type(promptTime, "17:30");
  await settle(() => button("Move", prompt).click());
  await waitFor(() => !document.querySelector('[role="dialog"]'));
  assert.deepEqual(rowNames(slot("17:30")), ["Dinner", "Kvarg naturell"]);
  assert.equal(document.activeElement, button("More actions for Kvarg naturell", slot("17:30")));
  assert.deepEqual(rowNames(slot("09:30")), ["White bread", "Jam"]);

  // Move down keeps the entry inside its slot.
  await settle(() => button("More actions for White bread").click());
  await settle(() =>
    button("Move down", document.querySelector('[role="menu"]') ?? document).click(),
  );
  assert.deepEqual(rowNames(slot("09:30")), ["Jam", "White bread"]);

  await submit();
  assert.equal(submissions.length, 1);
  assert.deepEqual(
    submissions[0]?.entries.map((entry) => [
      entry.kind === "food" ? entry.foodId : entry.mealId,
      entry.slotTime,
      entry.position,
      entry.id,
    ]),
    [
      ["jam", "09:30", 0, "f2"],
      ["bread", "09:30", 1, "f1"],
      ["dinner", "17:30", 0, "m1"],
      ["kvarg", "17:30", 1, "f3"],
    ],
  );
} finally {
  act(() => root.unmount());
  client.clear();
  container.remove();
  await dom.happyDOM.abort();
  dom.close();
  mock.restore();
}
console.info(
  "Plan editor slots retime and merge on commit, add empty slots and rows, and move entries between times.",
);
