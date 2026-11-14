import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Apple, ChevronRight, Globe, Plus, SearchX, User } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import {
  FoodSummary,
  formatPer100,
  LibrarySearchField,
  LibrarySkeleton,
} from "@/components/nutrition-library";
import { FilterChip } from "@/components/patterns/filter-chip";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Tag } from "@/components/patterns/tag";
import { Button } from "@/components/ui/button";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useIsSplit } from "@/lib/hooks/use-is-split";
import { cn } from "@/lib/utils";

const FoodsIndexQuery = graphql(`
  query FoodsIndex {
    foods(order_by: [{ isPublic: asc }, { name: asc }]) {
      id
      name
      userId
      isPublic
      kcalPer100g
      fatPer100g
      carbsPer100g
      proteinPer100g
      fiberPer100g
      sugarPer100g
    }
  }
`);

const visibilityValues = ["mine", "public"] as const;
type Visibility = (typeof visibilityValues)[number];

const foodsSearchSchema = z.object({
  q: z.string().optional(),
  visibility: z.enum(visibilityValues).optional(),
  /** Food shown in the side panel from 1100 px; defaults to the first row. */
  selected: z.string().optional(),
});

export const Route = createFileRoute("/_authed/nutrition/foods/")({
  validateSearch: foodsSearchSchema,
  component: FoodsIndexRoute,
});

type Food = {
  id: string;
  name: string;
  userId?: string | null;
  isPublic: boolean;
  kcalPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
  proteinPer100g: unknown;
  fiberPer100g: unknown;
  sugarPer100g: unknown;
};

function useFilteredFoods(foods: Food[], search: string, visibility: Visibility | null) {
  const fuse = useMemo(
    () =>
      new Fuse(foods, {
        keys: ["name"],
        ignoreLocation: true,
        threshold: 0.35,
        includeScore: true,
      }),
    [foods],
  );

  return useMemo(() => {
    let result = foods;
    if (visibility === "mine") {
      result = result.filter((food) => !food.isPublic);
    } else if (visibility === "public") {
      result = result.filter((food) => food.isPublic);
    }
    const trimmed = search.trim();
    if (!trimmed) {
      return result;
    }
    const scores = new Map<string, number>();
    for (const match of fuse.search(trimmed)) {
      scores.set(match.item.id, match.score ?? 0);
    }
    return result
      .filter((food) => scores.has(food.id))
      .toSorted(
        (a, b) =>
          (scores.get(a.id) ?? Number.POSITIVE_INFINITY) -
          (scores.get(b.id) ?? Number.POSITIVE_INFINITY),
      );
  }, [foods, fuse, search, visibility]);
}

