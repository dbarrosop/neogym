import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Pencil } from "lucide-react";
import { Fragment } from "react";
import { MacroLine } from "@/components/macro-line";
import { Markdown } from "@/components/markdown";
import { KcalCell, MacroCells, PLAN_ROW_GRID } from "@/components/nutrition-row-cells";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { KindTag } from "@/components/patterns/tag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { formatKcalNumber } from "@/lib/metric-format";
import {
  formatWholeGrams,
  groupPlanEntriesByTimeSlot,
  type MacroTotals,
  mergePlanEntriesByTime,
  type PlanEntry,
  type PlanTimeSlot,
  planEntriesMacroTotals,
  planEntryMacroTotals,
} from "@/lib/nutrition";
import { formatRowGrams, formatRowKcal } from "@/lib/nutrition-rows";
import { cn } from "@/lib/utils";

const NutritionPlanDetailQuery = graphql(`
  query NutritionPlanDetail($id: uuid!) {
    nutritionPlan(id: $id) {
      id
      name
      description
      createdAt
      updatedAt
      nutritionPlanMeals(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
        id
        mealId
        slotTime
        label
        position
        meal {
          id
          name
          description
          mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
            id
            grams
            position
            food {
              id
              name
              kcalPer100g
              fatPer100g
              carbsPer100g
              proteinPer100g
              fiberPer100g
              sugarPer100g
            }
          }
        }
      }
      nutritionPlanFoods(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
        id
        foodId
        grams
        slotTime
        label
        position
        food {
          id
          name
          kcalPer100g
          fatPer100g
          carbsPer100g
          proteinPer100g
          fiberPer100g
          sugarPer100g
        }
      }
    }
  }
`);

export const Route = createFileRoute("/_authed/nutrition/plans/$planId")({
  component: NutritionPlanDetailRoute,
});

function NutritionPlanDetailRoute() {
  const { planId } = Route.useParams();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nutrition", "plans", "detail", planId],
    queryFn: () => gqlRequest(NutritionPlanDetailQuery, { id: planId }),
  });

  function renderContent() {
    if (isLoading) {
      return <NutritionPlanDetailSkeleton />;
    }
    if (error) {
      return (
        <ErrorState
          title="Couldn't load this plan"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      );
    }
    if (!data?.nutritionPlan) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="Plan not found"
          description="It may have been deleted."
          actions={
            <Button asChild variant="outline">
              <Link to="/nutrition/plans">Back to plans</Link>
            </Button>
          }
        />
      );
    }

    const plan = data.nutritionPlan;
    const entries = mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods);
    const slotGroups = groupPlanEntriesByTimeSlot(entries);
    const totals = planEntriesMacroTotals(entries);

    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="min-w-0 truncate text-[28px] font-bold tracking-[-0.02em]">{plan.name}</h1>
          <Button asChild variant="outline">
            <Link to="/nutrition/plans/$planId/edit" params={{ planId: plan.id }}>
              <Pencil />
              Edit plan
            </Link>
          </Button>
        </header>
        <div className="@container">
          <div className="grid items-start gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
            <section
              aria-labelledby="plan-entries-heading"
              className="flex min-w-0 flex-col gap-3.5"
            >
              <h2 id="plan-entries-heading" className="text-[15px] font-bold">
                Timed plan entries
              </h2>
              {entries.length === 0 ? (
                <EmptyState
                  title="No entries yet"
                  description="Edit the plan to add timed meals and foods."
                />
              ) : (
                slotGroups.map((slot) => <PlanSlotCard key={slot.key} slot={slot} />)
              )}
              <p className="text-[13px] text-muted-foreground">
                Remove a meal or food from its plans before deleting it from the library.
              </p>
            </section>
            <aside className="flex min-w-0 flex-col gap-4">
              <PlanTotalsCard totals={totals} />
              {plan.description ? (
                <section
                  aria-label="Description"
                  className="flex flex-col gap-2 rounded-[14px] border bg-card p-5"
                >
                  <h2 className="text-[13px] font-normal text-muted-foreground">Description</h2>
                  <Markdown>{plan.description}</Markdown>
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return <PageShell maxWidth="6xl">{renderContent()}</PageShell>;
}

function PlanSlotCard({ slot }: { slot: PlanTimeSlot }) {
  return (
    <section aria-label={slot.label} className="overflow-hidden rounded-[14px] border bg-card">
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-1.5 tabular-nums">
        <h3 className="text-[15px] font-bold">{slot.label}</h3>
        <span className="text-[13px] text-muted-foreground">
          {formatRowKcal(slot.totals.kcal)} kcal
        </span>
      </header>
      <MacroLine totals={slot.totals} className="px-4 pb-3" />
      <ul>
        {slot.entries.map((entry) => (
          <PlanEntryRow key={`${entry.kind}:${entry.id}`} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function PlanEntryRow({ entry }: { entry: PlanEntry }) {
  const entryTotals = planEntryMacroTotals(entry);
  const title =
    entry.kind === "food"
      ? (entry.food?.name ?? "Food")
      : entry.label || entry.meal?.name || "Untitled entry";
  // A labelled meal names the template underneath.
  const templateName = entry.kind === "meal" && entry.label ? (entry.meal?.name ?? null) : null;

  return (
    <li className={cn(PLAN_ROW_GRID, "min-h-[46px] border-t px-4 text-sm tabular-nums")}>
      <KindTag kind={entry.kind} />
      <span className="truncate" title={templateName ? `${title} (${templateName})` : title}>
        {title}
        {templateName ? <span className="text-muted-foreground"> · {templateName}</span> : null}
      </span>
      <span className="text-right text-muted-foreground">
        {entry.kind === "food" ? formatRowGrams(entry.grams) : ""}
      </span>
      <MacroCells totals={entryTotals} />
      <KcalCell kcal={entryTotals.kcal} strong={true} />
    </li>
  );
}

function PlanTotalsCard({ totals }: { totals: MacroTotals }) {
  const rows: [string, number][] = [
    ["Protein", totals.protein],
    ["Carbs", totals.carbs],
    ["Fat", totals.fat],
    ["Fiber", totals.fiber],
    ["Sugar", totals.sugar],
  ];
  return (
    <section
      aria-label="Daily planned totals"
      className="flex flex-col gap-3 rounded-[14px] border bg-card p-5 tabular-nums"
    >
      <p className="text-[13px] text-muted-foreground">Daily planned totals</p>
      <p className="text-[30px] font-bold">
        {formatKcalNumber(totals.kcal)}{" "}
        <span className="text-sm font-medium text-muted-foreground">kcal</span>
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
            <dd className="font-bold">{formatWholeGrams(value)} g</dd>
          </Fragment>
        ))}
      </dl>
      <p className="text-[13px] leading-normal text-muted-foreground">
        Live values: editing a food or meal updates these totals. A plan is a template, not a
        calendar assignment.
      </p>
    </section>
  );
}

function NutritionPlanDetailSkeleton() {
  return (
    <SkeletonState className="flex flex-col gap-5">
      <Skeleton className="h-8 w-48" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-[14px]" />
          <Skeleton className="h-36 w-full rounded-[14px]" />
        </div>
        <Skeleton className="h-56 w-full rounded-[14px]" />
      </div>
    </SkeletonState>
  );
}
