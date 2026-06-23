import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Apple, ChevronRight, Globe2, Plus, Search, User, X } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { macroSummary } from "@/lib/nutrition";
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
        <Card className="border-border/60 border-dashed">
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
                className="text-xs font-medium text-primary hover:underline"
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
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardContent className="px-2 py-2">
          <ul className="divide-y divide-border/50">
            {filteredFoods.map((food) => (
              <FoodRow key={food.id} food={food} />
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Foods</h2>
          <p className="text-sm text-muted-foreground">
            Search public foods and your private catalog.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/nutrition/foods/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New food</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
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
              className="ml-auto text-xs font-medium text-primary hover:underline"
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
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search foods…"
        className="pr-9 pl-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
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
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function FoodRow({ food }: { food: Food }) {
  return (
    <li>
      <Link
        to="/nutrition/foods/$foodId"
        params={{ foodId: food.id }}
        className="group flex min-h-16 items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/50"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
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
    <Card className="border-border/60">
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
