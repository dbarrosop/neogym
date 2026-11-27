// Isolated process: the real photo components run with scripted route and API boundaries.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { getOperationAST, parse } from "graphql";
import { Window } from "happy-dom";
import { act, type ReactNode } from "react";

const dom = new Window({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
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
let beforeExclusive: (() => Promise<void>) | undefined;
let afterExclusive: (() => void) | undefined;
Object.defineProperty(navigator, "locks", {
  value: {
    async request(_name: string, { mode }: LockOptions, run: () => Promise<unknown>) {
      if (mode !== "exclusive") {
        return run();
      }
      await beforeExclusive?.();
      try {
        return await run();
      } finally {
        afterExclusive?.();
      }
    },
  },
});
const id = "558e5143-0f20-4014-970e-50ed9e0a32a8";
let pathname = "/progress/body/photos";
let outlet: ReactNode;
let owner: string | undefined = "alice";
const navigations: unknown[] = [];
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ photoId: id }),
    useSearch: () => ({}),
    useNavigate: () => (value: unknown) => navigations.push(value),
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
const { createClient } = await import("@nhost/nhost-js");
const client = createClient({ subdomain: "local", region: "local" });
mock.module("@/lib/nhost/auth-provider", () => ({
  useAuth: () => ({
    nhost: client,
    user: owner ? { id: owner } : null,
    isAuthenticated: Boolean(owner),
  }),
}));
mock.module("@/lib/graphql", () => ({ gqlRequest: () => new Promise(() => undefined) }));
mock.module("@/components/progress/quick-entry-forms", () => ({
  QuickBodyMeasurementForm: () => null,
}));
mock.module("@/lib/progress-photos/prepare", () => ({
  preparePhoto: () => Promise.resolve(new Blob(["prepared fixture"], { type: "image/jpeg" })),
}));

