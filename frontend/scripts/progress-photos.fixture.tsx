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
    replace,
    className,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { photoId: string };
    replace?: boolean;
    className?: string;
    "aria-current"?: "page";
  }) => (
    <a
      href={to.replace("$photoId", params?.photoId ?? "")}
      className={className}
      data-replace={replace}
      aria-current={props["aria-current"]}
    >
      {children}
    </a>
  ),
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
const photo = {
  id,
  takenOn: "2001-02-03",
  createdAt: "2026-11-25T10:00:00.123Z",
  label: { value: "front_a", comment: "Front A" },
  file: { id, isUploaded: true },
};
const side = { value: "side", comment: "Side" };
function fixturePhoto(number: number, takenOn = photo.takenOn) {
  const id = `39d36419-4eb1-4190-8213-${String(number).padStart(12, "0")}`;
  return { ...photo, id, takenOn, file: { id, isUploaded: true } };
}
const pending = { ...fixturePhoto(15), file: null };
let listFails = true;
let nextPageFails = true;
let lastFilter: string | undefined;
let fileHeld: ReturnType<typeof Promise.withResolvers<Response>> | undefined;
let uploadHeld: ReturnType<typeof Promise.withResolvers<Response>> | undefined;
const uploadedIds: string[] = [];
let lastUpload: { bucket: unknown; name: string; type: string } | undefined;
let reservations = 0;
let uploadSignal: AbortSignal | null | undefined;
let checkingUpload = false;
let mutationMode: "save" | "delete" = "save";
let tookDelete = false;
const operations: string[] = [];
const imageRequests: string[] = [];
let imageSignal: AbortSignal | null | undefined;

