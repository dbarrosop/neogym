import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ChefHat, Pencil } from "lucide-react";
import { MacroSummary } from "@/components/macro-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  formatMacro,
  formatTimeOfDay,
  macroTotalsSummary,
  mealMacroTotals,
  planMacroTotals,
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
    const totals = planMacroTotals(plan.nutritionPlanMeals);

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
              <h2 className="text-sm font-medium">Timed meal slots</h2>
              <p className="text-xs text-muted-foreground">
                Slots sort by time of day, then position. Remove slots before deleting a meal that a
                plan uses.
              </p>
            </div>
            {plan.nutritionPlanMeals.length === 0 ? (
              <p className="rounded-md border border-border/60 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                This plan does not have meal slots yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border/60">
                <ul className="divide-y divide-border/50">
                  {plan.nutritionPlanMeals.map((slot) => {
                    const slotTotals = mealMacroTotals(slot.meal.mealIngredients);
                    return (
                      <li key={slot.id} className="px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
                              {formatTimeOfDay(slot.slotTime)}
                            </p>
                            <p className="truncate text-sm font-medium">
                              {slot.label || slot.meal.name}
                            </p>
                            {slot.label ? (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ChefHat className="h-3 w-3" />
                                {slot.meal.name}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right text-xs text-muted-foreground tabular-nums">
                            <p>{formatMacro(slotTotals.kcal, "kcal")}</p>
                            <p className="max-w-56">{macroTotalsSummary(slotTotals)}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    );
  }

  return <div className="space-y-4">{renderContent()}</div>;
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
