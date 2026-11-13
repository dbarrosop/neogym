import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Plus, Search, X } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { MacroSummary } from "@/components/macro-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  groupPlanEntriesByTimeSlot,
  mergePlanEntriesByTime,
  planEntriesMacroTotals,
} from "@/lib/nutrition";

const PlansIndexQuery = graphql(`
  query PlansIndex {
    nutritionPlans(order_by: [{ updatedAt: desc }, { name: asc }]) {
      id
      name
      description
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
      nutritionPlanFoods(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
        id
        slotTime
        label
        position
        grams
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

const plansSearchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/_authed/nutrition/plans/")({
  validateSearch: plansSearchSchema,
  component: PlansIndexRoute,
});

type Plan = {
  id: string;
  name: string;
  description?: string | null;
  nutritionPlanMeals: Array<{
    id: string;
    slotTime: string;
    label?: string | null;
    position: number;
    meal: {
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
  }>;
  nutritionPlanFoods: Array<{
    id: string;
    slotTime: string;
    label?: string | null;
    position: number;
    grams: unknown;
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

function PlansIndexRoute() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const search = searchParams.q ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "plans", "index"],
    queryFn: () => gqlRequest(PlansIndexQuery),
  });

  const plans = useMemo<Plan[]>(() => data?.nutritionPlans ?? [], [data]);
  const fuse = useMemo(
    () =>
      new Fuse(plans, {
        keys: [
          "name",
          "description",
          "nutritionPlanMeals.label",
          "nutritionPlanMeals.meal.name",
          "nutritionPlanMeals.meal.description",
        ],
        ignoreLocation: true,
        threshold: 0.35,
        includeScore: true,
      }),
    [plans],
  );

  const filteredPlans = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      return plans;
    }
    return fuse.search(trimmed).map((match) => match.item);
  }, [fuse, plans, search]);

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
      return <PlansSkeleton />;
    }
    if (error) {
      return <ErrorCard message={error.message} />;
    }
    if (filteredPlans.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>
              {search.trim()
                ? "No plans match this search."
                : "You do not have any daily nutrition plans yet."}
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
                <Link to="/nutrition/plans/new">
                  <Plus className="h-4 w-4" />
                  Create your first plan
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }
    return (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredPlans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </ul>
    );
  }

  const allTotals = planEntriesMacroTotals(
    filteredPlans.flatMap((plan) =>
      mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods),
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="max-w-prose text-sm text-muted-foreground">
            Reusable one-day templates made of timed meals and direct foods. Pick one on a day’s log
            to plan against it; plans never change what you already logged.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search plans or meals…"
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

      {search.trim() && filteredPlans.length > 0 ? (
        <MacroSummary
          totals={allTotals}
          title="Filtered plan totals"
          description={
            filteredPlans.length === 1
              ? "Totals for the single matching one-day plan."
              : `Combined totals across all ${filteredPlans.length} matching one-day plans.`
          }
          compact
        />
      ) : null}

      {renderContent()}
    </div>
  );
}

const wholeNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function PlanCard({ plan }: { plan: Plan }) {
  const entries = mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods);
  const totals = planEntriesMacroTotals(entries);
  const slotCount = groupPlanEntriesByTimeSlot(entries).length;

  return (
    <li>
      <Link
        to="/nutrition/plans/$planId"
        params={{ planId: plan.id }}
        className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-[18px] transition-colors hover:bg-muted/40"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[17px] font-semibold">{plan.name}</span>
          <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
            {countLabel(slotCount, "slot", "slots")} ·{" "}
            {countLabel(entries.length, "entry", "entries")}
          </span>
        </span>
        {plan.description ? (
          <span className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {plan.description}
          </span>
        ) : null}
        <span className="mt-auto flex flex-wrap items-baseline justify-between gap-2 tabular-nums">
          <span className="text-[22px] font-semibold">
            {wholeNumber.format(totals.kcal)}{" "}
            <span className="text-[13px] font-medium text-muted-foreground">kcal</span>
          </span>
          <span className="text-[13px]">
            P <strong>{wholeNumber.format(totals.protein)}</strong> · C{" "}
            <strong>{wholeNumber.format(totals.carbs)}</strong> · F{" "}
            <strong>{wholeNumber.format(totals.fat)}</strong>
          </span>
        </span>
      </Link>
    </li>
  );
}

function PlansSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="space-y-3 rounded-xl border border-border bg-card p-[18px]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
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
