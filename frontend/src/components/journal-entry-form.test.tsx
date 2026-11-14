import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JournalEntryForm } from "@/components/journal-entry-form";

function renderForm(body: string) {
  return renderToStaticMarkup(
    <JournalEntryForm
      initialValues={{
        entryDate: "2026-06-25",
        title: "Training notes",
        body,
        labels: [{ id: "label-1", name: "focus" }],
      }}
      submitLabel="Save"
      isSubmitting={false}
      labelSuggestions={[{ id: "label-2", name: "recovery" }]}
      onSubmit={() => undefined}
      onCancel={() => undefined}
      extraActions={<button type="button">Delete entry</button>}
    />,
  );
}

const TEXTAREA_TAG = /<textarea[^>]*>/;

function labelFor(markup: string, text: string) {
  const match = markup.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${text}`));
  expect(match).not.toBeNull();
  return match?.[1] ?? "";
}

describe("JournalEntryForm", () => {
  it("renders the editor fields, labels, and canonical form actions", () => {
    const markup = renderForm("Felt strong today.");

    expect(markup).toContain("Date");
    expect(markup).toContain("Title");
    expect(markup).toContain("Optional");
    expect(markup).toContain("Entry · Markdown");
    expect(markup).not.toContain("Markdown supported");
    expect(markup).toContain("Labels");
    expect(markup).toContain("focus");
    expect(markup).toContain("Press Enter to add.");
    expect(markup).toContain("Cancel");
    expect(markup).toContain(">Save<");
    expect(markup).toContain("Delete entry");
  });

  it("labels each field and writes the entry in a monospace textarea", () => {
    const markup = renderForm("Felt strong today.");

    for (const text of ["Date", "Title", "Entry · Markdown", "Labels"]) {
      const id = labelFor(markup, text);
      expect(markup).toContain(`id="${id}"`);
    }
    const textarea = markup.match(TEXTAREA_TAG)?.[0] ?? "";
    expect(textarea).toContain(`id="${labelFor(markup, "Entry · Markdown")}"`);
    expect(textarea).toContain("font-mono");
    // As on the board, only Title carries the "Optional" suffix.
    expect(markup.match(/Optional/g)?.length).toBe(1);
  });

  it("disables submit when the required body is blank", () => {
    const markup = renderForm("   ");

    expect(markup).toContain("disabled");
  });
});
