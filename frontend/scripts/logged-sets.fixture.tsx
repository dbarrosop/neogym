// Run in a subprocess so DOM globals and module mocks stay isolated.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act } from "react";

const dom = new Window({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});
mock.module("@/lib/storage", () => ({ fileUrl: () => "#test-image" }));

const { createRoot } = await import("react-dom/client");
const { LoggedSetsTable } = await import("@/components/session-exercise-card");
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const edits: string[] = [];
const sets = [
  { id: "first", setNumber: 1, weight: "50", reps: 8 },
  { id: "second", setNumber: 2, weight: 60, reps: 10 },
  { id: "bodyweight", setNumber: 3, weight: 0, reps: 12 },
];

try {
  await act(() =>
    root.render(
      <>
        <LoggedSetsTable
          sets={sets}
          multiplier={2}
          onEdit={(set) => edits.push(`first:${set.id}`)}
        />
        <LoggedSetsTable
          sets={[{ id: "other", setNumber: 1, weight: 20, reps: 6 }]}
          multiplier={1}
          onEdit={(set) => edits.push(`second:${set.id}`)}
        />
        <LoggedSetsTable sets={[]} multiplier={1} onEdit={() => assert.fail("Empty list edit")} />
      </>,
    ),
  );
  const lists = [...container.querySelectorAll('ol[aria-label="Logged sets"]')];
  assert.equal(lists.length, 2, "Empty sets render no list");
  const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
  assert.equal(buttons.length, 4, "One native button per set, across exercises");
  const expectedValues = [
    ["50 kg", "8", "800 kg"],
    ["60 kg", "10", "1,200 kg"],
    ["BW", "12", "0 kg"],
    ["20 kg", "6", "120 kg"],
  ];
  const descriptionIds = new Set<string>();
  for (const [index, button] of buttons.entries()) {
    assert.equal(button.type, "button", "Set edits cannot submit a surrounding form");
    assert(button.classList.contains("grid"));
    assert(button.classList.contains("min-h-11"));
    assert(button.classList.contains("w-full"));
    assert(!button.classList.contains("absolute"));
    assert(!button.closest("table"), "Do not rely on Safari's positioned table rows");
    assert.equal(button.parentElement?.querySelectorAll("button").length, 1);
    const description = button.getAttribute("aria-describedby")?.split(" ");
    assert(description && description.length === 3);
    for (const id of description) {
      assert(!descriptionIds.has(id), "Description IDs must be unique across exercises");
      descriptionIds.add(id);
      assert(button.contains(document.getElementById(id)), "Values belong to their row's button");
    }
    const values = [...button.children].slice(1, 4);
    assert.equal(values[0]?.textContent, `Weight: ${expectedValues[index]?.[0]}`);
    assert.equal(values[1]?.textContent, `Reps: ${expectedValues[index]?.[1]}`);
    assert.equal(values[2]?.textContent, `Volume: ${expectedValues[index]?.[2]}`);
    assert(values[2]?.classList.contains("hidden"));
    assert(values[2]?.classList.contains("sm:block"), "Volume remains desktop-only");
    button.focus();
    assert.equal(document.activeElement, button);
    // Values and the tick are part of this native button, never separate overlays.
    for (const target of [...values, button.querySelector("svg")]) {
      assert(target);
      target.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    }
  }
  assert.deepEqual(
    edits,
    ["first:first", "first:second", "first:bodyweight", "second:other"].flatMap((id) =>
      new Array<string>(4).fill(id),
    ),
    "Every cell/tick edits its own set, not the first set or another exercise",
  );
} finally {
  await act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info(
  "Logged set buttons keep their values and edit targets in flow and scoped to each set.",
);
