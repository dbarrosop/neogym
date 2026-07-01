import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { CalendarClock, ChevronRight, Plus, Search, X } from "lucide-react";
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
  formatTimeOfDay,
  macroTotalsSummary,
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
        <Card className="border-border/60 border-dashed">
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
                className="text-xs font-medium text-primary hover:underline"
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
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardContent className="px-2 py-2">
          <ul className="divide-y divide-border/50">
            {filteredPlans.map((plan) => (
              <PlanRow key={plan.id} plan={plan} />
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  const allTotals = planEntriesMacroTotals(
    filteredPlans.flatMap((plan) =>
      mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods),
    ),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Create reusable one-day templates made of timed meals and direct foods. Plans are
            suggestions only.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/nutrition/plans/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New plan</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search plans or meals…"
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

function PlanRow({ plan }: { plan: Plan }) {
  const entries = mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods);
  const totals = planEntriesMacroTotals(entries);
  const firstSlot = entries[0];
  const firstSlotSource = firstSlot?.kind === "meal" ? firstSlot.meal?.name : firstSlot?.food?.name;
  const firstSlotSummary = firstSlot
    ? `${formatTimeOfDay(firstSlot.slotTime)} · ${firstSlot.label || firstSlotSource}`
    : "No entries yet";

  return (
    <li>
      <Link
        to="/nutrition/plans/$planId"
        params={{ planId: plan.id }}
        className="group flex min-h-16 items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/50"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarClock className="h-4 w-4" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="truncate text-sm font-medium">{plan.name}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {entries.length} entr{entries.length === 1 ? "y" : "ies"} · {firstSlotSummary} ·{" "}
              {macroTotalsSummary(totals)}
            </span>
            {plan.description ? (
              <span className="line-clamp-1 text-xs text-muted-foreground/80">
                {plan.description}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
      </Link>
    </li>
  );
}

function PlansSkeleton() {
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
