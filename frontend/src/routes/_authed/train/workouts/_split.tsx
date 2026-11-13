import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  filterWorkouts,
  useWorkoutsIndex,
  type WorkoutVisibility,
  workoutsSearchSchema,
} from "@/lib/hooks/use-workouts-index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/train/workouts/_split")({
  validateSearch: workoutsSearchSchema,
  component: WorkoutsLayout,
  staticData: { splitView: true },
});

const TRAILING_SLASH = /\/$/;

function WorkoutsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hasDetail = pathname.replace(TRAILING_SLASH, "") !== "/train/workouts";

  return (
    <PageShell maxWidth="6xl">
      <div className={cn(hasDetail && "hidden min-[1100px]:block")}>
        <PageHeader
          title="Train"
          tabs={<AreaTabs area="train" />}
          actions={
            <Button asChild>
              <Link to="/train/workouts/new">
                <Plus />
                New workout
              </Link>
            </Button>
          }
        />
      </div>
      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[300px_minmax(0,1fr)]">
        <div
          className={cn(
            "min-[1100px]:sticky min-[1100px]:top-6",
            hasDetail && "hidden min-[1100px]:block",
          )}
        >
          <WorkoutList activePath={pathname} />
        </div>
        <div className={cn("min-w-0", !hasDetail && "hidden min-[1100px]:block")}>
          <Outlet />
        </div>
      </div>
    </PageShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function WorkoutList({ activePath }: { activePath: string }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading, error } = useWorkoutsIndex();
  const activeLabels = useMemo(() => new Set(search.labels ?? []), [search.labels]);
  const workouts = useMemo(() => filterWorkouts(data?.workouts ?? [], search), [data, search]);
  const isFiltered = search.visibility !== undefined || activeLabels.size > 0;

  function toggleVisibility(next: WorkoutVisibility) {
    navigate({
      search: (prev) => ({ ...prev, visibility: prev.visibility === next ? undefined : next }),
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

  if (error) {
    return <ErrorState title="Couldn't load workouts" message={error.message} />;
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-2">
      <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-1.5">
        <legend className="sr-only">Filter workouts</legend>
        <Chip active={!isFiltered} onClick={() => navigate({ search: {}, replace: true })}>
          All
        </Chip>
        <Chip active={search.visibility === "mine"} onClick={() => toggleVisibility("mine")}>
          Mine
        </Chip>
        <Chip active={search.visibility === "public"} onClick={() => toggleVisibility("public")}>
          Public
        </Chip>
        {(data?.labels ?? []).map((label) => (
          <Chip
            key={label.id}
            active={activeLabels.has(label.id)}
            onClick={() => toggleLabel(label.id)}
          >
            {label.name}
          </Chip>
        ))}
      </fieldset>
      {isLoading ? (
        <div className="flex flex-col gap-2 p-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : null}
      {!isLoading && workouts.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent shadow-none"
          title={isFiltered ? "No workouts match these filters" : "No workouts yet"}
          description={
            isFiltered ? "Clear a filter to see more." : "Create one to start sessions from it."
          }
        />
      ) : null}
      <nav aria-label="Workouts" className="flex flex-col gap-0.5">
        {workouts.map((workout) => {
          const active = activePath.startsWith(`/train/workouts/${workout.id}`);
          const count = workout.workoutExercises_aggregate.aggregate?.count ?? 0;
          return (
            <Link
              key={workout.id}
              to="/train/workouts/$workoutId"
              params={{ workoutId: workout.id }}
              search={(prev) => prev}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60",
                active &&
                  "bg-accent-soft/60 ring-1 ring-primary/40 ring-inset hover:bg-accent-soft/60",
              )}
            >
              <strong className="truncate text-sm font-semibold">{workout.name}</strong>
              <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                <span className="tabular-nums">
                  {count} {count === 1 ? "exercise" : "exercises"}
                </span>
                {workout.isPublic ? (
                  <span className="rounded-full bg-muted px-2 text-[12px]">public</span>
                ) : null}
                {workout.workoutLabels.map((wl) => (
                  <span
                    key={wl.labelId}
                    className="rounded-full bg-surface-inset px-2 text-[12px] text-foreground/80"
                  >
                    {wl.label.name}
                  </span>
                ))}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
