import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, Pencil } from "lucide-react";
import { MacroSummary } from "@/components/macro-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { formatMacro, macrosForGrams, mealMacroTotals } from "@/lib/nutrition";

const MealDetailQuery = graphql(`
  query MealDetail($id: uuid!) {
    meal(id: $id) {
      id
      name
      description
      createdAt
      updatedAt
      mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
        id
        grams
        position
        food {
          id
          name
          isPublic
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

export const Route = createFileRoute("/_authed/nutrition/meals/$mealId")({
  component: MealDetailRoute,
});

function MealDetailRoute() {
  const { mealId } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "meals", "detail", mealId],
    queryFn: () => gqlRequest(MealDetailQuery, { id: mealId }),
  });

  function renderContent() {
    if (isLoading) {
      return <MealDetailSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!data?.meal) {
      return <p className="text-sm text-muted-foreground">Meal not found.</p>;
    }

    const meal = data.meal;
    const totals = mealMacroTotals(
      meal.mealIngredients.map((ingredient) => ({
        grams: ingredient.grams,
        food: ingredient.food,
      })),
    );

    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <ChefHat className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-2">
                <CardTitle className="truncate text-2xl tracking-tight">{meal.name}</CardTitle>
                {meal.description ? (
                  <p className="text-sm text-muted-foreground">{meal.description}</p>
                ) : null}
              </div>
            </div>
            <Button asChild size="icon" variant="ghost" aria-label="Edit meal">
              <Link to="/nutrition/meals/$mealId/edit" params={{ mealId: meal.id }}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <MacroSummary
            totals={totals}
            title="Meal totals"
            description="Totals use live food nutrition values, so food edits update this template's display."
          />

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Ingredients</h2>
              <p className="text-xs text-muted-foreground">
                Deleting this reusable meal does not delete historical day logs; logged meal
                provenance is detached by the database.
              </p>
            </div>
            {meal.mealIngredients.length === 0 ? (
              <p className="rounded-md border border-border/60 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                This meal does not have ingredients yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border/60">
                <ul className="divide-y divide-border/50">
                  {meal.mealIngredients.map((ingredient) => {
                    const ingredientTotals = macrosForGrams(ingredient.food, ingredient.grams);
                    return (
                      <li key={ingredient.id} className="px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{ingredient.food.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatMacro(ingredient.grams, "g")}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground tabular-nums">
                            <p>{formatMacro(ingredientTotals.kcal, "kcal")}</p>
                            <p>
                              {formatMacro(ingredientTotals.protein, "g")} protein ·{" "}
                              {formatMacro(ingredientTotals.carbs, "g")} carbs ·{" "}
                              {formatMacro(ingredientTotals.fat, "g")} fat
                            </p>
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

function MealDetailSkeleton() {
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
