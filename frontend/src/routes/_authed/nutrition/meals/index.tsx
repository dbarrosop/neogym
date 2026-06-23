import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { ChefHat, ChevronRight, Plus, Search, X } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { MacroSummary } from "@/components/macro-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { macroTotalsSummary, mealMacroTotals } from "@/lib/nutrition";

const MealsIndexQuery = graphql(`
  query MealsIndex {
    meals(order_by: [{ updatedAt: desc }, { name: asc }]) {
      id
      name
      description
      updatedAt
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
`);

const mealsSearchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/_authed/nutrition/meals/")({
  validateSearch: mealsSearchSchema,
  component: MealsIndexRoute,
});

type Meal = {
  id: string;
  name: string;
  description?: string | null;
  mealIngredients: Array<{
    id: string;
    grams: unknown;
    position: number;
    food: {
      id: string;
      name: string;
      kcalPer100g: unknown;
      fatPer100g: unknown;
      carbsPer100g: unknown;
      proteinPer100g: unknown;
      fiberPer100g: unknown;
      sugarPer100g: unknown;
    };
  }>;
};

function MealsIndexRoute() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const search = searchParams.q ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "meals", "index"],
    queryFn: () => gqlRequest(MealsIndexQuery),
  });

  const meals = useMemo<Meal[]>(() => data?.meals ?? [], [data]);
  const fuse = useMemo(
    () =>
      new Fuse(meals, {
        keys: ["name", "description", "mealIngredients.food.name"],
        ignoreLocation: true,
        threshold: 0.35,
        includeScore: true,
      }),
    [meals],
  );

  const filteredMeals = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      return meals;
    }
    return fuse.search(trimmed).map((match) => match.item);
  }, [fuse, meals, search]);

  function setSearchText(value: string) {
    navigate({
      search: (prev) => ({ ...prev, q: value === "" ? undefined : value }),
      replace: true,
    });
  }

  function clearSearch() {
    navigate({ search: {}, replace: true });
  }

  function renderContent() {
    if (isLoading) {
      return <MealsSkeleton />;
    }
    if (error) {
      return <ErrorCard message={error.message} />;
    }
    if (filteredMeals.length === 0) {
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>
              {search.trim()
                ? "No meals match this search."
                : "You do not have any meal templates yet."}
            </p>
            {search.trim() ? (
              <button
                type="button"
                onClick={clearSearch}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear search
              </button>
            ) : (
              <Button asChild size="sm">
                <Link to="/nutrition/meals/new">
                  <Plus className="h-4 w-4" />
                  Create your first meal
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardContent className="px-2 py-2">
          <ul className="divide-y divide-border/50">
            {filteredMeals.map((meal) => (
              <MealRow key={meal.id} meal={meal} />
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  const allTotals = mealMacroTotals(
    filteredMeals.flatMap((meal) =>
      meal.mealIngredients.map((ingredient) => ({
        grams: ingredient.grams,
        food: ingredient.food,
      })),
    ),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Meals</h2>
          <p className="text-sm text-muted-foreground">
            Compose reusable private meal templates from your foods and public foods.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/nutrition/meals/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New meal</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search meals or ingredients…"
          className="pr-9 pl-9"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearchText("")}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {search.trim() && filteredMeals.length > 0 ? (
        <MacroSummary totals={allTotals} title="Filtered meal totals" compact />
      ) : null}

      {renderContent()}
    </div>
  );
}

function MealRow({ meal }: { meal: Meal }) {
  const totals = mealMacroTotals(
    meal.mealIngredients.map((ingredient) => ({ grams: ingredient.grams, food: ingredient.food })),
  );
  return (
    <li>
      <Link
        to="/nutrition/meals/$mealId"
        params={{ mealId: meal.id }}
        className="group flex min-h-16 items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/50"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ChefHat className="h-4 w-4" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="truncate text-sm font-medium">{meal.name}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {meal.mealIngredients.length} ingredient{meal.mealIngredients.length === 1 ? "" : "s"}{" "}
              · {macroTotalsSummary(totals)}
            </span>
            {meal.description ? (
              <span className="line-clamp-1 text-xs text-muted-foreground/80">
                {meal.description}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
      </Link>
    </li>
  );
}

function MealsSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-4">
        <p className="text-sm text-destructive">Failed to load: {message}</p>
      </CardContent>
    </Card>
  );
}
