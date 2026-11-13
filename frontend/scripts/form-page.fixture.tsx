// Run in a subprocess so DOM globals stay isolated from other tests.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act, type ComponentProps, type SubmitEvent } from "react";

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
  getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});

mock.module("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: "/me/journal/new" } }),
  Link: ({ children }: ComponentProps<"a">) => <a href="#crumb">{children}</a>,
}));

const { createRoot } = await import("react-dom/client");
const { FormActions } = await import("@/components/patterns/form-actions");
const { DangerZone, FormPage } = await import("@/components/patterns/form-page");
const { Dialog, DialogContent, DialogDescription, DialogTitle } = await import(
  "@/components/ui/dialog"
);
const { useFormPageFormId } = await import("@/lib/form-page-context");

const submitted: string[] = [];
const cancelled: string[] = [];
let deleteRequests = 0;

function DemoForm({ name, disabled = false }: { name: string; disabled?: boolean }) {
  const formId = useFormPageFormId();
  return (
    <form
      id={formId}
      aria-label={name}
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        submitted.push(name);
      }}
    >
      <input aria-label={`${name} field`} defaultValue="value" />
      <FormActions
        submitLabel={`Save ${name}`}
        isSubmitting={false}
        submitDisabled={disabled}
        onCancel={() => cancelled.push(name)}
      />
    </form>
  );
}

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
function buttons(selector: string) {
  const slot = document.querySelector(selector);
  assert(slot, `Missing ${selector}`);
  return [...slot.querySelectorAll("button")];
}

try {
  await settle(() =>
    root.render(
      <FormPage
        title="Edit entry"
        danger={
          <DangerZone
            title="Delete this entry"
            description="Removes the entry."
            actionLabel="Delete entry"
            onAction={() => {
              deleteRequests += 1;
            }}
          />
        }
      >
        <DemoForm name="page" />
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Quick food</DialogTitle>
            <DialogDescription>Nested form</DialogDescription>
            <DemoForm name="dialog" />
          </DialogContent>
        </Dialog>
      </FormPage>,
    ),
  );

  const pageForm = document.querySelector('form[aria-label="page"]');
  assert(pageForm?.id, "The page form carries the form page id");
  assert.equal(pageForm.querySelectorAll("button").length, 0, "Page actions leave the form body");

  for (const selector of ['[data-slot="form-page-actions"]', '[data-slot="form-page-footer"]']) {
    const [cancel, save] = buttons(selector);
    assert.equal(cancel?.textContent, "Cancel");
    assert.equal(save?.textContent, "Save page");
    assert.equal(save?.getAttribute("type"), "submit");
    assert.equal(save?.getAttribute("form"), pageForm.id, `${selector} submits the page form`);
  }

  const [headerCancel, headerSave] = buttons('[data-slot="form-page-actions"]');
  await settle(() => headerSave?.click());
  assert.deepEqual(submitted, ["page"], "Header Save submits the page form");
  await settle(() => headerCancel?.click());
  assert.deepEqual(cancelled, ["page"]);

  const dialogForm = document.querySelector('form[aria-label="dialog"]');
  assert(dialogForm, "Dialog form renders");
  assert.equal(dialogForm.id, "", "Dialog forms do not take the page form id");
  assert.deepEqual(
    [...dialogForm.querySelectorAll("button")].map((button) => button.textContent),
    ["Cancel", "Save dialog"],
    "Dialog forms keep inline actions",
  );
  assert.equal(buttons('[data-slot="form-page-actions"]').length, 2);

  const danger = document.querySelector("section[aria-labelledby] h2");
  assert.equal(danger?.textContent, "Delete this entry");
  const deleteButton = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === "Delete entry",
  );
  await settle(() => deleteButton?.click());
  assert.equal(deleteRequests, 1, "The delete card only requests confirmation");
  assert.equal(document.querySelector("h1")?.textContent, "Edit entry");
  assert.equal(
    document.querySelector('[aria-label="Breadcrumb"]')?.textContent,
    "MeJournalNew",
    "The sticky header carries the breadcrumb trail",
  );
} finally {
  act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info("Form pages move Cancel and Save into sticky bars; dialogs keep inline actions.");
