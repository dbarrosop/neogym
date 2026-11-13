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
import { useIsSplit } from "@/lib/hooks/use-is-split";
import { formatMacro, macroTotalsSummary, mealMacroTotals } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

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
  /** Meal shown in the side panel from 1100 px; defaults to the first row. */
  selected: z.string().optional(),
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
  const split = useIsSplit();
  const selected = split
    ? (filteredMeals.find((meal) => meal.id === searchParams.selected) ?? filteredMeals[0])
    : undefined;

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
        <Card className="border-dashed">
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
                className="text-xs font-medium text-link hover:underline"
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
      <>
        <div className="flex items-start gap-5">
          <MealsTable meals={filteredMeals} selectedId={selected?.id} />
          {selected ? <MealPanel meal={selected} /> : null}
        </div>
        <Card className="py-0 md:hidden">
          <CardContent className="p-2">
            <ul className="divide-y divide-border">
              {filteredMeals.map((meal) => (
                <MealRow key={meal.id} meal={meal} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </>
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="max-w-prose text-sm text-muted-foreground">
            Reusable private meal templates from your foods and public foods. Totals are per whole
            meal, from live food values.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search meals or ingredients…"
          className="h-11 rounded-xl bg-card pr-10 pl-10"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearchText("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {search.trim() && filteredMeals.length > 0 ? (
        <MacroSummary
          totals={allTotals}
          title="Filtered meal totals"
          description={
            filteredMeals.length === 1
              ? "Totals for the single matching meal."
              : `Combined totals across all ${filteredMeals.length} matching meals.`
          }
          compact
        />
      ) : null}

      {renderContent()}
    </div>
  );
}

const wholeNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function mealTotals(meal: Meal) {
  return mealMacroTotals(
    meal.mealIngredients.map((ingredient) => ({ grams: ingredient.grams, food: ingredient.food })),
  );
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Meals with whole-meal totals from 768 px; ingredient counts appear only when
 * the table itself has room. From 1100 px (`selectedId` set) a row selects the
 * meal for the side panel.
 */
function MealsTable({ meals, selectedId }: { meals: Meal[]; selectedId?: string | undefined }) {
  return (
    <div className="@container hidden min-w-0 flex-1 overflow-hidden rounded-xl border bg-card md:block">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-right text-[12px] text-muted-foreground">
            <th scope="col" className="py-2.5 pl-4 text-left font-medium">
              Meal
            </th>
            <th scope="col" className="hidden font-medium @xl:table-cell">
              Ingredients
            </th>
            <th scope="col" className="font-medium">
              kcal
            </th>
            <th scope="col" className="font-medium">
              Protein
            </th>
            <th scope="col" className="font-medium">
              Carbs
            </th>
            <th scope="col" className="pr-4 font-medium">
              Fat
            </th>
          </tr>
        </thead>
        <tbody>
          {meals.map((meal) => {
            const totals = mealTotals(meal);
            const isSelected = meal.id === selectedId;
            return (
              <tr
                key={meal.id}
                className={cn(
                  "border-t text-right hover:bg-surface-inset",
                  isSelected && "bg-accent-soft/60 hover:bg-accent-soft/60",
                )}
              >
                <td className="min-w-40 max-w-0 py-2.5 pr-4 pl-4 text-left">
                  {selectedId === undefined ? (
                    <Link
                      to="/nutrition/meals/$mealId"
                      params={{ mealId: meal.id }}
                      className="block wrap-break-word font-medium hover:text-link"
                    >
                      {meal.name}
                    </Link>
                  ) : (
                    <Link
                      to="/nutrition/meals"
                      search={(prev) => ({ ...prev, selected: meal.id })}
                      replace={true}
                      aria-current={isSelected ? "true" : undefined}
                      className="block wrap-break-word font-medium hover:text-link"
                    >
                      {meal.name}
                    </Link>
                  )}
                  {meal.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {meal.description}
                    </span>
                  ) : null}
                </td>
                <td className="hidden w-24 @xl:table-cell">{meal.mealIngredients.length}</td>
                <td className="w-16 font-semibold">{wholeNumber.format(totals.kcal)}</td>
                <td className="w-16">{wholeNumber.format(totals.protein)}</td>
                <td className="w-16">{wholeNumber.format(totals.carbs)}</td>
                <td className="w-16 pr-4">{wholeNumber.format(totals.fat)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t px-4 py-2 text-[12px] text-muted-foreground">Totals per whole meal.</p>
    </div>
  );
}

/** The selected meal beside the table from 1100 px. */
function MealPanel({ meal }: { meal: Meal }) {
  const totals = mealTotals(meal);
  return (
    <aside
      aria-label="Selected meal"
      className="sticky top-6 hidden w-[320px] shrink-0 space-y-4 rounded-xl border border-border bg-card p-5 md:block"
    >
      <div className="space-y-1">
        <p className="text-[13px] text-muted-foreground">
          Meal · {countLabel(meal.mealIngredients.length, "ingredient", "ingredients")}
        </p>
        <h2 className="text-[17px] font-semibold leading-snug">{meal.name}</h2>
        {meal.description ? (
          <p className="line-clamp-3 text-[13px] text-muted-foreground">{meal.description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 tabular-nums">
        <p className="text-[26px] font-semibold">
          {wholeNumber.format(totals.kcal)}{" "}
          <span className="text-sm font-medium text-muted-foreground">kcal</span>
        </p>
        <p className="text-[13px]">
          P <strong>{wholeNumber.format(totals.protein)}</strong> · C{" "}
          <strong>{wholeNumber.format(totals.carbs)}</strong> · F{" "}
          <strong>{wholeNumber.format(totals.fat)}</strong>
        </p>
      </div>
      <ul className="divide-y divide-border border-border border-y text-sm">
        {meal.mealIngredients.map((ingredient) => (
          <li key={ingredient.id} className="flex justify-between gap-3 py-2">
            <span className="min-w-0 truncate">{ingredient.food.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {formatMacro(ingredient.grams, "g")} ·{" "}
              {wholeNumber.format(
                mealMacroTotals([{ grams: ingredient.grams, food: ingredient.food }]).kcal,
              )}{" "}
              kcal
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button asChild variant="outline" className="min-h-11 flex-1">
          <Link to="/nutrition/meals/$mealId" params={{ mealId: meal.id }}>
            Details
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 flex-1">
          <Link to="/nutrition/meals/$mealId/edit" params={{ mealId: meal.id }}>
            Edit
          </Link>
        </Button>
      </div>
    </aside>
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
        className="group flex min-h-16 items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-soft-foreground">
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
    <Card className="py-0">
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
