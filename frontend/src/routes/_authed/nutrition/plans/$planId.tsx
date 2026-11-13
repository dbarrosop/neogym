import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Fragment } from "react";
import { Markdown } from "@/components/markdown";
import { PageShell } from "@/components/patterns/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  formatMacro,
  groupPlanEntriesByTimeSlot,
  type MacroTotals,
  mergePlanEntriesByTime,
  type PlanEntry,
  type PlanTimeSlot,
  planEntriesMacroTotals,
  planEntryMacroTotals,
} from "@/lib/nutrition";
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "plans", "detail", planId],
    queryFn: () => gqlRequest(NutritionPlanDetailQuery, { id: planId }),
  });

  function renderContent() {
    if (isLoading) {
      return <NutritionPlanDetailSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!data?.nutritionPlan) {
      return <p className="text-sm text-muted-foreground">Plan not found.</p>;
    }

    const plan = data.nutritionPlan;
    const entries = mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods);
    const slotGroups = groupPlanEntriesByTimeSlot(entries);
    const totals = planEntriesMacroTotals(entries);

    return (
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight md:text-[28px]">
            {plan.name}
          </h1>
          <Button asChild variant="outline">
            <Link to="/nutrition/plans/$planId/edit" params={{ planId: plan.id }}>
              <Pencil />
              Edit plan
            </Link>
          </Button>
        </header>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-label="Timed plan entries" className="min-w-0 space-y-3">
            <h2 className="text-[15px] font-semibold">Timed plan entries</h2>
            {entries.length === 0 ? (
              <p className="rounded-xl border border-border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                This plan does not have meal or food entries yet.
              </p>
            ) : (
              slotGroups.map((slot) => <PlanSlotCard key={slot.key} slot={slot} />)
            )}
            <p className="text-[13px] text-muted-foreground">
              Remove a meal or food from its plans before deleting it from the library.
            </p>
          </section>
          <aside className="space-y-4">
            <PlanTotalsCard totals={totals} />
            {plan.description ? (
              <section
                aria-label="Description"
                className="space-y-2 rounded-xl border border-border bg-card p-5"
              >
                <h2 className="text-[13px] font-normal text-muted-foreground">Description</h2>
                <Markdown>{plan.description}</Markdown>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    );
  }

  return <PageShell maxWidth="6xl">{renderContent()}</PageShell>;
}

const wholeNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function PlanSlotCard({ slot }: { slot: PlanTimeSlot }) {
  return (
    <section
      aria-label={slot.label}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <h3 className="text-[15px] font-semibold tabular-nums">{slot.label}</h3>
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {wholeNumber.format(slot.totals.kcal)} kcal · P {wholeNumber.format(slot.totals.protein)}
        </span>
      </header>
      <ul>
        {slot.entries.map((entry) => (
          <PlanEntryRow key={`${entry.kind}:${entry.id}`} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function entryDetail(entry: PlanEntry): string | null {
  if (entry.kind === "food") {
    return formatMacro(entry.grams, "g");
  }
  // A labelled meal names the template underneath.
  return entry.label ? (entry.meal?.name ?? null) : null;
}

function PlanEntryRow({ entry }: { entry: PlanEntry }) {
  const entryTotals = planEntryMacroTotals(entry);
  const title =
    entry.kind === "food"
      ? (entry.food?.name ?? "Food")
      : entry.label || entry.meal?.name || "Untitled entry";
  const detail = entryDetail(entry);

  return (
    <li className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-border border-t px-4 py-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[11px] font-bold",
          entry.kind === "meal"
            ? "bg-accent-soft text-accent-soft-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {entry.kind === "meal" ? "MEAL" : "FOOD"}
      </span>
      <span className="min-w-0">
        <span className="block truncate">{title}</span>
        {detail ? (
          <span className="block truncate text-xs text-muted-foreground tabular-nums">
            {detail}
          </span>
        ) : null}
      </span>
      <span className="hidden text-right text-muted-foreground tabular-nums sm:block">
        P {wholeNumber.format(entryTotals.protein)}
      </span>
      <span className="text-right font-semibold tabular-nums">
        {wholeNumber.format(entryTotals.kcal)} kcal
      </span>
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
      className="space-y-3 rounded-xl border border-border bg-card p-5"
    >
      <p className="text-[13px] text-muted-foreground">Daily planned totals</p>
      <p className="text-3xl font-semibold tabular-nums">
        {wholeNumber.format(totals.kcal)}{" "}
        <span className="text-sm font-medium text-muted-foreground">kcal</span>
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm tabular-nums">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{formatMacro(value, "g")}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Live values: editing a food or meal updates these totals. A plan is a reusable template, not
        a calendar assignment.
      </p>
    </section>
  );
}

function NutritionPlanDetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </div>
  );
}
