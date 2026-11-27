// Isolated process: the real photo routes run against a scripted GraphQL/Storage network
// through the real Nhost SDK client, with the app's query cache defaults.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { getOperationAST, parse } from "graphql";
import { Window } from "happy-dom";
import { act, type ReactNode, useSyncExternalStore } from "react";

const dom = new Window({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  localStorage: window.localStorage,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  Node: window.Node,
  NodeFilter: window.NodeFilter,
  Element: window.Element,
  MutationObserver: window.MutationObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
function visibility(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new window.Event("visibilitychange"));
}
visibility(false);
Object.defineProperty(navigator, "locks", {
  value: { request: (_name: string, _options: LockOptions, run: () => unknown) => run() },
});

// --- Router and auth stand-ins -------------------------------------------------------
const id = "558e5143-0f20-4014-970e-50ed9e0a32a8";
let pathname = "/progress/body/photos";
let outlet: ReactNode;
type Navigation = { to?: string; params?: unknown; replace?: boolean; search?: unknown };
const navigations: Navigation[] = [];
const searchChanges: Navigation[] = [];
let search: Record<string, unknown> = {};
const searchListeners = new Set<() => void>();
function setSearch(next: Record<string, unknown>) {
  search = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
  for (const listener of searchListeners) {
    listener();
  }
}
function subscribeSearch(listener: () => void) {
  searchListeners.add(listener);
  return () => searchListeners.delete(listener);
}
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ photoId: id }),
    useSearch: () => useSyncExternalStore(subscribeSearch, () => search),
    useNavigate: () => (value: Navigation) => {
      if (value.to === undefined && value.search !== undefined) {
        searchChanges.push(value);
        setSearch(
          typeof value.search === "function"
            ? (value.search as (prev: typeof search) => typeof search)(search)
            : (value.search as typeof search),
        );
      } else {
        navigations.push(value);
      }
      return Promise.resolve();
    },
  }),
  useRouterState: ({ select }: { select: (value: unknown) => unknown }) =>
    select({ location: { pathname } }),
  Outlet: () => outlet,
  Link: ({
    children,
    to,
    params,
    search: query,
    replace,
    className,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { photoId: string };
    search?: Record<string, string | undefined>;
    replace?: boolean;
    className?: string;
    "aria-current"?: "page";
    "aria-label"?: string;
  }) => {
    const defined = Object.entries(query ?? {}).filter(([, value]) => value !== undefined);
    const suffix =
      defined.length > 0 ? `?${new URLSearchParams(defined as [string, string][])}` : "";
    return (
      <a
        href={`${to.replace("$photoId", params?.photoId ?? "")}${suffix}`}
        className={className}
        data-replace={replace}
        aria-current={props["aria-current"]}
        aria-label={props["aria-label"]}
      >
        {children}
      </a>
    );
  },
}));
let auth: { user: { id: string } | null; isAuthenticated: boolean } = {
  user: null,
  isAuthenticated: false,
};
const authListeners = new Set<() => void>();
function subscribeAuth(listener: () => void) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => useSyncExternalStore(subscribeAuth, () => auth),
}));
mock.module("@/components/progress/quick-entry-forms", () => ({
  QuickBodyMeasurementForm: () => null,
}));
mock.module("@/components/charts/trend-chart", () => ({ TrendChart: () => null }));
mock.module("@/lib/progress-photos/prepare", () => ({
  preparePhoto: () => Promise.resolve(new Blob(["prepared fixture"], { type: "image/jpeg" })),
}));

const revoked: string[] = [];
let allocated = 0;
URL.createObjectURL = () => `blob:http://localhost/test-${++allocated}`;
URL.revokeObjectURL = (url) => {
  revoked.push(url);
};

