import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Globe2, Plus, Tag, User } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { stripMarkdown } from "@/components/markdown";
import { SearchBar } from "@/components/search-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const WorkoutsIndexQuery = graphql(`
  query WorkoutsIndex {
    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {
      id
      name
      description
      isPublic
      workoutExercises_aggregate {
        aggregate {
          count
        }
      }
      workoutLabels {
        labelId
        label {
          id
          name
        }
      }
    }
    labels(order_by: { name: asc }) {
      id
      name
    }
  }
`);

const SearchWorkoutsQuery = graphql(`
  query SearchWorkouts($query: String!) {
    searchWorkouts(args: { query: $query }) {
      id
      name
      description
      isPublic
      workoutExercises_aggregate {
        aggregate {
          count
        }
      }
      workoutLabels {
        labelId
        label {
          id
          name
        }
      }
    }
  }
`);

const visibilityValues = ["mine", "public"] as const;
type Visibility = (typeof visibilityValues)[number];

const workoutsSearchSchema = z.object({
  q: z.string().optional(),
  visibility: z.enum(visibilityValues).optional(),
  labels: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/_authed/workouts/")({
  validateSearch: workoutsSearchSchema,
  component: WorkoutsRoute,
});

function WorkoutsRoute() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const visibility: Visibility | null = searchParams.visibility ?? null;
  const activeLabels = useMemo(() => new Set(searchParams.labels ?? []), [searchParams.labels]);
  const query = searchParams.q ?? "";
  const debouncedQuery = useDebouncedValue(query, 250).trim();
  const isSearching = debouncedQuery.length > 0;

  const indexQuery = useQuery({
    queryKey: ["workouts", "index"],
    queryFn: () => gqlRequest(WorkoutsIndexQuery),
  });

  const searchResultsQuery = useQuery({
    queryKey: ["workouts", "search", debouncedQuery],
    queryFn: () => gqlRequest(SearchWorkoutsQuery, { query: debouncedQuery }),
    enabled: isSearching,
  });

  const allLabels = useMemo(() => indexQuery.data?.labels ?? [], [indexQuery.data]);

  const workouts = useMemo(() => {
    if (isSearching) {
      return searchResultsQuery.data?.searchWorkouts ?? [];
    }
    return indexQuery.data?.workouts ?? [];
  }, [isSearching, searchResultsQuery.data, indexQuery.data]);

  const filtered = useMemo(() => {
    let result = workouts;
    if (visibility === "mine") {
      result = result.filter((w) => !w.isPublic);
    } else if (visibility === "public") {
      result = result.filter((w) => w.isPublic);
    }
    if (activeLabels.size > 0) {
      result = result.filter((w) => {
        const ids = new Set(w.workoutLabels.map((wl) => wl.labelId));
        // require all selected labels to be present (AND filter)
        for (const l of activeLabels) {
          if (!ids.has(l)) {
            return false;
          }
        }
        return true;
      });
    }
    return result;
  }, [workouts, visibility, activeLabels]);

  const isFiltered = isSearching || visibility !== null || activeLabels.size > 0;
  const isLoading = isSearching ? searchResultsQuery.isLoading : indexQuery.isLoading;
  const error = isSearching ? searchResultsQuery.error : indexQuery.error;

  function setSearchText(value: string) {
    navigate({
      search: (prev) => ({ ...prev, q: value === "" ? undefined : value }),
      replace: true,
    });
  }

  function toggleVisibility(next: Visibility) {
    navigate({
      search: (prev) => ({
        ...prev,
        visibility: prev.visibility === next ? undefined : next,
      }),
      replace: true,
    });
  }

  function toggleLabel(label: string) {
    navigate({
      search: (prev) => {
        const current = prev.labels ?? [];
        const next = current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label];
        return { ...prev, labels: next.length === 0 ? undefined : next };
      },
      replace: true,
    });
  }

  function clearAll() {
    navigate({ search: {}, replace: true });
  }

  function renderContent() {
    if (isLoading) {
      return <WorkoutsSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (filtered.length === 0) {
      let emptyMsg: string;
      if (isSearching) {
        emptyMsg = `No workouts match “${debouncedQuery}”.`;
      } else if (isFiltered) {
        emptyMsg = "No workouts match the selected filters.";
      } else {
        emptyMsg = "You haven't created any workouts yet.";
      }
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>{emptyMsg}</p>
            {isFiltered ? null : (
              <Button asChild size="sm">
                <Link to="/workouts/new">
                  <Plus className="h-4 w-4" />
                  Create your first workout
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }
    return (
      <ul className="space-y-2">
        {filtered.map((w) => (
          <li key={w.id}>
            <Link to="/workouts/$workoutId" params={{ workoutId: w.id }} className="group block">
              <Card className="border-border/60 py-0 backdrop-blur transition-colors group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80">
                <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="min-w-0 flex-1 truncate font-medium">{w.name}</h2>
                      <div className="flex shrink-0 items-center gap-1">
                        {w.isPublic ? (
                          <Badge variant="primary" className="px-1.5 py-0">
                            <Globe2 className="h-2.5 w-2.5" /> Public
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="px-1.5 py-0">
                            <User className="h-2.5 w-2.5" /> Mine
                          </Badge>
                        )}
                        {w.workoutLabels.map((wl) => (
                          <Badge key={wl.labelId} variant="primary" className="px-1.5 py-0">
                            <Tag className="h-2.5 w-2.5" />
                            {wl.label.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {w.description ? (
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        {stripMarkdown(w.description)}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {w.workoutExercises_aggregate.aggregate?.count ?? 0} exercises
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Plans
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Workouts</h1>
            <p className="text-sm text-muted-foreground">
              Your routines and shared community templates.
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/workouts/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New workout</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
        </header>

        <SearchBar value={query} onChange={setSearchText} placeholder="Search workouts…" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Filter
          </span>
          <FilterPill
            active={visibility === "mine"}
            onClick={() => toggleVisibility("mine")}
            icon={<User className="h-3 w-3" />}
          >
            Mine
          </FilterPill>
          <FilterPill
            active={visibility === "public"}
            onClick={() => toggleVisibility("public")}
            icon={<Globe2 className="h-3 w-3" />}
          >
            Public
          </FilterPill>
          {allLabels.map((label) => (
            <FilterPill
              key={label.id}
              active={activeLabels.has(label.id)}
              onClick={() => toggleLabel(label.id)}
              icon={<Tag className="h-3 w-3" />}
            >
              {label.name}
            </FilterPill>
          ))}
          {isFiltered ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>

        {renderContent()}
      </div>
    </section>
  );
}

function FilterPill({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function WorkoutsSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <li key={i}>
          <Card className="border-border/60 py-0">
            <CardContent className="space-y-2 px-4 py-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
