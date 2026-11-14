import { describe, expect, it } from "bun:test";
import { Inbox } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { ActiveFilterChip, FilterChip } from "@/components/patterns/filter-chip";
import { FormActions, FormSection } from "@/components/patterns/form-actions";
import { ListFooter, listFooterCaption } from "@/components/patterns/list-footer";
import { MeterBar, type MeterTone } from "@/components/patterns/metrics";
import { ActionLabel, PageHeader, PageShell } from "@/components/patterns/page-shell";
import {
  EmptyState,
  ErrorState,
  errorStateMessage,
  NETWORK_ERROR_MESSAGE,
  SkeletonState,
} from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import { KindTag, Tag } from "@/components/patterns/tag";

const ATTRIBUTE_NAME = /name="([^"]+)"/g;
const RADIO = /type="radio"/g;
const CHECKED_LIGHT = /checked="" value="light"/;
const LABELLED_BY = /aria-labelledby="([^"]+)"/;

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

    expect(markup).toContain("md:px-10");
    expect(markup).toContain("max-w-2xl");
    expect(markup).toContain("Tracking");
    expect(markup).toContain("Body");
    expect(markup).toContain("Domain content");
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
    expect(skeletonMarkup).toContain('aria-label="Loading"');
    expect(skeletonMarkup).toContain("Loading row");
  });

  it("renders the empty state's icon tile and action row", () => {
    const markup = renderToStaticMarkup(
      <EmptyState
        icon={Inbox}
        title="No sessions yet"
        description="Start one from a workout."
        actions={
          <>
            <a href="/train/workouts">Browse workouts</a>
            <a href="/train/exercises">Exercises</a>
          </>
        }
      />,
    );
    expect(markup).toContain("border-dashed");
    expect(markup).toContain("bg-accent-soft");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("Browse workouts");
    expect(markup).toContain("Exercises");
  });

  it("announces errors, offers Retry and hides raw fetch failures", () => {
    const markup = renderToStaticMarkup(
      <ErrorState title="Couldn't load today" message="Failed to fetch" onRetry={() => {}} />,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(NETWORK_ERROR_MESSAGE);
    expect(markup).not.toContain("Failed to fetch");
    expect(markup).toContain("Retry");

    expect(renderToStaticMarkup(<ErrorState message="Try again" />)).not.toContain("Retry");
    for (const raw of [
      "TypeError: Failed to fetch",
      "NetworkError when attempting",
      "Load failed",
    ]) {
      expect(errorStateMessage(raw)).toBe(NETWORK_ERROR_MESSAGE);
    }
    expect(errorStateMessage(undefined)).toBe(NETWORK_ERROR_MESSAGE);
    expect(errorStateMessage("permission denied for nutrition_days")).toBe(
      "permission denied for nutrition_days",
    );
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

  it("renders card form sections labelled by their heading", () => {
    const markup = renderToStaticMarkup(
      <FormSection card title="Nutrition per 100 g" description="Copy the label values.">
        <input name="kcal" />
      </FormSection>,
    );
    const labelledBy = markup.match(LABELLED_BY)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(markup).toContain(`<h2 id="${labelledBy}"`);
    expect(markup).toContain("rounded-xl border bg-card p-5");
  });

  it("keeps a header action's label for screen readers below 768 px", () => {
    const markup = renderToStaticMarkup(
      <PageHeader
        title="Nutrition"
        tabs={<nav aria-label="Nutrition sections" />}
        actions={
          <a href="/nutrition/foods/new">
            <svg aria-hidden="true" />
            <ActionLabel>New food</ActionLabel>
          </a>
        }
      />,
    );
    expect(markup).toContain(
      '<span data-slot="action-label" class="max-md:sr-only">New food</span>',
    );
    expect(markup).toContain("max-md:basis-full");
  });

  it("renders tags, kind tags and removable label chips", () => {
    const tag = renderToStaticMarkup(<Tag>public</Tag>);
    expect(tag).toContain("bg-muted text-soft-foreground");
    expect(tag).toContain("h-[22px]");

    const chip = renderToStaticMarkup(
      <Tag onRemove={() => {}} removeLabel="Remove label caliper">
        caliper
      </Tag>,
    );
    expect(chip).toContain('aria-label="Remove label caliper"');
    expect(chip).toContain('type="button"');

    const meal = renderToStaticMarkup(<KindTag kind="meal" />);
    expect(meal).toContain("bg-accent-soft");
    expect(meal).toContain(">Meal<");
    expect(renderToStaticMarkup(<KindTag kind="food" />)).toContain("bg-muted");
  });

  it("counts shown rows and hides Load more once everything is shown", () => {
    expect(listFooterCaption(7, 32, "entries")).toBe("7 of 32 entries");
    expect(listFooterCaption(40, 32, "days")).toBe("32 of 32 days");
    const partial = renderToStaticMarkup(
      <ListFooter shown={7} total={32} noun="entries" onLoadMore={() => {}} />,
    );
    expect(partial).toContain("7 of 32 entries");
    expect(partial).toContain("Load more");
    const complete = renderToStaticMarkup(
      <ListFooter shown={32} total={32} noun="entries" onLoadMore={() => {}} />,
    );
    expect(complete).not.toContain("Load more");
  });

  it("renders filter chips as toggle buttons and applied filters with a clear button", () => {
    const on = renderToStaticMarkup(
      <FilterChip selected={true} count={12}>
        push
      </FilterChip>,
    );
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain("bg-primary");
    expect(on).toContain("12");
    const off = renderToStaticMarkup(<FilterChip selected={false}>pull</FilterChip>);
    expect(off).toContain('aria-pressed="false"');
    expect(off).toContain("text-soft-foreground");
    const applied = renderToStaticMarkup(
      <ActiveFilterChip onRemove={() => {}} removeLabel="Clear Quadriceps filter">
        Quadriceps
      </ActiveFilterChip>,
    );
    expect(applied).toContain('aria-label="Clear Quadriceps filter"');
  });

  it("renders the segmented control as one named radio group", () => {
    const markup = renderToStaticMarkup(
      <Segmented
        label="Appearance"
        options={[
          { value: "dark", label: "Dark" },
          { value: "light", label: "Light" },
        ]}
        value="light"
        onChange={() => {}}
      />,
    );
    expect(markup).toContain('<legend class="sr-only">Appearance</legend>');
    expect(markup.match(RADIO)?.length).toBe(2);
    const names = new Set([...markup.matchAll(ATTRIBUTE_NAME)].map((match) => match[1]));
    expect(names.size).toBe(1);
    expect(markup).toMatch(CHECKED_LIGHT);
  });

  it("maps macro meter tones to the macro colours", () => {
    const fill = (tone: MeterTone) =>
      renderToStaticMarkup(<MeterBar label="m" value={1} max={2} valueLabel="1" tone={tone} />);
    expect(fill("protein")).toContain("bg-primary");
    expect(fill("carbs")).toContain("bg-carbs");
    expect(fill("orange")).toContain("bg-carbs");
    expect(fill("fat")).toContain("bg-muted-foreground");
    expect(fill("neutral")).toContain("bg-muted-foreground");
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
