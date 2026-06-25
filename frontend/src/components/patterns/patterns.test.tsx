import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { FormActions, FormSection } from "@/components/patterns/form-actions";
import { FormCardShell, PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";

function normalize(markup: string) {
  return markup.replace(/\s+/g, " ");
}

describe("pattern components", () => {
  it("renders page shell and header chrome around caller-owned content", () => {
    const markup = normalize(
      renderToStaticMarkup(
        <PageShell maxWidth="2xl">
          <PageHeader
            eyebrow="Tracking"
            title="Body"
            description="Log measurements"
            actions={<a href="/body/new">New</a>}
          />
          <p>Domain content</p>
        </PageShell>,
      ),
    );

    expect(markup).toContain("grid-bg");
    expect(markup).toContain("max-w-2xl");
    expect(markup).toContain("Tracking");
    expect(markup).toContain("Body");
    expect(markup).toContain("Domain content");
  });

  it("renders form card shell chrome around caller-owned content", () => {
    const markup = normalize(
      renderToStaticMarkup(
        <FormCardShell
          eyebrow="Tracking"
          title="New measurement"
          description="Record today's baseline"
          actions={<a href="/body">Back</a>}
        >
          <p>Form content</p>
        </FormCardShell>,
      ),
    );

    expect(markup).toContain("Tracking");
    expect(markup).toContain("New measurement");
    expect(markup).toContain("Record today");
    expect(markup).toContain("Back");
    expect(markup).toContain("Form content");
  });

  it("renders query states with caller-provided actions and loading children", () => {
    const emptyMarkup = renderToStaticMarkup(
      <EmptyState title="No rows" description="Create one first">
        <button type="button">Create</button>
      </EmptyState>,
    );
    const errorMarkup = renderToStaticMarkup(<ErrorState title="Failed" message="Try again" />);
    const skeletonMarkup = renderToStaticMarkup(
      <SkeletonState>
        <span>Loading row</span>
      </SkeletonState>,
    );

    expect(emptyMarkup).toContain("No rows");
    expect(emptyMarkup).toContain("Create one first");
    expect(emptyMarkup).toContain("Create");
    expect(errorMarkup).toContain("Failed");
    expect(errorMarkup).toContain("Try again");
    expect(skeletonMarkup).toContain('aria-busy="true"');
    expect(skeletonMarkup).toContain("Loading row");
  });

  it("renders form sections and canonical actions without owning form state", () => {
    const markup = renderToStaticMarkup(
      <form>
        <FormSection title="Details" description="Shared section chrome">
          <input name="name" />
        </FormSection>
        <FormActions
          submitLabel="Save"
          isSubmitting={false}
          onCancel={() => undefined}
          extraActions={<button type="button">Delete</button>}
        />
      </form>,
    );

    expect(markup).toContain("Details");
    expect(markup).toContain("Shared section chrome");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("Save");
    expect(markup).toContain("Delete");
  });

  it("can construct a confirm action dialog for destructive confirmations", () => {
    expect(() =>
      renderToStaticMarkup(
        <ConfirmActionDialog
          open={true}
          onOpenChange={() => undefined}
          title="Delete measurement?"
          description="This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => undefined}
          isPending={false}
          destructive={true}
        />,
      ),
    ).not.toThrow();
  });
});
