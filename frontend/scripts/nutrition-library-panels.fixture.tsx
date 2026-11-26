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
let owner: string | null = "test-user";
let requests = 0;
let response: (() => Promise<never>) | null = null;
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => ({ user: owner ? { id: owner } : null }),
}));
mock.module("@/lib/graphql", () => ({
  gqlRequest: () => {
    requests++;
    if (!response) {
      throw new Error("Library panels must render the seeded query data");
    }
    return response();
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
client.setQueryData(["nutrition", "foods", "index", owner], { foods: [oats, skyr] });
client.setQueryData(["nutrition", "meals", "index", owner], {
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
/** Title, visible meta line and trailing value of each phone-list row. */
function listRows() {
  return [...container.querySelectorAll("ul > li > a")].map((link) => {
    const [text, value] = [...link.children];
    const [title, meta] = [...(text?.children ?? [])];
    return [
      title?.textContent,
      meta?.querySelector('[aria-hidden="true"]')?.textContent,
      value?.firstElementChild?.textContent,
    ];
  });
}
function tableLinks() {
  return [...container.querySelectorAll("table a")].map((link) => ({
    href: link.getAttribute("href"),
    current: link.getAttribute("aria-current"),
  }));
}

async function checkCacheIsolation(
  kind: "meals" | "foods",
  route: typeof Foods | typeof Meals,
  panelName: string,
  privateTitle: string,
) {
  wide = true;
  currentSearch = { selected: kind === "meals" ? "breakfast" : "skyr" };
  const assertPrivateHidden = () => {
    assert.equal(panel(panelName), null);
    assert(!container.textContent?.includes(privateTitle));
  };

  owner = null;
  const before = requests;
  await show(route);
  assert.equal(requests, before, "Don't query the library before the user is known");
  assertPrivateHidden();

  owner = "another-user";
  const pending = Promise.withResolvers<never>();
  response = () => pending.promise;
  await show(route);
  assert.equal(requests, before + 1);
  assertPrivateHidden();
  assert.equal(container.querySelector('[role="alert"]'), null);

  await act(async () => {
    pending.reject(new Error("Fixture refresh failed"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  assert(container.querySelector('[role="alert"]'));
  assertPrivateHidden();

  // A failure revalidating the same account still keeps that account's rows and panel.
  owner = "test-user";
  response = () => Promise.reject(new Error("Fixture refresh failed"));
  await show(route);
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["nutrition", kind, "index", owner] });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  assert(container.querySelector('[role="alert"]'));
  assert.equal(panel(panelName)?.querySelector("h2")?.textContent, privateTitle);
  assert(container.querySelector("table")?.textContent?.includes(privateTitle));
}
try {
  // Wide: the first row is selected by default and rows select instead of navigating.
  await show(Foods);
  assert(container.querySelector('input[aria-label="Search foods"]'));
  const filters = container.querySelector("fieldset");
  assert.equal(filters?.querySelector("legend")?.textContent, "Show only");
  assert.deepEqual(
    [...(filters?.querySelectorAll("button") ?? [])].map((chip) => [
      chip.textContent,
      chip.getAttribute("aria-pressed"),
    ]),
    [
      ["Mine", "false"],
      ["Public", "false"],
    ],
  );
  assert.deepEqual(
    [...container.querySelectorAll("table tbody tr td:first-child")].map(
      (cell) => cell.textContent,
    ),
    ["Rolled oatspublic", "Skyr natural"],
  );
  assert.equal(panel("Selected food")?.querySelector("h2")?.textContent, "Rolled oats");
  assert(panel("Selected food")?.textContent?.startsWith("Public · per 100 g"));
  assert(panel("Selected food")?.textContent?.includes("379 kcal"));
  assert(panel("Selected food")?.textContent?.includes("Public foods are read-only"));
  assert.equal(panel("Selected food")?.querySelector('a[href$="/edit"]'), null, "Public: no Edit");
  assert.deepEqual(tableLinks(), [
    { href: "/nutrition/foods?selected=oats", current: "true" },
    { href: "/nutrition/foods?selected=skyr", current: null },
  ]);

  currentSearch = { selected: "skyr" };
  await show(Foods);
  assert.equal(panel("Selected food")?.querySelector("h2")?.textContent, "Skyr natural");
  assert(panel("Selected food")?.textContent?.startsWith("Mine · per 100 g"));
  assert(panel("Selected food")?.querySelector('a[href="/nutrition/foods/skyr/edit"]'));
  assert(panel("Selected food")?.textContent?.includes("they keep their snapshot"));

  currentSearch = { selected: "missing" };
  await show(Meals);
  assert(container.querySelector('input[aria-label="Search meals or ingredients"]'));
  assert.equal(panel("Selected meal")?.querySelector("h2")?.textContent, "Breakfast");
  assert(panel("Selected meal")?.textContent?.startsWith("Meal · 2 ingredients"));
  assert.deepEqual(
    [...(panel("Selected meal")?.querySelectorAll("li") ?? [])].map((row) => row.textContent),
    ["Rolled oats60 g · 227 kcal", "Skyr natural200 g · 126 kcal"],
  );
  assert(
    panel("Selected meal")?.textContent?.includes(
      "353 kcalProtein 8 grams, carbs 5 grams, fat 3 grams",
    ),
    panel("Selected meal")?.textContent ?? "",
  );

  currentSearch = { selected: "shake" };
  await show(Meals);
  assert.equal(panel("Selected meal")?.querySelector("h2")?.textContent, "Recovery shake");

  // Searching filters the table without a combined-totals card.
  currentSearch = { q: "shake" };
  await show(Meals);
  assert.equal(container.textContent?.includes("Filtered meal totals"), false);
  assert.deepEqual(
    tableLinks().map((link) => link.href),
    ["/nutrition/meals?selected=shake"],
  );

  // No match says so and offers Clear search.
  currentSearch = { q: "zzzz" };
  await show(Meals);
  assert(container.textContent?.includes("No meals match"));
  assert(
    [...container.querySelectorAll("button")].some(
      (button) => button.textContent === "Clear search",
    ),
  );

  // Below 1100 px: no panel, rows open the detail page.
  currentSearch = {};
  wide = false;
  await show(Meals);
  assert.equal(panel("Selected meal"), null);
  assert.deepEqual(
    tableLinks().map((link) => link.href),
    ["/nutrition/meals/breakfast", "/nutrition/meals/shake"],
  );
  // The phone list: one title, one meta line, trailing kcal.
  assert.deepEqual(listRows(), [
    ["Breakfast", "2 ingredients · P 8 · C 5 · F 3 g", "353"],
    ["Recovery shake", "1 ingredient · P 9 · C 6 · F 3 g", "189"],
  ]);

  await show(Foods);
  assert.deepEqual(listRows(), [
    ["Rolled oatspublic", "P 3 · C 2 · F 1 g", "379"],
    ["Skyr natural", "P 3 · C 2 · F 1 g", "63"],
  ]);

  await checkCacheIsolation("meals", Meals, "Selected meal", "Breakfast");
  await checkCacheIsolation("foods", Foods, "Selected food", "Skyr natural");
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("Foods and Meals select rows into a side panel from 1100 px and link below it.");