function FoodsIndexRoute() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const search = searchParams.q ?? "";
  const visibility: Visibility | null = searchParams.visibility ?? null;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nutrition", "foods", "index"],
    queryFn: () => gqlRequest(FoodsIndexQuery),
  });

  const foods = useMemo<Food[]>(() => data?.foods ?? [], [data]);
  const filteredFoods = useFilteredFoods(foods, search, visibility);
  const isFiltered = search.trim() !== "" || visibility !== null;
  const split = useIsSplit();
  const selected = split
    ? (filteredFoods.find((food) => food.id === searchParams.selected) ?? filteredFoods[0])
    : undefined;

  function setSearchText(value: string) {
    navigate({
      search: (prev) => ({ ...prev, q: value === "" ? undefined : value }),
      replace: true,
    });
  }

  function toggleVisibility(value: Visibility) {
    navigate({
      search: (prev) => ({ ...prev, visibility: visibility === value ? undefined : value }),
      replace: true,
    });
  }

  function clearAll() {
    navigate({ search: {}, replace: true });
  }

  function renderContent() {
    if (isLoading) {
      return <LibrarySkeleton />;
    }
    if (!data) {
      return null;
    }
    if (filteredFoods.length === 0) {
      return isFiltered ? (
        <EmptyState
          icon={SearchX}
          title="No foods match"
          description={
            search.trim()
              ? `Nothing in your foods or the public catalog matches “${search.trim()}”.`
              : "No foods match this filter."
          }
          actions={
            <Button type="button" variant="outline" onClick={clearAll}>
              {search.trim() ? "Clear search" : "Clear filter"}
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Apple}
          title="No foods yet"
          description="Create a private food with the per-100 g values from its package label."
          actions={
            <Button asChild>
              <Link to="/nutrition/foods/new">
                <Plus />
                New food
              </Link>
            </Button>
          }
        />
      );
    }
    return (
      <>
        <div className="hidden items-start gap-5 md:flex">
          <FoodsTable foods={filteredFoods} selectedId={selected?.id} />
          {selected ? (
            <aside
              aria-label="Selected food"
              className="sticky top-6 hidden w-[320px] shrink-0 flex-col gap-3.5 rounded-xl border bg-card p-5 md:flex"
            >
              <FoodSummary food={selected} variant="panel" canEdit={!selected.isPublic} />
            </aside>
          ) : null}
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card md:hidden">
          {filteredFoods.map((food) => (
            <FoodRow key={food.id} food={food} />
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[760px] text-sm leading-normal text-muted-foreground">
        Search public foods and your private catalog.
      </p>

      <div className="flex flex-col gap-3">
        <LibrarySearchField
          label="Search foods"
          placeholder="Search foods…"
          value={search}
          onChange={setSearchText}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <fieldset className="flex gap-2">
            <legend className="sr-only">Show only</legend>
            <FilterChip
              size="sm"
              icon={User}
              selected={visibility === "mine"}
              onClick={() => toggleVisibility("mine")}
            >
              Mine
            </FilterChip>
            <FilterChip
              size="sm"
              icon={Globe}
              selected={visibility === "public"}
              onClick={() => toggleVisibility("public")}
            >
              Public
            </FilterChip>
          </fieldset>
          {isFiltered && data ? (
            <>
              <p aria-live="polite" className="text-[13px] text-muted-foreground tabular-nums">
                {filteredFoods.length} {filteredFoods.length === 1 ? "match" : "matches"}
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={clearAll}
                className="ml-auto h-auto px-0"
              >
                Clear all
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Couldn’t load foods"
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
 * Catalog from 768 px: secondary macros appear when the table itself has room,
 * including beside the split panel. From 1100 px (`selectedId` set) a row
 * selects the food for the side panel instead of opening its page.
 */
function FoodsTable({ foods, selectedId }: { foods: Food[]; selectedId?: string | undefined }) {
  return (
    <div className="@container hidden min-w-0 flex-1 overflow-hidden rounded-xl border bg-card md:block">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-right text-xs text-muted-foreground">
            <th scope="col" className={cn(TH, "pl-4 text-left")}>
              Name
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
            <th scope="col" className={cn(TH, "pr-4 @xl:pr-3")}>
              Fat
            </th>
            <th scope="col" className={cn(TH, "hidden @xl:table-cell")}>
              Fiber
            </th>
            <th scope="col" className={cn(TH, "hidden pr-4 @xl:table-cell")}>
              Sugar
            </th>
          </tr>
        </thead>
        <tbody>
          {foods.map((food) => (
            <tr
              key={food.id}
              className={cn(
                "border-b text-right hover:bg-surface-inset",
                food.id === selectedId && "bg-accent-soft/60 hover:bg-accent-soft/60",
              )}
            >
              <td className="h-[46px] min-w-40 max-w-0 py-1.5 pr-3 pl-4 text-left">
                <FoodNameLink food={food} selectedId={selectedId} />
                {food.isPublic ? <Tag className="mt-1">public</Tag> : null}
              </td>
              <td className="w-16 px-3 font-semibold">{formatPer100(food.kcalPer100g)}</td>
              <td className="w-16 px-3">{formatPer100(food.proteinPer100g)}</td>
              <td className="w-16 px-3">{formatPer100(food.carbsPer100g)}</td>
              <td className="w-16 pr-4 pl-3 @xl:pr-3">{formatPer100(food.fatPer100g)}</td>
              <td className="hidden w-16 px-3 text-muted-foreground @xl:table-cell">
                {formatPer100(food.fiberPer100g)}
              </td>
              <td className="hidden w-16 pr-4 pl-3 text-muted-foreground @xl:table-cell">
                {formatPer100(food.sugarPer100g)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[13px] text-muted-foreground">Values per 100 g.</p>
    </div>
  );
}

function FoodNameLink({ food, selectedId }: { food: Food; selectedId: string | undefined }) {
  const className = "block wrap-break-word font-medium hover:text-link";
  if (selectedId === undefined) {
    return (
      <Link to="/nutrition/foods/$foodId" params={{ foodId: food.id }} className={className}>
        {food.name}
      </Link>
    );
  }
  return (
    <Link
      to="/nutrition/foods"
      search={(prev) => ({ ...prev, selected: food.id })}
      replace={true}
      aria-current={food.id === selectedId ? "true" : undefined}
      className={className}
    >
      {food.name}
    </Link>
  );
}

/** Below 768 px: one title, one P · C · F line, kcal per 100 g trailing; opens the food. */
function FoodRow({ food }: { food: Food }) {
  const protein = formatPer100(food.proteinPer100g);
  const carbs = formatPer100(food.carbsPer100g);
  const fat = formatPer100(food.fatPer100g);
  return (
    <li>
      <Link
        to="/nutrition/foods/$foodId"
        params={{ foodId: food.id }}
        className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 wrap-break-word text-[15px] font-semibold">{food.name}</span>
            {food.isPublic ? <Tag>public</Tag> : null}
          </span>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            <span className="sr-only">{`Protein ${protein} g, carbs ${carbs} g, fat ${fat} g`}</span>
            <span aria-hidden="true">{`P ${protein} · C ${carbs} · F ${fat} g`}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end tabular-nums">
          <span className="text-[15px] font-semibold">{formatPer100(food.kcalPer100g)}</span>
          <span className="text-xs text-muted-foreground">kcal/100 g</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
