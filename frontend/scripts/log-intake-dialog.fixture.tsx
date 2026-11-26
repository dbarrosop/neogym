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
  PointerEvent: window.PointerEvent,
  getComputedStyle: window.getComputedStyle.bind(window),
  // Radix tabs schedule a frame on mount.
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
mock.module("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
const successes: string[] = [];
mock.module("sonner", () => ({
  toast: { success: (message: string) => successes.push(message), error: () => {} },
}));
const requests: { operation: string; object: Record<string, unknown> }[] = [];
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode, variables: { object: Record<string, unknown> }) => {
    const operation = getOperationAST(document)?.name?.value ?? "";
    requests.push({ operation, object: variables.object });
    return Promise.resolve({ insertNutritionLogEntry: { id: "new" } });
  },
}));

const kvarg = {
  id: "kvarg",
  name: "Kvarg naturell",
  isPublic: false,
  userId: "me",
  kcalPer100g: 60,
  proteinPer100g: 10,
  carbsPer100g: 4,
  fatPer100g: 0.2,
  fiberPer100g: 0,
  sugarPer100g: 4,
};
const meal = {
  id: "oats",
  name: "Overnight oats",
  mealIngredients: [{ id: "i1", grams: 200, position: 0, food: kvarg }],
};

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { LogIntakeDialog } = await import("@/components/log-intake-dialog");
const client = new QueryClient({
  defaultOptions: { mutations: { gcTime: Number.POSITIVE_INFINITY } },
});
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const valueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  "value",
)?.set;

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
function dialog() {
  const element = document.querySelector<HTMLElement>('[role="dialog"]');
  assert(element, "Expected the log intake dialog");
  return element;
}
function button(label: string, within: ParentNode = document.body) {
  const match = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => (element.getAttribute("aria-label") ?? element.textContent?.trim()) === label,
  );
  assert(match, `Missing button: ${label}`);
  return match;
}
async function selectTab(name: string) {
  const tab = [...dialog().querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (element) => element.textContent === name,
  );
  assert(tab, `Missing tab: ${name}`);
  // Radix tabs activate on mousedown.
  await settle(() => tab.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })));
}

try {
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <LogIntakeDialog
          ensureDay={() => Promise.resolve("day")}
          date="2026-06-01"
          foods={[kvarg]}
          meals={[meal]}
          selectedPlan={null}
          nextEntryPosition={3}
          nextGroupPosition={1}
          triggerLabel="Log food"
          triggerVariant="default"
        />
      </QueryClientProvider>,
    ),
  );
  await settle(() => button("Log food").click());
  assert(dialog().textContent?.includes("Log intake"));
  assert(dialog().textContent?.includes("Time eaten defaults to now and stays editable"));
  assert(
    dialog().textContent?.includes(
      "Planned slot times are suggestions only. Custom logs a one-off item with its own per-100 g values.",
    ),
  );
  // Without a plan there is no From plan tab; tabs have no icons.
  const tabs = [...dialog().querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
  assert.deepEqual(tabs, ["Food", "Meal", "Custom"]);

  // The select-like food picker is named by its visible label; grams sit beside the time.
  const grams = dialog().querySelector<HTMLInputElement>("#log-intake-grams");
  assert(grams?.disabled, "Grams wait for a food");
  const trigger = dialog().querySelector<HTMLButtonElement>("#log-intake-food");
  assert.equal(trigger?.getAttribute("role"), "combobox");
  assert(dialog().querySelector('label[for="log-intake-food"]'));
  await settle(() => trigger?.click());
  const option = document.querySelector<HTMLElement>('[role="option"]');
  assert(option, "The picker lists foods");
  await settle(() => option.click());
  assert.equal(dialog().querySelector<HTMLInputElement>("#log-intake-grams")?.value, "100");
  await settle(() => {
    const input = dialog().querySelector<HTMLInputElement>("#log-intake-grams");
    assert(input && valueSetter);
    valueSetter.call(input, "300");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  // Preview: kcal, then P · C · F with one decimal below 10 g.
  assert(dialog().textContent?.includes("180 kcal"));
  assert(dialog().textContent?.includes("P 30 · C 12 · F 0.6"));

  // A meal lists its ingredients with grams and confirms with "Log meal".
  await selectTab("Meal");
  assert.equal(
    dialog().querySelector("#log-intake-grams"),
    null,
    "Meals have per-ingredient grams",
  );
  await settle(() => dialog().querySelector<HTMLButtonElement>("#log-intake-meal")?.click());
  await settle(() => document.querySelector<HTMLElement>('[role="option"]')?.click());
  assert(dialog().querySelector('input[aria-label="Grams for Kvarg naturell"]'));
  button("Log meal", dialog());

  // Back to the food: Log food writes one standalone entry at the chosen time.
  await selectTab("Food");
  await settle(() => dialog().querySelector<HTMLButtonElement>("#log-intake-food")?.click());
  await settle(() => document.querySelector<HTMLElement>('[role="option"]')?.click());
  await settle(() => button("Log food", dialog()).click());
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.operation, "LogFood");
  assert.equal(requests[0]?.object["foodId"], "kvarg");
  assert.equal(requests[0]?.object["grams"], 100);
  assert.equal(requests[0]?.object["position"], 3);
  assert.deepEqual(successes, ["Food logged"]);
  assert.equal(document.querySelector('[role="dialog"]'), null, "The dialog closes after logging");
} finally {
  act(() => root.unmount());
  client.clear();
  container.remove();
  await dom.happyDOM.abort();
  dom.close();
  mock.restore();
}
console.info("Log intake dialog names its pickers, previews macros and logs food or a meal.");
