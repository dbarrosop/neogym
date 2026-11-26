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
const { DangerZone, FormPage, FormPageAside } = await import("@/components/patterns/form-page");
const { FormSection } = await import("@/components/patterns/form-actions");
const { ConfirmActionDialog } = await import("@/components/patterns/confirm-action-dialog");
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

function SectionsForm() {
  const formId = useFormPageFormId();
  return (
    <form id={formId} aria-label="meal">
      <FormSection card title="Details">
        <input aria-label="Meal name" defaultValue="Breakfast" />
      </FormSection>
      <FormSection card title="Ingredients">
        <input aria-label="Grams" defaultValue="30" />
      </FormSection>
      <FormPageAside>
        <aside aria-label="Live meal totals">373 kcal</aside>
      </FormPageAside>
      <FormActions submitLabel="Save" isSubmitting={false} onCancel={() => undefined} />
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
  assert.equal(deleteButton?.querySelector("svg"), null, "The delete card button is text only");
  await settle(() => deleteButton?.click());
  assert.equal(deleteRequests, 1, "The delete card only requests confirmation");
  assert.equal(document.querySelector("h1")?.textContent, "Edit entry");
  assert.equal(
    document.querySelector('[aria-label="Breadcrumb"]')?.textContent,
    "MeJournalNew",
    "The sticky header carries the breadcrumb trail",
  );

  // Section layout: no wrapping card, a form-owned aside portals into the side column.
  await settle(() =>
    root.render(
      <FormPage title="Edit meal" width="split" layout="sections">
        <SectionsForm />
      </FormPage>,
    ),
  );
  const aside = document.querySelector('[data-slot="form-page-aside"]');
  assert.equal(
    aside?.querySelector('aside[aria-label="Live meal totals"]')?.textContent,
    "373 kcal",
    "FormPageAside renders in the page's side column",
  );
  const sections = document.querySelectorAll("section[aria-labelledby]");
  assert.equal(sections.length, 2, "Each FormSection card is a labelled section");
  assert.equal(
    sections[0]?.parentElement?.querySelector(":scope > .rounded-xl.border.bg-card.p-4"),
    null,
    "Section layout does not wrap the form in another card",
  );
  assert(document.querySelector(".max-w-\\[1180px\\]"), "The split width is 1180 px");

  // Destructive confirmations are alert dialogs: no close button, focus on Cancel.
  let confirmed = 0;
  await settle(() =>
    root.render(
      <ConfirmActionDialog
        open={true}
        onOpenChange={() => undefined}
        title="Delete Lower A?"
        description="This can't be undone."
        confirmLabel="Delete workout"
        onConfirm={() => {
          confirmed += 1;
        }}
        isPending={false}
        destructive={true}
      />,
    ),
  );
  const alert = document.querySelector('[role="alertdialog"]');
  assert(alert, "Confirmations use role alertdialog");
  assert.equal(alert.querySelector('[aria-label="Close"]'), null, "No close button");
  assert.equal(document.activeElement?.textContent, "Cancel", "Focus starts on Cancel");
  const confirm = [...alert.querySelectorAll("button")].find(
    (button) => button.textContent === "Delete workout",
  );
  assert(confirm?.className.includes("bg-destructive-fill"), "Confirm is the filled red button");
  await settle(() => confirm?.click());
  assert.equal(confirmed, 1);
} finally {
  act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info("Form pages move Cancel and Save into sticky bars; dialogs keep inline actions.");
