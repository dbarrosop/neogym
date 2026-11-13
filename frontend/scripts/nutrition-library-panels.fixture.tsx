// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act, type ReactNode } from "react";

const dom = new Window({ url: "http://localhost", width: 1280, height: 900 });
const window = dom as unknown as typeof globalThis.window;
let wide = true;
Object.assign(window, {
  matchMedia: () => ({
    get matches() {
      return wide;
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }),
});
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});

let currentSearch: Record<string, string | undefined> = {};
type LinkProps = {
  to: string;
  params?: Record<string, string>;
  search?: (prev: Record<string, unknown>) => { selected?: unknown };
  children: ReactNode;
  className?: string;
  "aria-current"?: "true";
};
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => currentSearch,
    useNavigate: () => () => undefined,
  }),
  Link: ({ to, params, search, children, className, ...rest }: LinkProps) => {
    const path = Object.entries(params ?? {}).reduce(
      (href, [key, value]) => href.replace(`$${key}`, value),
      to,
    );
    const selected = search ? String(search({}).selected) : undefined;
    return (
      <a
        href={selected ? `${path}?selected=${selected}` : path}
        className={className}
        aria-current={rest["aria-current"]}
      >
        {children}
      </a>
    );
  },
}));
mock.module("@/lib/graphql", () => ({
  gqlRequest: () => {
    throw new Error("Library panels must render the seeded query data");
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Route: Foods } = await import("@/routes/_authed/nutrition/foods/index");
const { Route: Meals } = await import("@/routes/_authed/nutrition/meals/index");

const food = (id: string, name: string, kcal: number, isPublic = false) => ({
  id,
  name,
  userId: isPublic ? null : "test-user",
  isPublic,
  kcalPer100g: kcal,
  fatPer100g: 1,
  carbsPer100g: 2,
  proteinPer100g: 3,
  fiberPer100g: 0,
  sugarPer100g: 0,
});
const oats = food("oats", "Rolled oats", 379, true);
const skyr = food("skyr", "Skyr natural", 63);
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
});
client.setQueryData(["nutrition", "foods", "index"], { foods: [oats, skyr] });
client.setQueryData(["nutrition", "meals", "index"], {
  meals: [
    {
      id: "breakfast",
      name: "Breakfast",
      description: "Oats and skyr",
      updatedAt: "2026-11-10T00:00:00Z",
      mealIngredients: [
        { id: "i1", grams: 60, position: 0, food: oats },
        { id: "i2", grams: 200, position: 1, food: skyr },
      ],
    },
    {
      id: "shake",
      name: "Recovery shake",
      description: null,
      updatedAt: "2026-11-09T00:00:00Z",
      mealIngredients: [{ id: "i3", grams: 300, position: 0, food: skyr }],
    },
  ],
});

let container = document.createElement("div");
let root = createRoot(container);
async function show(route: typeof Foods | typeof Meals) {
  const Component = route.options.component;
  assert(Component);
  // Each visit mounts fresh, as navigating between routes does.
  act(() => root.unmount());
  container.remove();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Component />
      </QueryClientProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
function panel(label: string) {
  return container.querySelector(`aside[aria-label="${label}"]`);
}
function tableLinks() {
  return [...container.querySelectorAll("table a")].map((link) => ({
    href: link.getAttribute("href"),
    current: link.getAttribute("aria-current"),
  }));
}

try {
  // Wide: the first row is selected by default and rows select instead of navigating.
  await show(Foods);
  assert.equal(panel("Selected food")?.querySelector("h2")?.textContent, "Rolled oats");
  assert(panel("Selected food")?.textContent?.includes("Public foods are read-only"));
  assert.equal(panel("Selected food")?.querySelector('a[href$="/edit"]'), null, "Public: no Edit");
  assert.deepEqual(tableLinks(), [
    { href: "/nutrition/foods?selected=oats", current: "true" },
    { href: "/nutrition/foods?selected=skyr", current: null },
  ]);

  currentSearch = { selected: "skyr" };
  await show(Foods);
  assert.equal(panel("Selected food")?.querySelector("h2")?.textContent, "Skyr natural");
  assert(panel("Selected food")?.querySelector('a[href="/nutrition/foods/skyr/edit"]'));

  currentSearch = { selected: "missing" };
  await show(Meals);
  assert.equal(panel("Selected meal")?.querySelector("h2")?.textContent, "Breakfast");
  assert.equal(panel("Selected meal")?.querySelectorAll("li").length, 2);

  currentSearch = { selected: "shake" };
  await show(Meals);
  assert.equal(panel("Selected meal")?.querySelector("h2")?.textContent, "Recovery shake");

  // Below 1100 px: no panel, rows open the detail page.
  wide = false;
  await show(Meals);
  assert.equal(panel("Selected meal"), null);
  assert.deepEqual(
    tableLinks().map((link) => link.href),
    ["/nutrition/meals/breakfast", "/nutrition/meals/shake"],
  );
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("Foods and Meals select rows into a side panel from 1100 px and link below it.");