// --- Scripted backend ---------------------------------------------------------------
const FRONT = { value: "front_a", comment: "Front A" };
const BACK = { value: "back_b", comment: "Back B" };
const SIDE = { value: "side", comment: "Side" };
const photo = {
  id,
  takenOn: "2001-02-03",
  createdAt: "2026-11-25T10:00:00.123Z",
  label: FRONT,
  file: { id, isUploaded: true },
};
// Even fixtures are Front A, odd ones Back B: two sheet columns.
function fixturePhoto(number: number, takenOn: string) {
  const fixtureId = `39d36419-4eb1-4190-8213-${String(number).padStart(12, "0")}`;
  const label = number % 2 === 0 ? FRONT : BACK;
  return { ...photo, id: fixtureId, takenOn, label, file: { id: fixtureId, isUploaded: true } };
}
const firstDay = [photo, ...Array.from({ length: 7 }, (_, i) => fixturePhoto(i + 1, "2001-02-03"))];
const secondDay = Array.from({ length: 7 }, (_, i) => fixturePhoto(i + 8, "2001-02-02"));
const pending = { ...fixturePhoto(15, "2001-02-02"), file: null };
const olderPage = [fixturePhoto(16, "2001-02-02"), fixturePhoto(17, "2001-01-31")];
const everyReady = [...firstDay, ...secondDay, ...olderPage];
const measurements = [
  { id: "m1", measuredOn: "2001-02-03", weightKg: 80, bodyFatPct: 18, notes: null },
  { id: "m2", measuredOn: "2001-02-02", weightKg: 81.5, bodyFatPct: 19, notes: null },
];
let listFails = true;
let nextPageFails = true;
let lastFilter: string | undefined;
let fileHeld: ReturnType<typeof Promise.withResolvers<Response>> | undefined;
let uploadHeld: ReturnType<typeof Promise.withResolvers<Response>> | undefined;
const uploadedIds: string[] = [];
let lastUpload: { bucket: unknown; name: string; type: string } | undefined;
const reservations: { label: string; date: string; id: string }[] = [];
let uploadSignal: AbortSignal | null | undefined;
let checkingUpload = false;
let tookDelete = false;
const updates: unknown[] = [];
const operations: string[] = [];
const imageRequests: string[] = [];
let imageSignal: AbortSignal | null | undefined;

function json(data: unknown) {
  return Response.json({ data });
}
type Where = {
  userId: { _eq: string };
  file: unknown;
  labelValue?: { _eq: string };
  takenOn?: { _eq: string };
  _or?: unknown[];
};
function visible<T extends { id: string }>(rows: T[]) {
  return rows.filter((row) => !(tookDelete && row.id === id));
}
function historyResponse(where: Where, limit: number) {
  assert.equal(where.userId._eq, auth.user?.id);
  assert.deepEqual(where.file, { isUploaded: { _eq: true } });
  if (where.userId._eq !== "alice") {
    return json({ progressPhotos: [] });
  }
  if (where.takenOn) {
    // Body's latest check-in.
    assert.equal(limit, 8);
    const day = everyReady.filter((p) => p.takenOn === where.takenOn?._eq);
    return json({ progressPhotos: visible(day) });
  }
  if (listFails) {
    return new Response(null, { status: 500 });
  }
  lastFilter = where.labelValue?._eq;
  if (lastFilter) {
    // A label's whole history (limit 500) or its first gallery page.
    const rows = visible(everyReady.filter((p) => p.label.value === lastFilter));
    return json({ progressPhotos: rows.slice(0, limit) });
  }
  if (where._or) {
    assert.deepEqual(where._or[2], {
      takenOn: { _eq: pending.takenOn },
      createdAt: { _eq: pending.createdAt },
      id: { _lt: pending.id },
    });
    return nextPageFails
      ? new Response(null, { status: 503 })
      : json({ progressPhotos: olderPage });
  }
  assert.equal(limit, 17);
  const page = [...firstDay, ...secondDay, pending, ...olderPage.slice(0, 1)];
  return json({ progressPhotos: visible(page) });
}

