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
      submitLabel="Save entry"
      isSubmitting={false}
      labelSuggestions={[{ id: "label-2", name: "recovery" }]}
      onSubmit={() => undefined}
      onCancel={() => undefined}
      extraActions={<button type="button">Delete entry</button>}
    />,
  );
}

describe("JournalEntryForm", () => {
  it("renders journal fields, labels, and canonical form actions", () => {
    const markup = renderForm("Felt strong today.");

    expect(markup).toContain("Date");
    expect(markup).toContain("Title");
    expect(markup).toContain("Entry");
    expect(markup).toContain("Markdown supported");
    expect(markup).toContain("Labels");
    expect(markup).toContain("focus");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("Save entry");
    expect(markup).toContain("Delete entry");
  });

  it("disables submit when the required body is blank", () => {
    const markup = renderForm("   ");

    expect(markup).toContain("disabled");
  });
});
