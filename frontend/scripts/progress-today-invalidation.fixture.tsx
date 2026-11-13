// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { type DocumentNode, getOperationAST } from "graphql";
import { Window } from "happy-dom";
import { act, type ReactNode } from "react";

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
const navigations: unknown[] = [];
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ id: "record" }),
    useSearch: () => ({ date: "2026-05-31" }),
  }),
  useNavigate: () => (options: unknown) => navigations.push(options),
  // Form pages render the breadcrumb trail in their sticky header.
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/progress/body/new" } }),
  Link: ({ children }: { children: ReactNode }) => <a href="#crumb">{children}</a>,
}));
const errors: string[] = [];
mock.module("sonner", () => ({ toast: { error: (message: string) => errors.push(message) } }));

const mutationResults = {
  InsertBodyMeasurement: { insertBodyMeasurement: { id: "record" } },
  UpdateBodyMeasurement: { updateBodyMeasurement: { id: "record" } },
  DeleteBodyMeasurement: { deleteBodyMeasurement: { id: "record" } },
  InsertDailyEnergy: { insertDailyEnergyEntry: { id: "record" } },
  UpdateDailyEnergy: { updateDailyEnergyEntry: { id: "record" } },
  DeleteDailyEnergy: { deleteDailyEnergyEntry: { id: "record" } },
};
type MutationName = keyof typeof mutationResults;
let pendingMutation:
  | {
      operation: string;
      resolve: () => void;
      reject: (error: Error) => void;
    }
  | undefined;
mock.module("@/lib/graphql", () => ({
  gqlRequest: (document: DocumentNode) => {
    const operation = getOperationAST(document)?.name?.value;
    if (operation === "EditBodyMeasurement") {
      return Promise.resolve({
        bodyMeasurement: {
          id: "record",
          measuredOn: "2026-05-31",
          weightKg: 80,
          bodyFatPct: null,
          notes: null,
        },
      });
    }
    if (operation === "EditDailyEnergy") {
      return Promise.resolve({
        dailyEnergyEntry: {
          id: "record",
          energyOn: "2026-05-31",
          activeKcal: 500,
          restingKcal: 1500,
          notes: null,
        },
      });
    }
    assert(operation && Object.hasOwn(mutationResults, operation), "Unexpected GraphQL operation");
    const pending = Promise.withResolvers<unknown>();
    pendingMutation = {
      operation,
      resolve: () => pending.resolve(mutationResults[operation as MutationName]),
      reject: pending.reject,
    };
    return pending.promise;
  },
}));

// Keep the production forms, confirmation dialog, query client and mutation handlers.
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { Route: NewBody } = await import("@/routes/_authed/progress/body/new");
const { Route: EditBody } = await import("@/routes/_authed/progress/body/$id_.edit");
const { Route: NewEnergy } = await import("@/routes/_authed/progress/energy/new");
const { Route: EditEnergy } = await import("@/routes/_authed/progress/energy/$id_.edit");
const cases = [
  { route: NewBody, operation: "InsertBodyMeasurement", area: "body", action: "Save measurement" },
  { route: EditBody, operation: "UpdateBodyMeasurement", area: "body", action: "Save changes" },
  {
    route: EditBody,
    operation: "DeleteBodyMeasurement",
    area: "body",
    action: "Delete measurement",
  },
  { route: NewEnergy, operation: "InsertDailyEnergy", area: "energy", action: "Save energy day" },
  { route: EditEnergy, operation: "UpdateDailyEnergy", area: "energy", action: "Save changes" },
  {
    route: EditEnergy,
    operation: "DeleteDailyEnergy",
    area: "energy",
    action: "Delete energy day",
  },
] as const;
const todayKey = ["today", "overview", "2026-06-01", "test-user"];
const projectionKey = ["nutrition", "energy-projection", "test-user", "2026-06-01"];

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
  throw new Error("Timed out waiting for progress mutation UI");
}
function button(label: string, within: ParentNode = document.body) {
  const element = [...within.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  assert(element, `Missing button: ${label}`);
  return element;
}

function mutation() {
  assert(pendingMutation, "Expected a pending progress mutation");
  return pendingMutation;
}

async function checkCase({ route, operation, area, action }: (typeof cases)[number]) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  const listKey = [area === "body" ? "body_measurements" : "daily_energy", "list"];
  client.setQueryData(todayKey, "cached overview");
  client.setQueryData(listKey, []);
  client.setQueryData(projectionKey, {});
  let overviewFetches = 0;
  const overviewQuery = {
    queryKey: todayKey,
    queryFn: () => {
      overviewFetches += 1;
      return Promise.resolve("updated overview");
    },
  };
  assert.equal(await client.fetchQuery(overviewQuery), "cached overview");
  assert.equal(overviewFetches, 0, "A recent Today cache is initially fresh");
  pendingMutation = undefined;
  errors.length = 0;
  navigations.length = 0;
  const Component = route.options.component;
  assert(Component);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await settle(() =>
      root.render(
        <QueryClientProvider client={client}>
          <Component />
        </QueryClientProvider>,
      ),
    );
    await waitFor(() => container.querySelector("form") !== null);
    if (operation.startsWith("Insert")) {
      const input = container.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
      assert(input);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      assert(setter);
      await settle(() => {
        setter.call(input, area === "body" ? "81" : "600");
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    }
    if (operation.startsWith("Delete")) {
      await settle(() => button(action, container).click());
    }
    const actionScope = document.querySelector('[role="dialog"]') ?? container;
    await settle(() => button(action, actionScope).click());
    await waitFor(() => pendingMutation !== undefined);
    assert.equal(mutation().operation, operation);
    assert.equal(
      client.getQueryState(todayKey)?.isInvalidated,
      false,
      "Pending writes keep Today fresh",
    );
    await settle(() => mutation().reject(new Error("Connection interrupted")));
    await waitFor(() => errors.length === 1 && !button(action, actionScope).disabled);
    assert.equal(
      client.getQueryState(todayKey)?.isInvalidated,
      false,
      "Failed writes keep Today fresh",
    );
    assert.equal(navigations.length, 0);

    pendingMutation = undefined;
    await settle(() => button(action, actionScope).click());
    await waitFor(() => pendingMutation !== undefined);
    await settle(() => mutation().resolve());
    await waitFor(() => navigations.length === 1);
    assert.equal(
      client.getQueryState(todayKey)?.isInvalidated,
      true,
      `${operation} invalidates Today`,
    );
    assert.equal(client.getQueryState(listKey)?.isInvalidated, true);
    if (area === "energy") {
      assert.equal(client.getQueryState(projectionKey)?.isInvalidated, true);
    }
    assert.deepEqual(navigations[0], {
      to: `/progress/${area}${operation.startsWith("Delete") ? "" : "/$id"}`,
      ...(operation.startsWith("Delete") ? {} : { params: { id: "record" } }),
      replace: true,
    });
    assert.equal(await client.fetchQuery(overviewQuery), "updated overview");
    assert.equal(
      overviewFetches,
      1,
      "Returning to Today fetches again within the 30-second freshness window",
    );
  } finally {
    act(() => root.unmount());
    client.clear();
    container.remove();
  }
}

try {
  for (const testCase of cases) {
    // biome-ignore lint/performance/noAwaitInLoops: Each route needs its own mounted UI and cache.
    await checkCase(testCase);
  }
} finally {
  await dom.happyDOM.abort();
  dom.close();
  mock.restore();
}
console.info("Full-page Body/Energy create, edit and delete invalidate Today only after success.");