const BASE64_PADDING = /=+$/;
function session(name: string, refreshToken: string, expiresIn: number) {
  const token = `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresIn, sub: name })).replace(BASE64_PADDING, "")}.fake`;
  return {
    accessToken: token,
    accessTokenExpiresIn: expiresIn,
    refreshToken,
    refreshTokenId: name,
    user: { id: name },
  } as Parameters<typeof client.sessionStorage.set>[0];
}
function signIn(name: string, refreshToken = `fixture-${name}`, expiresIn = 3600) {
  client.sessionStorage.set(session(name, refreshToken, expiresIn));
}
const revoked: string[] = [];
let allocated = 0;
URL.createObjectURL = () => `blob:http://localhost/test-${++allocated}`;
URL.revokeObjectURL = (url) => {
  revoked.push(url);
};
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
let reservations = 0;
let uploadSignal: AbortSignal | null | undefined;
let checkingUpload = false;
let authEndpoint: ((init: RequestInit) => Promise<Response>) | undefined;
let mutationMode: "save" | "delete" = "save";
let tookDelete = false;
let requests = 0;
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
  assert.equal(where.userId._eq, client.getUserSession()?.user?.id);
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
globalThis.fetch = ((url: string, init: RequestInit) => {
  if (url.endsWith("/token")) {
    assert(authEndpoint, "Unexpected Auth refresh");
    assert.equal(init.signal, undefined, "Photo cancellation must not reach Auth");
    return authEndpoint(init);
  }
  requests++;
  assert.equal(init.cache, "no-store");
  assert.equal(init.credentials, "omit");
  assert.equal(init.redirect, "error");
  assert.equal(init.referrerPolicy, "no-referrer");
  assert.equal(
    new Headers(init.headers).get("Authorization"),
    `Bearer ${client.getUserSession()?.accessToken}`,
  );
  assert(client.getUserSession()?.user);
  if (url.endsWith("/files") && init.method === "POST") {
    assert(init.body instanceof FormData);
    const metadata = init.body.get("metadata[]");
    assert(metadata instanceof Blob);
    uploadSignal = init.signal;
    // Count synchronous issuance separately from reading the multipart bytes.
    const held = uploadHeld;
    return metadata.text().then((text) => {
      uploadedIds.push(JSON.parse(text).id);
      return held?.promise ?? Response.json({ processedFiles: [{ id, isUploaded: true }] });
    });
  }
  if (url.includes("/files/")) {
    if (init.method === "DELETE") {
      tookDelete = true;
      return Promise.reject(new Error("response lost"));
    }
    imageSignal = init.signal;
    return (
      fileHeld?.promise ??
      Promise.resolve(
        new Response(new Uint8Array([1]), { headers: { "Content-Type": "image/jpeg" } }),
      )
    );
  }
  const { query, variables } = JSON.parse(String(init.body));
  const operation = getOperationAST(parse(query))?.name?.value;
  switch (operation) {
    case "ProgressPhotoLabels":
      return Promise.resolve(
        json({ progressPhotoLabels: [photo.label, { value: "back_b", comment: "Back B" }, side] }),
      );
    case "ProgressPhotoSummary": {
      const currentOwner = client.getUserSession()?.user?.id;
      assert.deepEqual(variables.where, {
        userId: { _eq: currentOwner },
        file: { isUploaded: { _eq: true } },
      });
      const alice = currentOwner === "alice";
      return Promise.resolve(
        json({
          progressPhotosAggregate: {
            aggregate: { count: alice ? 17 : 0, max: { takenOn: alice ? photo.takenOn : null } },
          },
        }),
      );
    }
    case "ProgressPhotoHistory":
      return Promise.resolve(historyResponse(variables.where));
    case "ProgressPhotoDetails":
      return Promise.resolve(
        json({
          progressPhoto: tookDelete ? null : { ...photo, file: checkingUpload ? null : photo.file },
        }),
      );
    case "ReserveProgressPhoto":
      assert.equal(variables.label, "side");
      reservations++;
      return Promise.resolve(json({ insertProgressPhoto: { id } }));
    case "UpdateProgressPhoto": {
      assert.equal(mutationMode, "save");
      assert.deepEqual(variables, { id, label: "side", date: "2001-02-03" });
      return Promise.resolve(json({ updateProgressPhoto: { id } }));
    }
    default:
      throw new Error(`Unexpected operation ${operation}`);
  }
}) as typeof fetch;

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { photoFetch } = await import("@/lib/progress-photos/api");
const { PhotoScope } = await import("@/lib/progress-photos/scope");
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
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function view(route: { options: { component?: unknown } }) {
  const Component = route.options.component as () => ReactNode;
  return <Component />;
}
async function renderPage(path: string, route: Parameters<typeof view>[0]) {
  pathname = path;
  outlet = view(route);
  await act(() => {
    root.render(
      path === "/progress/body" ? (
        <QueryClientProvider client={queryClient}>{outlet}</QueryClientProvider>
      ) : (
        view(PhotoLayout)
      ),
    );
  });
}
async function settled(assertion: () => void) {
  let error: unknown;
  for (let attempt = 0; attempt < 20; attempt++) {
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

function holdRefresh(expiresIn = 30) {
  signIn("alice", "before-refresh", expiresIn);
  const issued = Promise.withResolvers<void>();
  const response = Promise.withResolvers<Response>();
  const done = Promise.withResolvers<void>();
  afterExclusive = done.resolve;
  let calls = 0;
  const invalid = () => Response.json({ error: "invalid-refresh-token" }, { status: 401 });
  authEndpoint = (init) => {
    assert.deepEqual(JSON.parse(String(init.body)), { refreshToken: "before-refresh" });
    calls++;
    issued.resolve();
    return calls === 1 ? response.promise : Promise.resolve(invalid());
  };
  return {
    issued: issued.promise,
    done: done.promise,
    respond: () => response.resolve(Response.json(session("alice", "rotated", 3600))),
    reject: () => response.resolve(invalid()),
    calls: () => calls,
  };
}

async function verifyIssuedRefresh(
  reason: "close" | "hide" | "timeout",
  expected: string | null = "rotated",
  replaceSession?: () => void,
) {
  const refresh = holdRefresh();
  const scope = new PhotoScope(client, "alice", () => undefined);
  const caller = new AbortController();
  const result = photoFetch(scope, client.graphql.url, {}, caller.signal, 9000);
  const rejected = assert.rejects(result, {
    name: reason === "timeout" ? "TimeoutError" : "AbortError",
  });
  await refresh.issued;
  if (reason === "hide") {
    visibility(true);
  } else {
    if (reason === "timeout") {
      caller.abort(new DOMException("Photo timeout", "TimeoutError"));
    } else {
      scope.close();
    }
    // Auth is still held: closing the scope or timing out releases only the caller.
    await rejected;
  }
  replaceSession?.();
  refresh.respond();
  await refresh.done;
  await rejected;
  assert.equal(client.getUserSession()?.refreshToken ?? null, expected);
  assert.equal(requests, 0, "a cancelled refresh wait must not issue photo traffic");
  visibility(false);
}

async function verifyRefreshLineage() {
  const locked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  beforeExclusive = () => {
    locked.resolve();
    return release.promise;
  };
  const refresh = holdRefresh(-30);
  const scope = new PhotoScope(client, "alice", () => undefined);
  const token = scope.accessToken(scope.signal);
  await locked.promise;
  signIn("alice", "replacement-under-lock");
  release.resolve();
  assert.equal(await token, client.getUserSession()?.accessToken);
  assert.equal(refresh.calls(), 0, "the old lock waiter must not refresh a new sign-in");
  beforeExclusive = undefined;

  const invalid = holdRefresh(-30);
  const old = new PhotoScope(client, "alice", () => undefined);
  const outcome = old.accessToken(old.signal);
  await invalid.issued;
  signIn("alice", "replacement-before-retry", -30);
  const failed = assert.rejects(outcome, { message: "A current sign-in is required." });
  invalid.reject();
  await failed;
  assert.equal(invalid.calls(), 1, "the retry must not use the replacement credential");
  assert.equal(client.getUserSession()?.refreshToken, "replacement-before-retry");

  const expired = holdRefresh(-30);
  const closing = new PhotoScope(client, "alice", () => undefined);
  const cancelled = assert.rejects(closing.accessToken(closing.signal), { name: "AbortError" });
  await expired.issued;
  closing.close();
  await cancelled;
  expired.reject();
  await settled(() => assert.equal(client.getUserSession(), null));
  assert.equal(expired.calls(), 2, "the SDK still clears the same expired credential after retry");
  authEndpoint = undefined;
  afterExclusive = undefined;
}

await verifyIssuedRefresh("close");
await verifyIssuedRefresh("hide");
await verifyIssuedRefresh("timeout");
await verifyIssuedRefresh("close", null, () => client.clearSession());
await verifyIssuedRefresh("close", "fixture-bob", () => signIn("bob"));
await verifyIssuedRefresh("close", "fresh-sign-in", () => signIn("alice", "fresh-sign-in"));
await verifyRefreshLineage();
signIn("alice");
await renderPage("/progress/body", Body);
const summary = mount.querySelector("section[aria-labelledby]");
assert(summary);
assert.equal(exactText("View progress photos", "a").getAttribute("href"), "/progress/body/photos");
assert(exactText("Log measurement", "a"));
await settled(() => assert(summary.textContent?.includes("17 photos")));
assert.equal(summary.querySelector("time")?.dateTime, photo.takenOn);
assert.equal(requests, 1, "the card does not fetch a photo list or bytes");
assert(
  !queryClient
    .getQueryCache()
    .getAll()
    .some((query) => query.queryKey[0] === "photo-summary"),
);
await act(() => {
  owner = "bob";
  signIn("bob");
  assert(
    summary.querySelector("time")?.closest("[hidden]"),
    "owner loss conceals the date immediately",
  );
});
await renderPage("/progress/body", Body);
await settled(() => assert(summary.textContent?.includes("0 photos")));
assert(!summary.querySelector("time"));
owner = "alice";
assert.deepEqual(
  __testing.trailFor(`/progress/body/photos/${id}/edit`).map((crumb) => crumb.label),
  ["Progress", "Body", "Progress photos", "Photo", "Edit"],
);

const beforeStale = requests;
// Stale render of Alice must not fetch as Bob.
await renderPage("/progress/body/photos", Gallery);
assert.equal(requests, beforeStale);
await act(() => {
  signIn("alice");
});
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
assert.equal(
  timeline()?.querySelectorAll("a").length,
  15,
  "a failed next page keeps existing photos",
);
nextPageFails = false;
await act(() => exactText("Load older photos").click());
await settled(() => assert.equal(timeline()?.children.length, 2));
assert.deepEqual(
  [...mount.querySelectorAll("time")].map((time) => time.dateTime),
  [photo.takenOn, "2001-01-31"],
);
assert.equal(timeline()?.firstElementChild?.querySelectorAll("a").length, 16);
assert.equal(timeline()?.lastElementChild?.querySelectorAll("a").length, 1);
await settled(() => assert(mount.querySelector("img[src^='blob:']")));
const firstURL = mount.querySelector("img")?.src;
assert(firstURL);
const filter = mount.querySelector("select");
assert(filter);
async function selectLabel(select: HTMLSelectElement, value: string) {
  await act(() => {
    select.value = value;
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
await selectLabel(filter, "side");
await settled(() => assert(mount.textContent?.includes("No photos for this label")));
assert.equal(lastFilter, "side", "a newer catalog value must remain a GraphQL filter");
assert(revoked.includes(firstURL));

const held = Promise.withResolvers<Response>();
fileHeld = held;
await renderPage(`/progress/body/photos/${id}`, Viewer);
await settled(() => assert(imageSignal && !imageSignal.aborted));
const oldSignal = imageSignal;
const beforeLate = allocated;
await act(() => {
  client.clearSession();
  assert(mount.querySelector("div")?.hidden, "sign-out conceals synchronously");
  held.resolve(new Response(new Uint8Array([1]), { headers: { "Content-Type": "image/jpeg" } }));
});
assert(oldSignal?.aborted);
assert.equal(allocated, beforeLate);
assert(!mount.textContent?.includes("2001"));
fileHeld = undefined;
await act(() => signIn("alice"));
await settled(() => assert(mount.querySelector("img[src^='blob:']")));
const beforeHide = allocated;
await act(() => {
  window.dispatchEvent(new window.Event("pagehide"));
  assert(mount.querySelector("div")?.hidden);
  window.dispatchEvent(new window.Event("pageshow"));
});
await settled(() => assert(allocated > beforeHide && !mount.querySelector("div")?.hidden));
assert(revoked.includes(`blob:http://localhost/test-${beforeHide}`));
assert.equal(exactText("Edit", "a").dataset["replace"], "true");
const viewerURL = mount.querySelector("img")?.src;
assert(viewerURL);
await act(() => visibility(true));
assert(!mount.querySelector("img"));
assert(revoked.includes(viewerURL), "viewing routes still revoke images on ordinary hide");
await act(() => visibility(false));
await settled(() => assert(mount.querySelector("img[src^='blob:']")));

await renderPage("/progress/body/photos/new", New);
assert.equal(
  mount.querySelector<HTMLInputElement>("input[type=date]")?.value,
  new Date().toLocaleDateString("en-CA"),
);
async function submitForm() {
  await act(() => {
    const form = mount.querySelector("form");
    assert(form);
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
}
const chooser = mount.querySelector<HTMLInputElement>("input[type=file]");
assert(chooser);
chooser.focus();
await act(() => visibility(true));
assert.equal(mount.querySelector("input[type=file]"), chooser);
assert.equal(document.activeElement, chooser);
assert(!chooser.closest("[hidden]"), "the native file control must not be hidden");
await act(() => {
  const selected = new File(["fixture"], "synthetic.jpg", { type: "image/jpeg" });
  Object.defineProperty(chooser, "files", { value: { item: () => selected } });
  chooser.dispatchEvent(new window.Event("change", { bubbles: true }));
});
const preview = mount.querySelector<HTMLImageElement>('img[alt="Preview for upload"]');
assert(preview);
assert(preview.closest("[data-photo-concealed]"));
await act(() => visibility(false));
assert.equal(mount.querySelector('img[alt="Preview for upload"]'), preview);
assert(!preview.closest("[data-photo-concealed]"));
const newLabel = mount.querySelector("select");
assert(newLabel);
await selectLabel(newLabel, "side");
assert(!exactText("Upload photo").hasAttribute("disabled"));
const uploading = Promise.withResolvers<Response>();
uploadHeld = uploading;
checkingUpload = true;
await submitForm();
await settled(() => assert.equal(uploadedIds.length, 1));
await act(() => visibility(true));
assert.equal(mount.querySelector("input[type=file]"), chooser);
assert(uploadSignal && !uploadSignal.aborted);
await act(() => uploading.resolve(new Response(null, { status: 500 })));
await settled(() => assert(!exactText("Check upload").hasAttribute("disabled")));
await act(() => visibility(false));
uploadHeld = undefined;
await submitForm();
await settled(() => assert.equal(navigations.length, 1));
assert.equal(reservations, 1);
assert.deepEqual(uploadedIds, [id, id]);
assert.deepEqual(navigations.pop(), {
  to: "/progress/body/photos/$photoId",
  params: { photoId: id },
  replace: true,
});
checkingUpload = false;
await act(() => window.dispatchEvent(new window.Event("pagehide")));
assert(!chooser.isConnected);
assert(!mount.querySelector("form"));
assert(revoked.includes(preview.src));
await act(() => window.dispatchEvent(new window.Event("pageshow")));
assert.notEqual(mount.querySelector("input[type=file]"), chooser);
assert(!mount.querySelector('img[alt="Preview for upload"]'));
assert(exactText("Upload photo").hasAttribute("disabled"));
const restoredChooser = mount.querySelector("input[type=file]");
await act(() => {
  visibility(true);
  client.clearSession();
});
assert(!restoredChooser?.isConnected, "sign-out must retire the concealed create route");
await act(() => {
  visibility(false);
  signIn("alice");
});
await act(() => exactText("Cancel").click());
assert.deepEqual(navigations.pop(), { to: "/progress/body/photos", replace: true });
await renderPage(`/progress/body/photos/${id}/edit`, Edit);
await settled(() => assert(!exactText("Save changes").hasAttribute("disabled")));
const editLabel = mount.querySelector("select");
assert(editLabel);
await selectLabel(editLabel, "side");
await submitForm();
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
const confirmDelete = [...dialog.querySelectorAll("button")].find(
  (button) => button.textContent === "Delete photo",
);
assert(confirmDelete);
await act(() => confirmDelete.click());
assert(tookDelete);
assert.deepEqual(navigations.pop(), { to: "/progress/body/photos", replace: true });
owner = "bob";
await act(() => signIn("bob"));
await renderPage("/progress/body/photos", Gallery);
await settled(() => assert(mount.textContent?.includes("No progress photos")));
assert(!mount.textContent?.includes("2001"));
await act(() => root.unmount());
assert.equal(revoked.length, allocated);

queryClient.clear();
await dom.happyDOM.close();

// This standalone fixture has finished all assertions and teardown.
process.exit(0);
