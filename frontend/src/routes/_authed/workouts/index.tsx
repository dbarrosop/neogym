import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Globe2, Plus, Tag, User } from "lucide-react";
import { useMemo, useState } from "react";
import { stripMarkdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { cn } from "@/lib/utils";

const WorkoutsIndexQuery = graphql(`
  query WorkoutsIndex {
    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {
      id
      name
      description
      isPublic
      userId
      workoutExercises_aggregate {
        aggregate {
          count
        }
      }
      workoutLabels {
        labelId
      }
    }
    labels(order_by: { id: asc }) {
      id
    }
  }
`);

type Tab = "mine" | "public";

export const Route = createFileRoute("/_authed/workouts/")({
  component: WorkoutsRoute,
});

function WorkoutsRoute() {
  const [tab, setTab] = useState<Tab>("mine");
  const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set());
  const { data, isLoading, error } = useQuery({
    queryKey: ["workouts", "index"],
    queryFn: () => gqlRequest(WorkoutsIndexQuery),
  });

  const allLabels = useMemo(() => (data?.labels ?? []).map((l) => l.id), [data]);

  const filtered = useMemo(() => {
    const all = data?.workouts ?? [];
    const byTab = tab === "mine" ? all.filter((w) => !w.isPublic) : all.filter((w) => w.isPublic);
    if (activeLabels.size === 0) {
      return byTab;
    }
    return byTab.filter((w) => {
      const ids = new Set(w.workoutLabels.map((wl) => wl.labelId));
      // require all selected labels to be present (AND filter)
      for (const l of activeLabels) {
        if (!ids.has(l)) {
          return false;
        }
      }
      return true;
    });
  }, [data, tab, activeLabels]);

  const myCount = data?.workouts.filter((w) => !w.isPublic).length ?? 0;
  const publicCount = data?.workouts.filter((w) => w.isPublic).length ?? 0;

  function toggleLabel(label: string) {
    setActiveLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
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
      if (activeLabels.size > 0) {
        emptyMsg = "No workouts match the selected labels.";
      } else if (tab === "mine") {
        emptyMsg = "You haven't created any workouts yet.";
      } else {
        emptyMsg = "No public templates.";
      }
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>{emptyMsg}</p>
            {tab === "mine" && activeLabels.size === 0 ? (
              <Button asChild size="sm">
                <Link to="/workouts/new">
                  <Plus className="h-4 w-4" />
                  Create your first workout
                </Link>
              </Button>
            ) : null}
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
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-medium">{w.name}</h2>
                      {w.isPublic ? (
                        <Badge variant="primary">
                          <Globe2 className="h-3 w-3" /> Public
                        </Badge>
                      ) : null}
                    </div>
                    {w.description ? (
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        {stripMarkdown(w.description)}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {w.workoutExercises_aggregate.aggregate?.count ?? 0} exercises
                      </span>
                      {w.workoutLabels.map((wl) => (
                        <Badge key={wl.labelId} variant="primary" className="px-1.5 py-0">
                          <Tag className="h-2.5 w-2.5" />
                          {wl.labelId}
                        </Badge>
                      ))}
                    </div>
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

        <div className="inline-flex w-full rounded-lg border border-border/60 bg-background/50 p-1 backdrop-blur sm:w-auto">
          <TabButton active={tab === "mine"} onClick={() => setTab("mine")} count={myCount}>
            <User className="h-4 w-4" />
            Mine
          </TabButton>
          <TabButton active={tab === "public"} onClick={() => setTab("public")} count={publicCount}>
            <Globe2 className="h-4 w-4" />
            Public
          </TabButton>
        </div>

        {tab === "mine" && allLabels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Filter
            </span>
            {allLabels.map((label) => {
              const active = activeLabels.has(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleLabel(label)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  <Tag className="h-3 w-3" />
                  {label}
                </button>
              );
            })}
            {activeLabels.size > 0 ? (
              <button
                type="button"
                onClick={() => setActiveLabels(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {renderContent()}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-xs font-medium",
          active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
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
