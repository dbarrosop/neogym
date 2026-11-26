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
  IS_REACT_ACT_ENVIRONMENT: true,
});

let workerWaiting = () => {};
const reloads: boolean[] = [];
const updateServiceWorker = (reload: boolean) => reloads.push(reload);
mock.module("virtual:pwa-register/react", () => ({
  useRegisterSW: () => {
    const [refresh, setRefresh] = useState(false);
    workerWaiting = () => setRefresh(true);
    return { needRefresh: [refresh, setRefresh], updateServiceWorker };
  },
}));

const published: ReactNode[] = [];
const dismissals: string[] = [];
mock.module("sonner", () => ({
  toast: Object.assign(
    (_title: string, { id, action }: { id: string; action: ReactNode }) => {
      published.push(action);
      return id;
    },
    // Sonner does not call onDismiss for programmatic dismissal.
    { dismiss: (id: string) => dismissals.push(id) },
  ),
}));

const { createRoot } = await import("react-dom/client");
const { PWAUpdatePrompt } = await import("@/components/pwa-update-prompt");
const container = document.createElement("div");
const actions = document.createElement("div");
document.body.append(container, actions);
const root = createRoot(container);
const actionRoot = createRoot(actions);

try {
  act(() => root.render(<PWAUpdatePrompt />));
  act(() => workerWaiting());
  assert.equal(published.length, 1);
  act(() => actionRoot.render(published.at(-1)));
  const dismiss = actions.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
  assert(dismiss);
  act(() => dismiss.click());
  assert.deepEqual(dismissals, ["pwa-update"]);
  assert.deepEqual(reloads, []);

  act(() => workerWaiting());
  assert.equal(published.length, 2, "A later waiting worker still publishes a prompt");
  act(() => actionRoot.render(published.at(-1)));
  const reload = [...actions.querySelectorAll("button")].find(
    (button) => button.textContent === "Reload",
  );
  assert(reload);
  act(() => reload.click());
  assert.deepEqual(reloads, [true]);
} finally {
  act(() => {
    actionRoot.unmount();
    root.unmount();
  });
  await dom.happyDOM.close();
}
console.info("Dismissing an update still lets a later waiting worker offer Reload.");