// The SDK captures `fetch` when the client is created, so install this before importing it.
let currentToken: () => string | undefined = () => undefined;
function assertPhotoRequest(init: RequestInit) {
  assert.equal(init.cache, "no-store", "photo traffic bypasses the HTTP cache");
  assert.equal(new Headers(init.headers).get("Authorization"), `Bearer ${currentToken()}`);
}
function storageResponse(url: string, init: RequestInit): Promise<Response> {
  assertPhotoRequest(init);
  if (url.endsWith("/files") && init.method === "POST") {
    assert(init.body instanceof FormData);
    const metadata = init.body.get("metadata[]");
    const file = init.body.get("file[]");
    assert(metadata instanceof Blob && file instanceof File);
    lastUpload = { bucket: init.body.get("bucket-id"), name: file.name, type: file.type };
    uploadSignal = init.signal;
    const held = uploadHeld;
    uploadHeld = undefined;
    return metadata.text().then((text) => {
      const uploaded = JSON.parse(text).id as string;
      uploadedIds.push(uploaded);
      return (
        held?.promise ?? Response.json({ processedFiles: [{ id: uploaded, isUploaded: true }] })
      );
    });
  }
  if (init.method === "DELETE") {
    tookDelete = true;
    return Promise.reject(new Error("response lost"));
  }
  imageRequests.push(url);
  imageSignal = init.signal;
  return (
    fileHeld?.promise ??
    Promise.resolve(
      new Response(new Uint8Array([1]), { headers: { "Content-Type": "image/jpeg" } }),
    )
  );
}
function detailResponse(photoId: string) {
  if (photoId === id) {
    return json({ progressPhoto: tookDelete ? null : photo });
  }
  // A reservation made by the check-in form.
  const reserved = reservations.find((row) => row.id === photoId);
  assert(reserved);
  return json({
    progressPhoto: {
      ...photo,
      id: photoId,
      takenOn: reserved.date,
      file: checkingUpload ? null : { id: photoId, isUploaded: true },
    },
  });
}
function graphqlResponse(init: RequestInit): Response {
  const { query, variables } = JSON.parse(String(init.body));
  const operation = getOperationAST(parse(query))?.name?.value ?? "";
  if (operation === "BodyMeasurements") {
    return json({ bodyMeasurements: auth.user?.id === "alice" ? measurements : [] });
  }
  assertPhotoRequest(init);
  operations.push(operation);
  switch (operation) {
    case "ProgressPhotoLabels":
      // Deliberately unsorted, with a value newer than the generated types.
      return json({ progressPhotoLabels: [BACK, SIDE, FRONT] });
    case "ProgressPhotoSummary": {
      assert.deepEqual(variables.where, {
        userId: { _eq: auth.user?.id },
        file: { isUploaded: { _eq: true } },
      });
      const alice = auth.user?.id === "alice";
      return json({
        progressPhotosAggregate: {
          aggregate: { count: alice ? 17 : 0, max: { takenOn: alice ? photo.takenOn : null } },
        },
      });
    }
    case "ProgressPhotoHistory":
      return historyResponse(variables.where, variables.limit);
    case "ProgressPhotoDetails":
      return detailResponse(variables.id);
    case "ReserveProgressPhoto": {
      const reserved = `5a5a5a5a-0000-4000-8000-${String(reservations.length + 1).padStart(12, "0")}`;
      reservations.push({ label: variables.label, date: variables.date, id: reserved });
      return json({ insertProgressPhoto: { id: reserved } });
    }
    case "UpdateProgressPhoto":
      updates.push(variables);
      return json({ updateProgressPhoto: { id: variables.id } });
    default:
      throw new Error(`Unexpected operation ${operation}`);
  }
}
globalThis.fetch = ((input: string | URL, init: RequestInit = {}) => {
  const url = String(input);
  assert(!url.endsWith("/token"), "the fixture session never needs an Auth refresh");
  if (url.includes("storage")) {
    return storageResponse(url, init);
  }
  return Promise.resolve(graphqlResponse(init));
}) as typeof fetch;