function json(data: unknown) {
  return Response.json({ data });
}
function historyResponse(where: {
  userId: { _eq: string };
  file: unknown;
  labelValue?: { _eq: string };
  _or?: unknown[];
}) {
  assert.equal(where.userId._eq, auth.user?.id);
  assert.deepEqual(where.file, { isUploaded: { _eq: true } });
  if (listFails) {
    return new Response(null, { status: 500 });
  }
  lastFilter = where.labelValue?._eq;
  if (lastFilter || where.userId._eq !== "alice") {
    return json({ progressPhotos: [] });
  }
  if (where._or) {
    assert.deepEqual(where._or[2], {
      takenOn: { _eq: pending.takenOn },
      createdAt: { _eq: pending.createdAt },
      id: { _lt: pending.id },
    });
    if (nextPageFails) {
      return new Response(null, { status: 503 });
    }
    return json({ progressPhotos: [fixturePhoto(16), fixturePhoto(17, "2001-01-31")] });
  }
  return json({
    progressPhotos: [
      photo,
      ...Array.from({ length: 14 }, (_, i) => fixturePhoto(i + 1)),
      pending,
      fixturePhoto(16),
    ],
  });
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
    return metadata.text().then((text) => {
      uploadedIds.push(JSON.parse(text).id);
      return held?.promise ?? Response.json({ processedFiles: [{ id, isUploaded: true }] });
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
function graphqlResponse(init: RequestInit): Response {
  const { query, variables } = JSON.parse(String(init.body));
  const operation = getOperationAST(parse(query))?.name?.value ?? "";
  if (operation === "BodyMeasurements") {
    return json({ bodyMeasurements: [] });
  }
  assertPhotoRequest(init);
  operations.push(operation);
  switch (operation) {
    case "ProgressPhotoLabels":
      return json({
        progressPhotoLabels: [photo.label, { value: "back_b", comment: "Back B" }, side],
      });
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
      return historyResponse(variables.where);
    case "ProgressPhotoDetails":
      return json({
        progressPhoto: tookDelete ? null : { ...photo, file: checkingUpload ? null : photo.file },
      });
    case "ReserveProgressPhoto":
      assert.equal(variables.label, "side");
      reservations++;
      return json({ insertProgressPhoto: { id } });
    case "UpdateProgressPhoto":
      assert.equal(mutationMode, "save");
      assert.deepEqual(variables, { id, label: "side", date: "2001-02-03" });
      return json({ updateProgressPhoto: { id } });
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
const { Route: Edit } = await import("@/routes/_authed/progress/body/photos/$photoId_.edit");
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
async function renderPage(path: string, route: Parameters<typeof view>[0], keepSearch = false) {
  pathname = path;
  outlet = view(route);
  if (!keepSearch) {
    search = {};
  }
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
function exactText(text: string, tag = "button") {
  const element = [...document.querySelectorAll<HTMLElement>(tag)].find(
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
async function selectLabel(select: HTMLSelectElement, value: string) {
  await act(() => {
    select.value = value;
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function submitForm() {
  await act(() => {
    const form = mount.querySelector("form");
    assert(form);
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function chooseFile() {
  const chooser = mount.querySelector<HTMLInputElement>("input[type=file]");
  assert(chooser);
  await act(async () => {
    const selected = new File(["fixture"], "synthetic.jpg", { type: "image/jpeg" });
    Object.defineProperty(chooser, "files", {
      configurable: true,
      value: { item: () => selected },
    });
    chooser.dispatchEvent(new window.Event("change", { bubbles: true }));
    await Bun.sleep(5);
  });
  await settled(() => assert(mount.querySelector('img[alt="Preview for upload"]')));
  return chooser;
}

// --- Body summary card: owner-scoped count and date, no list or bytes ---------------
await act(() => setOwner("alice"));
await renderPage("/progress/body", Body);
const summary = () =>
  [...mount.querySelectorAll("h2")]
    .find((heading) => heading.textContent === "Progress photos")
    ?.closest("section");
assert.equal(exactText("View progress photos", "a").getAttribute("href"), "/progress/body/photos");
await settled(() => assert(summary()?.textContent?.includes("17 photos")));
assert.equal(summary()?.querySelector("time")?.dateTime, photo.takenOn);
assert.deepEqual(operations, ["ProgressPhotoSummary"], "the card reads only the aggregate");
assert(queryClient.getQueryData(photoKeys.summary("alice")));
await act(() => setOwner("bob"));
await settled(() => assert(summary()?.textContent?.includes("No photos yet")));
assert(!summary()?.querySelector("time"));
assert.equal(photoQueries("alice").length, 0, "an account switch drops the previous owner");
await act(() => setOwner("alice"));
assert.deepEqual(
  __testing.trailFor(`/progress/body/photos/${id}/edit`).map((crumb) => crumb.label),
  ["Progress", "Body", "Progress photos", "Photo", "Edit"],
);

// --- Gallery: retry, paging, date rows, private thumbnails --------------------------
await renderPage("/progress/body/photos", Gallery);
await settled(() => assert(mount.textContent?.includes("Couldn't load photos")));
assert.equal(exactText("Body", "nav a").getAttribute("aria-current"), "page");
listFails = false;
await act(() => exactText("Retry").click());
const timeline = () => mount.querySelector('ol[aria-label="Progress photos"]');
await settled(() => assert.equal(timeline()?.querySelectorAll("a").length, 15));
assert.deepEqual(
  [...mount.querySelectorAll("time")].map((time) => time.dateTime),
  [photo.takenOn],
);
await act(() => exactText("Load older photos").click());
await settled(() => assert(mount.textContent?.includes("Couldn't load older photos")));
assert.equal(timeline()?.querySelectorAll("a").length, 15, "a failed page keeps the photos");
nextPageFails = false;
await act(() => exactText("Load older photos").click());
await settled(() => assert.equal(timeline()?.children.length, 2));
assert.deepEqual(
  [...mount.querySelectorAll("time")].map((time) => time.dateTime),
  [photo.takenOn, "2001-01-31"],
);
assert.equal(timeline()?.firstElementChild?.querySelectorAll("a").length, 16);
assert.equal(timeline()?.lastElementChild?.querySelectorAll("a").length, 1);
await settled(() => assert.equal(mount.querySelectorAll("img[src^='blob:']").length, 17));
assert(
  imageRequests.every((url) => url.includes("w=480")),
  "tiles use the private transform",
);

// Label filter: a catalog value newer than the generated types, kept in the URL.
const filter = mount.querySelector("select");
assert(filter);
await selectLabel(filter, "side");
assert.deepEqual(search, { label: "side" });
assert.equal(searchChanges.at(-1)?.replace, true);
await settled(() => assert(mount.textContent?.includes("No Side photos")));
assert.equal(lastFilter, "side", "a newer catalog value must remain a GraphQL filter");
await act(() => exactText("Show all photos").click());
assert.deepEqual(search, {});
await settled(() => assert.equal(timeline()?.querySelectorAll("a").length, 17));

// Hiding the tab no longer tears anything down.
const imagesBeforeHide = imageRequests.length;
await act(() => visibility(true));
assert.equal(timeline()?.querySelectorAll("img[src^='blob:']").length, 17);
await act(() => visibility(false));
assert.equal(imageRequests.length, imagesBeforeHide);

// --- Viewer, then Back: lists and thumbnails come from the in-memory cache ----------
const historyReads = count("ProgressPhotoHistory");
await renderPage(`/progress/body/photos/${id}`, Viewer);
await settled(() =>
  assert(mount.querySelector("img[src^='blob:'][alt^='Front A progress photo']")),
);
assert(!imageRequests.at(-1)?.includes("w="), "the viewer reads the prepared original");
assert.equal(exactText("Edit", "a").dataset["replace"], "true");
const imagesBeforeBack = imageRequests.length;
await renderPage("/progress/body/photos", Gallery);
assert.equal(timeline()?.querySelectorAll("a").length, 17, "Back keeps the loaded pages");
await settled(() => assert.equal(mount.querySelectorAll("img[src^='blob:']").length, 17));
assert.equal(count("ProgressPhotoHistory"), historyReads, "a fresh list is not refetched");
assert.equal(imageRequests.length, imagesBeforeBack, "cached thumbnails are not downloaded again");

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

// --- Create: preview survives a hidden tab; a lost upload reconciles the same reservation
await act(() => setOwner("alice"));
await renderPage("/progress/body/photos", Gallery);
await settled(() => assert.equal(timeline()?.querySelectorAll("a").length, 15));
await renderPage("/progress/body/photos/new", New);
assert.equal(
  mount.querySelector<HTMLInputElement>("input[type=date]")?.value,
  new Date().toLocaleDateString("en-CA"),
);
const chooser = await chooseFile();
const preview = mount.querySelector('img[alt="Preview for upload"]');
await act(() => visibility(true));
assert.equal(mount.querySelector('img[alt="Preview for upload"]'), preview, "draft kept");
assert(chooser.isConnected);
await act(() => visibility(false));
const newLabel = mount.querySelector("select");
assert(newLabel);
await selectLabel(newLabel, "side");
assert(!exactText("Upload photo").hasAttribute("disabled"));
const uploading = Promise.withResolvers<Response>();
uploadHeld = uploading;
checkingUpload = true;
await submitForm();
await settled(() => assert.equal(uploadedIds.length, 1));
assert.deepEqual(lastUpload, {
  bucket: "progress_photos",
  name: "progress-photo.jpg",
  type: "image/jpeg",
});
await act(() => uploading.resolve(new Response(null, { status: 500 })));
await settled(() => assert(!exactText("Try again").hasAttribute("disabled")));
assert(mount.textContent?.includes("didn't finish uploading"));
uploadHeld = undefined;
await submitForm();
await settled(() => assert.equal(navigations.length, 1));
assert.equal(reservations, 1, "a retry never reserves again");
assert.deepEqual(uploadedIds, [id, id]);
assert.deepEqual(navigations.pop(), {
  to: "/progress/body/photos/$photoId",
  params: { photoId: id },
  replace: true,
});
assert(queryClient.getQueryState(photoKeys.list("alice", ""))?.isInvalidated, "list refreshes");
checkingUpload = false;

// Leaving the form stops its in-flight upload; nothing navigates afterwards. (The
// scripted navigation doesn't unmount, so leave through the gallery like the router.)
await renderPage("/progress/body/photos", Gallery);
await renderPage("/progress/body/photos/new", New);
await chooseFile();
const formLabel = mount.querySelector("select");
assert(formLabel);
await selectLabel(formLabel, "side");
const abandoned = Promise.withResolvers<Response>();
uploadHeld = abandoned;
await submitForm();
await settled(() => assert.equal(uploadedIds.length, 3));
const abandonedSignal = uploadSignal;
await renderPage("/progress/body/photos", Gallery);
assert(abandonedSignal?.aborted, "route exit aborts the upload");
await act(async () => {
  abandoned.resolve(Response.json({ processedFiles: [{ id, isUploaded: true }] }));
  await Bun.sleep(10);
});
assert.equal(navigations.length, 0);
uploadHeld = undefined;
await renderPage("/progress/body/photos/new", New);
await act(() => exactText("Cancel").click());
assert.deepEqual(navigations.pop(), { to: "/progress/body/photos", replace: true });

// --- Edit: save, then delete with a lost response reconciled by reading the photo ---
await renderPage(`/progress/body/photos/${id}/edit`, Edit);
await settled(() => assert(!exactText("Save changes").hasAttribute("disabled")));
const editLabel = mount.querySelector("select");
assert(editLabel);
await selectLabel(editLabel, "side");
await submitForm();
await settled(() => assert.equal(navigations.length, 1));
assert.deepEqual(navigations.pop(), {
  to: "/progress/body/photos/$photoId",
  params: { photoId: id },
  replace: true,
});
mutationMode = "delete";
await act(() => exactText("Delete photo").click());
const dialog = document.querySelector('[role="alertdialog"]');
assert(dialog);
assert.equal(
  document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent,
  "Delete this progress photo?",
);
assert(dialog.textContent?.includes("This can't be undone."));
const confirmDelete = [...dialog.querySelectorAll("button")].find(
  (button) => button.textContent === "Delete photo",
);
assert(confirmDelete);
await act(() => confirmDelete.click());
await settled(() => assert.equal(navigations.length, 1));
assert(tookDelete);
assert.deepEqual(navigations.pop(), { to: "/progress/body/photos", replace: true });
assert.equal(
  queryClient.getQueryCache().findAll({ queryKey: photoKeys.lists("alice") }).length,
  0,
  "the gallery reloads instead of flashing the deleted photo",
);
assert.equal(
  queryClient.getQueryCache().findAll({ queryKey: photoKeys.photo("alice", id) }).length,
  0,
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
