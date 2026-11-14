import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { ClipboardList, Plus, Search, X } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { formatKcalNumber } from "@/lib/metric-format";
import {
  formatWholeGrams,
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

  const { data, isLoading, error, refetch, isFetching } = useQuery({
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

  function renderContent() {
    if (isLoading) {
      return <PlansSkeleton />;
    }
    if (error) {
      return (
        <ErrorState
          title="Couldn't load plans"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      );
    }
    if (plans.length === 0) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="No plans yet"
          description="A plan is a one-day template of timed meals and foods. Pick one on a day’s log to plan against it."
          actions={
            <Button asChild>
              <Link to="/nutrition/plans/new">
                <Plus />
                Create your first plan
              </Link>
            </Button>
          }
        />
      );
    }
    if (filteredPlans.length === 0) {
      return (
        <EmptyState
          icon={Search}
          title="No plans match this search"
          description="Try a plan or meal name."
          actions={
            <Button type="button" variant="outline" onClick={() => setSearchText("")}>
              Clear search
            </Button>
          }
        />
      );
    }
    return (
      <>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
          {filteredPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </ul>
        <p className="text-[13px] text-muted-foreground">Totals use live food values.</p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[760px] text-sm leading-normal text-muted-foreground">
        Reusable one-day templates made of timed meals and direct foods. Pick one on a day’s log to
        plan against it; plans never change what you already logged.
      </p>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search plans or meals…"
          aria-label="Search plans or meals"
          className="h-10 rounded-[10px] border-border bg-card pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearchText("")}
            className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-[8px] text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {renderContent()}
    </div>
  );
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
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
        className="flex h-full flex-col gap-3 rounded-[14px] border bg-card p-[18px] transition-colors hover:bg-muted/40"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[17px] font-bold">{plan.name}</span>
          <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
            {countLabel(slotCount, "slot", "slots")} ·{" "}
            {countLabel(entries.length, "entry", "entries")}
          </span>
        </span>
        {plan.description ? (
          <span className="line-clamp-2 text-[13px] leading-[1.45] text-muted-foreground">
            {plan.description}
          </span>
        ) : null}
        <span className="mt-auto flex flex-wrap items-baseline justify-between gap-2 tabular-nums">
          <span className="text-[22px] font-bold">
            {formatKcalNumber(totals.kcal)}{" "}
            <span className="text-[13px] font-medium text-muted-foreground">kcal</span>
          </span>
          <span className="text-[13px] text-soft-foreground">
            P <strong>{formatWholeGrams(totals.protein)}</strong> · C{" "}
            <strong>{formatWholeGrams(totals.carbs)}</strong> · F{" "}
            <strong>{formatWholeGrams(totals.fat)}</strong>
          </span>
        </span>
      </Link>
    </li>
  );
}

function PlansSkeleton() {
  return (
    <SkeletonState className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex flex-col gap-3 rounded-[14px] border bg-card p-[18px]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </SkeletonState>
  );
}