const { nhost } = await import("@/lib/nhost/client");
currentToken = () => nhost.getUserSession()?.accessToken;
const BASE64_PADDING = /=+$/;
function setOwner(name: string | null) {
  if (name) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp, sub: name })).replace(BASE64_PADDING, "");
    nhost.sessionStorage.set({
      accessToken: `e30.${payload}.fake`,
      accessTokenExpiresIn: 3600,
      refreshToken: `fixture-${name}`,
      refreshTokenId: name,
      user: { id: name },
    } as Parameters<typeof nhost.sessionStorage.set>[0]);
  } else {
    nhost.clearSession();
  }
  auth = { user: name ? { id: name } : null, isAuthenticated: Boolean(name) };
  for (const listener of authListeners) {
    listener();
  }
}

// --- Rendering helpers --------------------------------------------------------------
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { photoKeys } = await import("@/lib/progress-photos/api");
const { PhotoCacheGuard } = await import("@/components/progress-photos/photo-session");
const { __testing } = await import("@/components/breadcrumbs");
const { Route: Body } = await import("@/routes/_authed/progress/body");
const { Route: PhotoLayout } = await import("@/routes/_authed/progress/body/photos");
const { Route: Gallery } = await import("@/routes/_authed/progress/body/photos/index");
const { Route: New } = await import("@/routes/_authed/progress/body/photos/new");
const { Route: Compare } = await import("@/routes/_authed/progress/body/photos/compare");
const { Route: Viewer } = await import("@/routes/_authed/progress/body/photos/$photoId");
const mount = document.createElement("div");
document.body.append(mount);
const root = createRoot(mount);
// The app's defaults (router.tsx), so cache reuse across routes is exercised as shipped.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false } },
});
function view(route: { options: { component?: unknown } }) {
  const Component = route.options.component as () => ReactNode;
  return <Component />;
}
async function renderPage(
  path: string,
  route: Parameters<typeof view>[0],
  nextSearch: Record<string, unknown> = {},
) {
  pathname = path;
  outlet = view(route);
  search = nextSearch;
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <PhotoCacheGuard />
        {path === "/progress/body" ? outlet : view(PhotoLayout)}
      </QueryClientProvider>,
    );
  });
}
async function settled(assertion: () => void) {
  let error: unknown;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      assertion();
      return;
    } catch (next) {
      error = next;
    }
    // biome-ignore lint/performance/noAwaitInLoops: allow React Query's next scheduled notification to render.
    await act(() => Bun.sleep(10));
  }
  throw error instanceof Error ? error : new Error("The view did not settle");
}
function exactText(text: string, tag = "button", scope: ParentNode = document) {
  const element = [...scope.querySelectorAll<HTMLElement>(tag)].find(
    (node) => node.textContent === text,
  );
  assert(element, `Couldn't find ${text}`);
  return element;
}
function photoQueries(owner?: string) {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter(
      (query) =>
        query.queryKey[0] === "progress_photos" &&
        (owner === undefined || query.queryKey[1] === owner),
    );
}
function count(operation: string) {
  return operations.filter((name) => name === operation).length;
}
async function choose(select: HTMLSelectElement, value: string) {
  await act(() => {
    select.value = value;
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function submit(form = mount.querySelector("form")) {
  await act(() => {
    assert(form);
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function pickFile(labelName: string) {
  const input = mount.querySelector<HTMLInputElement>(`input[aria-label="${labelName} photo"]`);
  assert(input, `No ${labelName} slot`);
  await act(async () => {
    const selected = new File(["fixture"], "synthetic.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { configurable: true, value: { item: () => selected } });
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await Bun.sleep(5);
  });
  await settled(() => assert(input.closest("label")?.querySelector("img[src^='blob:']")));
  return input;
}
const sheet = () => mount.querySelector('ol[aria-label="Progress photos"]');
// "photo" for a tile; an Add slot's link otherwise.
const rowCells = (row: Element | null | undefined) =>
  [...(row?.querySelectorAll(":scope > ul > li") ?? [])].map((cell) => {
    const href = cell.querySelector("a")?.getAttribute("href") ?? "";
    return href.includes("/new") ? href : "photo";
  });

// --- Body: the photo card sits beside the measurements with the latest check-in -----
await act(() => setOwner("alice"));
await renderPage("/progress/body", Body);
const card = () =>
  [...mount.querySelectorAll("h2")]
    .find((heading) => heading.textContent === "Progress photos")
    ?.closest("section");
await settled(() => assert(card()?.textContent?.includes("17 photos")));
assert.equal(card()?.querySelector("time")?.dateTime, photo.takenOn);
assert.equal(
  exactText("View all progress photos", "a").getAttribute("href"),
  "/progress/body/photos",
);
assert.equal(exactText("Add photos", "a").getAttribute("href"), "/progress/body/photos/new");
await settled(() => assert.equal(card()?.querySelectorAll("img[src^='blob:']").length, 4));
assert.deepEqual(
  [...(card()?.querySelectorAll("li a") ?? [])].map((node) => node.getAttribute("aria-label")),
  ["Front A, Feb 3, 2001", "Front A, Feb 3, 2001", "Front A, Feb 3, 2001", "Front A, Feb 3, 2001"],
  "front labels first",
);
assert(
  !card()?.previousElementSibling?.textContent?.includes("Weight & body fat"),
  "the card no longer splits the trend from its table",
);
await act(() => setOwner("bob"));
await settled(() => assert(card()?.textContent?.includes("No photos yet")));
assert(!card()?.querySelector("time, img"));
assert.equal(photoQueries("alice").length, 0, "an account switch drops the previous owner");
await act(() => setOwner("alice"));
assert.deepEqual(
  __testing.trailFor("/progress/body/photos/compare").map((crumb) => crumb.label),
  ["Progress", "Body", "Progress photos", "Compare"],
);
assert.deepEqual(
  __testing.trailFor(`/progress/body/photos/${id}`).map((crumb) => crumb.label),
  ["Progress", "Body", "Progress photos", "Photo"],
);

// --- Gallery: contact sheet rows and columns, retry and paging ----------------------
await renderPage("/progress/body/photos", Gallery);
await settled(() => assert(mount.textContent?.includes("Couldn't load photos")));
listFails = false;
await act(() => exactText("Retry").click());
await settled(() => assert.equal(sheet()?.children.length, 2));
assert.deepEqual(
  [...mount.querySelectorAll("fieldset button")].map((chip) => chip.textContent),
  ["All", "Front A", "Side", "Back B"],
  "labels read front, side, back",
);
assert.deepEqual(rowCells(sheet()?.children[0]), ["photo", "photo"], "Front A then Back B");
assert(sheet()?.children[0]?.textContent?.includes("80 kg · 18.0 %"), "same-day weight");
assert.equal(
  sheet()?.children[0]?.querySelector("a")?.getAttribute("aria-label"),
  "Front A, Feb 3, 2001, 4 photos",
  "a cell names its label, date and count",
);
assert.equal(
  sheet()?.children[0]?.querySelectorAll("a")[1]?.getAttribute("aria-label"),
  "Back B, Feb 3, 2001, 4 photos",
);
assert.equal(
  exactText("Compare", "a").closest("a")?.getAttribute("href"),
  "/progress/body/photos/compare?label=front_a",
);
await act(() => exactText("Load older photos").click());
await settled(() => assert(mount.textContent?.includes("Couldn't load older photos")));
assert.equal(sheet()?.children.length, 2, "a failed page keeps the photos");
nextPageFails = false;
await act(() => exactText("Load older photos").click());
await settled(() => assert.equal(sheet()?.children.length, 3));
assert.deepEqual(
  [...(sheet()?.querySelectorAll("h2 time") ?? [])].map((time) => time.getAttribute("datetime")),
  ["2001-02-03", "2001-02-02", "2001-01-31"],
);
assert.deepEqual(
  rowCells(sheet()?.children[2]),
  ["/progress/body/photos/new?date=2001-01-31&label=front_a", "photo"],
  "a missing label is an Add slot for that date",
);
await settled(() => assert.equal(mount.querySelectorAll("img[src^='blob:']").length, 5));
assert(
  imageRequests.every((url) => url.includes("w=480")),
  "tiles use the private transform",
);

// Chips: one label over time; a catalog value newer than the types still filters.
await act(() => exactText("Side").click());
assert.deepEqual(search, { label: "side" });
assert.equal(searchChanges.at(-1)?.replace, true);
await settled(() => assert(mount.textContent?.includes("No Side photos")));
assert.equal(lastFilter, "side");
await act(() => exactText("Show all photos").click());
assert.deepEqual(search, {});
await act(() => exactText("Front A").click());
await settled(() => assert(mount.querySelector('ul[aria-label="Front A photos"]')));
assert.equal(mount.querySelectorAll('ul[aria-label="Front A photos"] > li').length, 9);
await act(() => exactText("All").click());

// Hiding the tab no longer tears anything down.
const imagesBeforeHide = imageRequests.length;
await act(() => visibility(true));
assert.equal(sheet()?.children.length, 3);
await act(() => visibility(false));
assert.equal(imageRequests.length, imagesBeforeHide);

// --- Viewer: label title, older/newer, keyboard, edit dialog; Back reuses the cache -
const historyReads = count("ProgressPhotoHistory");
await renderPage(`/progress/body/photos/${id}`, Viewer);
await settled(() =>
  assert(mount.querySelector("img[src^='blob:'][alt^='Front A progress photo']")),
);
assert.equal(mount.querySelector("h1")?.textContent, "Front A");
assert(!mount.querySelector("nav a[aria-current]"), "no section tabs on a photo");
assert(!imageRequests.at(-1)?.includes("w="), "the viewer reads the prepared original");
await settled(() => assert(mount.textContent?.includes("9 of 9")));
const older = mount.querySelector<HTMLAnchorElement>('nav[aria-label="Front A photos"] a');
assert.equal(older?.getAttribute("href"), `/progress/body/photos/${firstDay[2]?.id}`);
assert.equal(older?.dataset["replace"], "true");
assert(exactText("Newer", "button").hasAttribute("disabled"), "the newest has no newer photo");
assert.equal(
  exactText("Compare", "a").closest("a")?.getAttribute("href"),
  `/progress/body/photos/compare?label=front_a&to=${id}`,
);
await act(() => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft" })));
assert.deepEqual(navigations.pop(), {
  to: "/progress/body/photos/$photoId",
  params: { photoId: firstDay[2]?.id },
  replace: true,
});
await act(() => exactText("Edit").click());
const editDialog = () => document.querySelector('[role="dialog"]');
await settled(() => assert(editDialog()?.querySelector("select")));
assert(editDialog()?.querySelector("img"), "the photo stays visible while editing");
const editSelect = editDialog()?.querySelector("select");
assert(editSelect);
await choose(editSelect, "side");
await submit(editDialog()?.querySelector("form"));
await settled(() => assert(!editDialog()));
assert.deepEqual(updates, [{ id, label: "side", date: photo.takenOn }]);
assert.equal(navigations.length, 0, "editing stays on the photo");
const imagesBeforeBack = imageRequests.length;
await renderPage("/progress/body/photos", Gallery);
assert.equal(sheet()?.children.length, 3, "Back keeps the loaded pages");
await settled(() => assert.equal(mount.querySelectorAll("img[src^='blob:']").length, 5));
assert.equal(imageRequests.length, imagesBeforeBack, "cached thumbnails are not downloaded again");
assert(count("ProgressPhotoHistory") > historyReads, "the edit refreshed the (stale) rows");

// --- Compare: oldest vs newest of a label, change in weight and body fat ------------
await renderPage("/progress/body/photos/compare", Compare, { label: "front_a" });
await settled(() => assert(mount.textContent?.includes("Time between")));
const [before, after] = [...mount.querySelectorAll("select")];
assert.equal(before?.value, olderPage[0]?.id, "before defaults to the oldest");
assert.equal(after?.value, id, "after defaults to the newest");
assert(mount.textContent?.includes("1 day"));
assert(mount.textContent?.includes("−1.5 kg"), "weight change between the dates");
assert(mount.textContent?.includes("−1.0 %"), "body-fat change between the dates");
assert(mount.querySelector('input[type="range"]'), "the phone slider");
assert(before);
await choose(before, firstDay[2]?.id ?? "");
assert.deepEqual(search, { label: "front_a", from: firstDay[2]?.id, to: id });

// --- Sign-out with an image in flight: cancelled, unmounted and dropped -------------
queryClient.removeQueries({ queryKey: photoKeys.bytes("alice", id, "full") });
const held = Promise.withResolvers<Response>();
fileHeld = held;
await renderPage(`/progress/body/photos/${id}`, Viewer);
await settled(() => assert(imageSignal && !imageSignal.aborted));
const inFlight = imageSignal;
const beforeLate = allocated;
await act(() => setOwner(null));
assert(inFlight?.aborted, "sign-out cancels photo requests");
assert.equal(mount.textContent, "", "sign-out unmounts photo screens");
assert.equal(photoQueries().length, 0, "sign-out drops every cached photo row and image");
await act(async () => {
  held.resolve(new Response(new Uint8Array([1]), { headers: { "Content-Type": "image/jpeg" } }));
  await Bun.sleep(10);
});
assert.equal(allocated, beforeLate, "a late response creates no image URL");
assert.equal(revoked.length, allocated, "every displayed image URL was revoked");
fileHeld = undefined;

// --- Check-in: one date, a photo per label, a lost upload retried without re-reserving
await act(() => setOwner("alice"));
await renderPage("/progress/body/photos", Gallery);
await settled(() => assert.equal(sheet()?.children.length, 2));
await renderPage("/progress/body/photos/new", New, { date: "2001-02-03", label: "back_b" });
assert.equal(mount.querySelector<HTMLInputElement>("input[type=date]")?.value, "2001-02-03");
await settled(() => assert.equal(mount.querySelectorAll("input[type=file]").length, 3));
assert.deepEqual(
  [...mount.querySelectorAll("input[type=file]")].map((input) => input.getAttribute("aria-label")),
  ["Front A photo", "Side photo", "Back B photo"],
);
assert.equal(document.activeElement?.getAttribute("aria-label"), "Back B photo", "requested slot");
const frontInput = await pickFile("Front A");
await pickFile("Side");
await act(() => visibility(true));
assert.equal(
  mount.querySelectorAll("label img[src^='blob:']").length,
  2,
  "drafts survive a hidden tab",
);
assert(frontInput.isConnected);
await act(() => visibility(false));
assert.equal(exactText("Upload 2 photos").hasAttribute("disabled"), false);
const lost = Promise.withResolvers<Response>();
uploadHeld = lost;
checkingUpload = true;
await submit();
await settled(() => assert.equal(uploadedIds.length, 1));
assert.deepEqual(lastUpload, {
  bucket: "progress_photos",
  name: "progress-photo.jpg",
  type: "image/jpeg",
});
assert(mount.querySelector<HTMLInputElement>("input[type=date]")?.disabled, "date locks on upload");
await act(() => lost.resolve(new Response(null, { status: 500 })));
await settled(() => assert(!exactText("Try again").hasAttribute("disabled")));
assert(mount.textContent?.includes("didn't finish uploading"));
assert(mount.textContent?.includes("Uploaded"), "the other label still uploaded");
assert.equal(exactText("Done").textContent, "Done");
assert.deepEqual(
  reservations.map(({ label, date }) => [label, date]),
  [
    ["front_a", "2001-02-03"],
    ["side", "2001-02-03"],
  ],
);
assert(queryClient.getQueryState(photoKeys.list("alice", ""))?.isInvalidated, "list refreshes");
await submit();
await settled(() => assert.equal(navigations.length, 1));
assert.equal(reservations.length, 2, "a retry never reserves again");
assert.deepEqual(uploadedIds, [reservations[0]?.id, reservations[1]?.id, reservations[0]?.id]);
assert.deepEqual(navigations.pop(), { to: "/progress/body/photos", replace: true });
checkingUpload = false;

// Leaving the form stops its in-flight upload; nothing navigates afterwards. (The
// scripted navigation doesn't unmount, so leave through the gallery like the router.)
await renderPage("/progress/body/photos", Gallery);
await renderPage("/progress/body/photos/new", New);
await pickFile("Front A");
const abandoned = Promise.withResolvers<Response>();
uploadHeld = abandoned;
await submit();
await settled(() => assert.equal(uploadedIds.length, 4));
const abandonedSignal = uploadSignal;
await renderPage("/progress/body/photos", Gallery);
assert(abandonedSignal?.aborted, "route exit aborts the upload");
await act(async () => {
  abandoned.resolve(
    Response.json({ processedFiles: [{ id: reservations[2]?.id, isUploaded: true }] }),
  );
  await Bun.sleep(10);
});
assert.equal(navigations.length, 0);
await renderPage("/progress/body/photos/new", New);
await act(() => exactText("Cancel").click());
assert.deepEqual(navigations.pop(), { to: "/progress/body/photos", replace: true });

// --- Delete from the viewer: a lost response is reconciled by reading the photo -----
await renderPage(`/progress/body/photos/${id}`, Viewer);
await settled(() => assert(mount.querySelector("h1")));
await act(() => exactText("Delete photo").click());
const dialog = document.querySelector('[role="alertdialog"]');
assert(dialog);
assert.equal(
  document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent,
  "Delete this progress photo?",
);
assert(dialog.textContent?.includes("This can't be undone."));
await act(() => exactText("Delete photo", "button", dialog).click());
await settled(() => assert.equal(navigations.length, 1));
assert(tookDelete);
assert.deepEqual(navigations.pop(), { to: "/progress/body/photos", replace: true });
await renderPage("/progress/body/photos", Gallery);
await settled(() => assert(sheet()));
for (const kind of ["list", "pose", "day"]) {
  const stale = queryClient
    .getQueryCache()
    .findAll({ queryKey: ["progress_photos", "alice", kind] })
    .filter((query) => JSON.stringify(query.state.data ?? null).includes(id));
  assert.equal(stale.length, 0, `no ${kind} list keeps the deleted photo`);
}
assert.equal(
  queryClient
    .getQueryCache()
    .findAll({ queryKey: photoKeys.photo("alice", id) })
    .filter((query) => query.state.data).length,
  0,
  "the deleted photo's row and bytes are forgotten",
);

// --- Another account sees none of it ------------------------------------------------
await act(() => setOwner("bob"));
await renderPage("/progress/body/photos", Gallery);
await settled(() => assert(mount.textContent?.includes("No progress photos yet")));
assert(!mount.textContent?.includes("2001"));
assert.equal(photoQueries("alice").length, 0);
await act(() => root.unmount());
assert.equal(revoked.length, allocated, "every object URL is revoked");

queryClient.clear();
await dom.happyDOM.close();

// This standalone fixture has finished all assertions and teardown.
process.exit(0);
