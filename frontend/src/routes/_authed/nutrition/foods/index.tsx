import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Apple, ChevronRight, Globe2, Plus, Search, User, X } from "lucide-react";
import { Fragment, useMemo } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useIsSplit } from "@/lib/hooks/use-is-split";
import { macroSummary, normalizeNumeric } from "@/lib/nutrition";
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

function FoodsIndexRoute() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const search = searchParams.q ?? "";
  const visibility: Visibility | null = searchParams.visibility ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "foods", "index"],
    queryFn: () => gqlRequest(FoodsIndexQuery),
  });

  const foods = useMemo<Food[]>(() => data?.foods ?? [], [data]);
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

  const searchScores = useMemo<Map<string, number> | null>(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      return null;
    }
    const result = new Map<string, number>();
    for (const match of fuse.search(trimmed)) {
      result.set(match.item.id, match.score ?? 0);
    }
    return result;
  }, [fuse, search]);

  const filteredFoods = useMemo(() => {
    let result = foods;
    if (visibility === "mine") {
      result = result.filter((food) => !food.isPublic);
    } else if (visibility === "public") {
      result = result.filter((food) => food.isPublic);
    }
    if (searchScores) {
      result = result
        .filter((food) => searchScores.has(food.id))
        .slice()
        .sort((a, b) => {
          const aScore = searchScores.get(a.id) ?? Number.POSITIVE_INFINITY;
          const bScore = searchScores.get(b.id) ?? Number.POSITIVE_INFINITY;
          return aScore - bScore;
        });
    }
    return result;
  }, [foods, searchScores, visibility]);

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

  function setVisibility(value: Visibility | null) {
    navigate({
      search: (prev) => ({ ...prev, visibility: value ?? undefined }),
      replace: true,
    });
  }

  function clearAll() {
    navigate({ search: {}, replace: true });
  }

  function renderContent() {
    if (isLoading) {
      return <FoodsSkeleton />;
    }
    if (error) {
      return <ErrorCard message={error.message} />;
    }
    if (filteredFoods.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>
              {isFiltered
                ? "No foods match these filters."
                : "You do not have any foods yet. Public foods will appear here when available."}
            </p>
            {isFiltered ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-link hover:underline"
              >
                Clear filters
              </button>
            ) : (
              <Button asChild size="sm">
                <Link to="/nutrition/foods/new">
                  <Plus className="h-4 w-4" />
                  Create your first food
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
          <FoodsTable foods={filteredFoods} selectedId={selected?.id} />
          {selected ? <FoodPanel food={selected} /> : null}
        </div>
        <Card className="py-0 md:hidden">
          <CardContent className="p-2">
            <ul className="divide-y divide-border">
              {filteredFoods.map((food) => (
                <FoodRow key={food.id} food={food} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="max-w-prose text-sm text-muted-foreground">
            Search public foods and your private catalog.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <SearchBar value={search} onChange={setSearchText} />
        <div className="flex flex-wrap items-center gap-1.5">
          <VisibilityPill
            value="mine"
            active={visibility === "mine"}
            onClick={() => setVisibility(visibility === "mine" ? null : "mine")}
          />
          <VisibilityPill
            value="public"
            active={visibility === "public"}
            onClick={() => setVisibility(visibility === "public" ? null : "public")}
          />
          {isFiltered ? (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto text-xs font-medium text-link hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>
        {isFiltered ? (
          <p className="px-1 text-xs text-muted-foreground">
            {filteredFoods.length} match{filteredFoods.length === 1 ? "" : "es"}
          </p>
        ) : null}
      </div>

      {renderContent()}
    </div>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search foods…"
        className="h-11 rounded-xl bg-card pr-10 pl-10"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function VisibilityPill({
  value,
  active,
  onClick,
}: {
  value: Visibility;
  active: boolean;
  onClick: () => void;
}) {
  const label = value === "mine" ? "Mine" : "Public";
  const Icon = value === "mine" ? User : Globe2;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-accent-soft text-accent-soft-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

const per100Format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function per100(value: unknown): string {
  return per100Format.format(normalizeNumeric(value));
}

/**
 * Desktop catalog: every macro per 100 g in aligned columns. From 1100 px
 * (`selectedId` set) a row selects the food for the side panel instead of
 * opening its page.
 */
function FoodsTable({ foods, selectedId }: { foods: Food[]; selectedId?: string | undefined }) {
  return (
    <div className="hidden min-w-0 flex-1 overflow-hidden rounded-xl border bg-card md:block">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-right text-[12px] text-muted-foreground">
            <th scope="col" className="py-2.5 pl-4 text-left font-medium">
              Name
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
            <th scope="col" className="font-medium">
              Fat
            </th>
            <th scope="col" className="font-medium">
              Fiber
            </th>
            <th scope="col" className="pr-4 font-medium">
              Sugar
            </th>
          </tr>
        </thead>
        <tbody>
          {foods.map((food) => (
            <tr
              key={food.id}
              className={cn(
                "border-t text-right hover:bg-surface-inset",
                food.id === selectedId && "bg-accent-soft/60 hover:bg-accent-soft/60",
              )}
            >
              <td className="max-w-0 py-2.5 pr-4 pl-4 text-left">
                <span className="flex min-w-0 items-center gap-2">
                  {selectedId === undefined ? (
                    <Link
                      to="/nutrition/foods/$foodId"
                      params={{ foodId: food.id }}
                      className="truncate font-medium hover:text-link"
                    >
                      {food.name}
                    </Link>
                  ) : (
                    <Link
                      to="/nutrition/foods"
                      search={(prev) => ({ ...prev, selected: food.id })}
                      replace={true}
                      aria-current={food.id === selectedId ? "true" : undefined}
                      className="truncate font-medium hover:text-link"
                    >
                      {food.name}
                    </Link>
                  )}
                  {food.isPublic ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 text-[11px] text-muted-foreground">
                      public
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="w-16 font-semibold">{per100(food.kcalPer100g)}</td>
              <td className="w-16">{per100(food.proteinPer100g)}</td>
              <td className="w-16">{per100(food.carbsPer100g)}</td>
              <td className="w-16">{per100(food.fatPer100g)}</td>
              <td className="w-16 text-muted-foreground">{per100(food.fiberPer100g)}</td>
              <td className="w-16 pr-4 text-muted-foreground">{per100(food.sugarPer100g)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-4 py-2 text-[12px] text-muted-foreground">Values per 100 g.</p>
    </div>
  );
}

const PANEL_MACROS = [
  ["Protein", "proteinPer100g"],
  ["Carbs", "carbsPer100g"],
  ["Fat", "fatPer100g"],
  ["Fiber", "fiberPer100g"],
  ["Sugar", "sugarPer100g"],
] as const;

/** The selected food beside the table from 1100 px. */
function FoodPanel({ food }: { food: Food }) {
  return (
    <aside
      aria-label="Selected food"
      className="sticky top-6 hidden w-[320px] shrink-0 space-y-4 rounded-xl border border-border bg-card p-5 md:block"
    >
      <div className="space-y-1">
        <p className="text-[13px] text-muted-foreground">
          {food.isPublic ? "Public" : "Mine"} · per 100 g
        </p>
        <h2 className="text-[17px] font-semibold leading-snug">{food.name}</h2>
      </div>
      <p className="text-[26px] font-semibold tabular-nums">
        {per100(food.kcalPer100g)}{" "}
        <span className="text-sm font-medium text-muted-foreground">kcal</span>
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm tabular-nums">
        {PANEL_MACROS.map(([label, key]) => (
          <Fragment key={key}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{per100(food[key])} g</dd>
          </Fragment>
        ))}
      </dl>
      <div className="flex gap-2">
        <Button asChild variant="outline" className="min-h-11 flex-1">
          <Link to="/nutrition/foods/$foodId" params={{ foodId: food.id }}>
            Details
          </Link>
        </Button>
        {food.isPublic ? null : (
          <Button asChild variant="outline" className="min-h-11 flex-1">
            <Link to="/nutrition/foods/$foodId/edit" params={{ foodId: food.id }}>
              Edit
            </Link>
          </Button>
        )}
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {food.isPublic
          ? "Public foods are read-only. Create a private food to change values."
          : "Editing a food never changes days already logged; they keep their snapshot."}
      </p>
    </aside>
  );
}

function FoodRow({ food }: { food: Food }) {
  return (
    <li>
      <Link
        to="/nutrition/foods/$foodId"
        params={{ foodId: food.id }}
        className="group flex min-h-16 items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-soft-foreground">
            <Apple className="h-4 w-4" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{food.name}</span>
              {food.isPublic ? (
                <Badge variant="primary" className="shrink-0 px-1.5 py-0">
                  <Globe2 className="h-2.5 w-2.5" /> Public
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 px-1.5 py-0">
                  <User className="h-2.5 w-2.5" /> Mine
                </Badge>
              )}
            </span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {macroSummary(food)} per 100g
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
      </Link>
    </li>
  );
}

function FoodsSkeleton() {
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-4">
        {[0, 1, 2, 3].map((item) => (
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
