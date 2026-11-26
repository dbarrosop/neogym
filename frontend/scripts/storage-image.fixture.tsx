// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act } from "react";

const dom = new Window({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
let reduceMotion = true;
Object.assign(window, {
  matchMedia: () => ({
    get matches() {
      return reduceMotion;
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

mock.module("@/lib/storage", () => ({ fileUrl: (id: string) => `https://files.test/${id}` }));

const { createRoot } = await import("react-dom/client");
const { AlternatingStorageImage } = await import("@/components/storage-image");
const { ExerciseThumbnail } = await import("@/components/exercise-thumbnail");

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const loadAll = () =>
  act(() => {
    for (const img of container.querySelectorAll("img")) {
      img.dispatchEvent(new window.Event("load"));
    }
  });
const visibleSrc = () =>
  [...container.querySelectorAll("img")].find((img) => img.className.includes("opacity-100"))?.src;
const dots = () => [...container.querySelectorAll<HTMLButtonElement>("button[aria-label^=Show]")];

// Reduced motion: no auto-advance, but the dots still switch images.
await act(() =>
  root.render(
    <AlternatingStorageImage
      fileIds={["start", "end"]}
      alt="Leg Extensions, form demo"
      frame="session"
      pager
      intervalMs={20}
    />,
  ),
);
await loadAll();
await sleep(80);
assert.equal(visibleSrc(), "https://files.test/start");
assert.deepEqual(
  dots().map((dot) => [dot.getAttribute("aria-label"), dot.getAttribute("aria-pressed")]),
  [
    ["Show image 1 of 2", "true"],
    ["Show image 2 of 2", "false"],
  ],
);
assert.equal(
  container.querySelectorAll('img[alt="Leg Extensions, form demo"]').length,
  1,
  "only the visible image is announced",
);
await act(() => dots()[1]?.click());
assert.equal(visibleSrc(), "https://files.test/end");
assert.equal(dots()[1]?.getAttribute("aria-pressed"), "true");

// Without reduced motion it alternates by itself until the viewer picks an image.
reduceMotion = false;
await act(() => root.unmount());
const root2 = createRoot(container);
await act(() =>
  root2.render(<AlternatingStorageImage fileIds={["start", "end"]} alt="" pager intervalMs={50} />),
);
await loadAll();
await act(() => sleep(75));
assert.equal(visibleSrc(), "https://files.test/end");
await act(() => dots()[0]?.click());
await act(() => sleep(130));
assert.equal(visibleSrc(), "https://files.test/start", "a manual pick stops alternation");
await act(() => root2.unmount());

// Thumbnails fall back to a glyph without an image.
const root3 = createRoot(container);
await act(() => root3.render(<ExerciseThumbnail fileId={null} size={36} />));
const thumb = container.firstElementChild;
assert.equal(thumb?.getAttribute("aria-hidden"), "true");
assert(thumb?.className.includes("size-9"));
assert(container.querySelector("svg"), "photo glyph fallback");
await act(() => root3.render(<ExerciseThumbnail fileId="start" />));
assert.equal(container.querySelector("img")?.getAttribute("src"), "https://files.test/start");
await act(() => root3.unmount());

process.stdout.write("Exercise images honour reduced motion, pager dots and thumbnail fallback.\n");
