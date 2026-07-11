import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, CalendarClock, ChefHat, Pencil } from "lucide-react";
import { MacroSummary } from "@/components/macro-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  formatMacro,
  formatTimeOfDay,
  groupPlanEntriesByTimeSlot,
  macroTotalsSummary,
  mergePlanEntriesByTime,
  type PlanEntry,
  planEntriesMacroTotals,
  planEntryMacroTotals,
} from "@/lib/nutrition";

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
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-2">
                <CardTitle className="truncate text-2xl tracking-tight">{plan.name}</CardTitle>
                {plan.description ? (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                ) : null}
              </div>
            </div>
            <Button asChild size="icon" variant="ghost" aria-label="Edit plan">
              <Link to="/nutrition/plans/$planId/edit" params={{ planId: plan.id }}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <MacroSummary
            totals={totals}
            title="Daily planned totals"
            description="Totals use live meal and food nutrition values. Plans are reusable templates only, not scheduled calendar assignments."
          />

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Timed plan entries</h2>
              <p className="text-xs text-muted-foreground">
                Entries sort by time of day, then shared position across meal and direct food slots.
                Remove entries before deleting meals or foods that a plan uses.
              </p>
            </div>
            {entries.length === 0 ? (
              <p className="rounded-md border border-border/60 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                This plan does not have meal or food entries yet.
              </p>
            ) : (
              <div className="space-y-4">
                {slotGroups.map((slot) => (
                  <Card key={slot.key} className="border-border/60 bg-muted/10 shadow-none">
                    <CardContent className="space-y-3 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-border/60 border-b pb-3">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold tabular-nums">{slot.label}</h3>
                          <p className="text-xs text-muted-foreground">
                            {slot.mealCount} meal{slot.mealCount === 1 ? "" : "s"} ·{" "}
                            {slot.foodCount} food{slot.foodCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <p className="max-w-md text-right text-xs text-muted-foreground tabular-nums">
                          {macroTotalsSummary(slot.totals)}
                        </p>
                      </div>
                      <ul className="divide-y divide-border/50 overflow-hidden rounded-md border border-border/60 bg-background/60">
                        {slot.entries.map((entry) => (
                          <PlanEntryRow key={`${entry.kind}:${entry.id}`} entry={entry} />
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    );
  }

  return <div className="space-y-4">{renderContent()}</div>;
}

function PlanEntryRow({ entry }: { entry: PlanEntry }) {
  const entryTotals = planEntryMacroTotals(entry);
  const sourceName = entry.kind === "meal" ? entry.meal?.name : entry.food?.name;
  const subtitle = renderPlanEntrySubtitle(entry);

  return (
    <li className="px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
            {formatTimeOfDay(entry.slotTime)}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant={entry.kind === "meal" ? "primary" : "success"}>
              {entry.kind === "meal" ? (
                <ChefHat className="h-3 w-3" />
              ) : (
                <Apple className="h-3 w-3" />
              )}
              {entry.kind === "meal" ? "Meal" : "Food"}
            </Badge>
            <p className="truncate text-sm font-medium">
              {entry.label || sourceName || "Untitled entry"}
            </p>
          </div>
          {subtitle}
        </div>
        <div className="text-right text-xs text-muted-foreground tabular-nums">
          <p>{formatMacro(entryTotals.kcal, "kcal")}</p>
          <p className="max-w-56">{macroTotalsSummary(entryTotals)}</p>
        </div>
      </div>
    </li>
  );
}

function renderPlanEntrySubtitle(entry: PlanEntry) {
  if (entry.kind === "food") {
    return (
      <p className="text-xs text-muted-foreground">
        {formatMacro(entry.grams, "g")} · {entry.food?.name ?? "Food"}
      </p>
    );
  }

  if (!entry.label) {
    return null;
  }

  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <ChefHat className="h-3 w-3" />
      {entry.meal?.name}
    </p>
  );
}

function NutritionPlanDetailSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}
