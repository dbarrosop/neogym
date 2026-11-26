import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { ChefHat, ChevronRight, Plus, SearchX } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import {
  ingredientCountLabel,
  LibrarySearchField,
  LibrarySkeleton,
  MealSummary,
  summaryMealTotals,
} from "@/components/nutrition-library";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useIsSplit } from "@/lib/hooks/use-is-split";
import { formatKcalNumber, formatNumber } from "@/lib/metric-format";
import { useAuth } from "@/lib/nhost/auth-provider";
import { macroLineLabel } from "@/lib/nutrition";
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

  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nutrition", "meals", "index", user?.id],
    enabled: Boolean(user),
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

  const trimmedSearch = search.trim();
  const filteredMeals = useMemo(
    () => (trimmedSearch ? fuse.search(trimmedSearch).map((match) => match.item) : meals),
    [fuse, meals, trimmedSearch],
  );
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
      return <LibrarySkeleton rows={5} />;
    }
    if (!data) {
      return null;
    }
    if (filteredMeals.length === 0) {
      return trimmedSearch ? (
        <EmptyState
          icon={SearchX}
          title="No meals match"
          description={`No meal name, description or ingredient matches “${trimmedSearch}”.`}
          actions={
            <Button type="button" variant="outline" onClick={clearSearch}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={ChefHat}
          title="No meals yet"
          description="Build a reusable meal from your foods and public foods."
          actions={
            <Button asChild>
              <Link to="/nutrition/meals/new">
                <Plus />
                New meal
              </Link>
            </Button>
          }
        />
      );
    }
    return (
      <>
        <div className="hidden items-start gap-5 md:flex">
          <MealsTable meals={filteredMeals} selectedId={selected?.id} />
          {selected ? (
            <aside
              aria-label="Selected meal"
              className="sticky top-6 hidden w-[320px] shrink-0 flex-col gap-3.5 rounded-xl border bg-card p-5 md:flex"
            >
              <MealSummary meal={selected} variant="panel" />
            </aside>
          ) : null}
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card md:hidden">
          {filteredMeals.map((meal) => (
            <MealRow key={meal.id} meal={meal} />
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[760px] text-sm leading-normal text-muted-foreground">
        Reusable private meal templates from your foods and public foods. Totals are per whole meal,
        from live food values.
      </p>

      <LibrarySearchField
        label="Search meals or ingredients"
        placeholder="Search meals or ingredients…"
        value={search}
        onChange={setSearchText}
      />

      {error ? (
        <ErrorState
          title="Couldn’t load meals"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      ) : null}
      {renderContent()}
    </div>
  );
}

const TH = "px-3 py-2.5 font-semibold whitespace-nowrap";

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
          <tr className="border-b text-right text-xs text-muted-foreground">
            <th scope="col" className={cn(TH, "pl-4 text-left")}>
              Meal
            </th>
            <th scope="col" className={cn(TH, "hidden @xl:table-cell")}>
              Ingredients
            </th>
            <th scope="col" className={TH}>
              kcal
            </th>
            <th scope="col" className={TH}>
              Protein
            </th>
            <th scope="col" className={TH}>
              Carbs
            </th>
            <th scope="col" className={cn(TH, "pr-4")}>
              Fat
            </th>
          </tr>
        </thead>
        <tbody>
          {meals.map((meal) => {
            const totals = summaryMealTotals(meal);
            const isSelected = meal.id === selectedId;
            return (
              <tr
                key={meal.id}
                className={cn(
                  "border-b text-right hover:bg-surface-inset",
                  isSelected && "bg-accent-soft/60 hover:bg-accent-soft/60",
                )}
              >
                <td className="h-[46px] min-w-40 max-w-0 py-2 pr-3 pl-4 text-left">
                  <MealNameLink meal={meal} selectedId={selectedId} />
                  {meal.description ? (
                    <span className="block wrap-break-word text-[13px] text-muted-foreground">
                      {meal.description}
                    </span>
                  ) : null}
                </td>
                <td className="hidden w-24 px-3 @xl:table-cell">{meal.mealIngredients.length}</td>
                <td className="w-16 px-3 font-semibold">{formatKcalNumber(totals.kcal)}</td>
                <td className="w-16 px-3">{formatNumber(totals.protein)}</td>
                <td className="w-16 px-3">{formatNumber(totals.carbs)}</td>
                <td className="w-16 pr-4 pl-3">{formatNumber(totals.fat)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[13px] text-muted-foreground">Totals per whole meal.</p>
    </div>
  );
}

function MealNameLink({ meal, selectedId }: { meal: Meal; selectedId: string | undefined }) {
  const className = "block wrap-break-word font-medium hover:text-link";
  if (selectedId === undefined) {
    return (
      <Link to="/nutrition/meals/$mealId" params={{ mealId: meal.id }} className={className}>
        {meal.name}
      </Link>
    );
  }
  return (
    <Link
      to="/nutrition/meals"
      search={(prev) => ({ ...prev, selected: meal.id })}
      replace={true}
      aria-current={meal.id === selectedId ? "true" : undefined}
      className={className}
    >
      {meal.name}
    </Link>
  );
}

/** Below 768 px: one title, one count + P · C · F line, whole-meal kcal trailing. */
function MealRow({ meal }: { meal: Meal }) {
  const totals = summaryMealTotals(meal);
  const count = ingredientCountLabel(meal.mealIngredients.length);
  return (
    <li>
      <Link
        to="/nutrition/meals/$mealId"
        params={{ mealId: meal.id }}
        className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="wrap-break-word text-[15px] font-semibold">{meal.name}</span>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            <span className="sr-only">{`${count}, ${macroLineLabel(totals)}`}</span>
            <span aria-hidden="true">
              {`${count} · P ${formatNumber(totals.protein)} · C ${formatNumber(totals.carbs)} · F ${formatNumber(totals.fat)} g`}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end tabular-nums">
          <span className="text-[15px] font-semibold">{formatKcalNumber(totals.kcal)}</span>
          <span className="text-xs text-muted-foreground">kcal</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
