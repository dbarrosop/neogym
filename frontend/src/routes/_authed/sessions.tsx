import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useMemo } from "react";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SessionsIndexQuery as SessionsIndexData } from "@/gql/graphql";
import { useSessionsIndex } from "@/lib/hooks/use-sessions-index";
import { sessionDisplayName } from "@/lib/sessions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/sessions")({
  component: SessionsLayout,
  staticData: { splitView: true },
});

const TRAILING_SLASH = /\/$/;

function SessionsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hasDetail = pathname.replace(TRAILING_SLASH, "") !== "/sessions";

  return (
    <PageShell maxWidth="6xl">
      <div className={cn(hasDetail && "hidden min-[1100px]:block")}>
        <PageHeader
          title="Train"
          tabs={<AreaTabs area="train" />}
          actions={
            <Button asChild>
              <Link to="/workouts">
                <Plus />
                Start session
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
          <SessionList activePath={pathname} />
        </div>
        <div className={cn("min-w-0", !hasDetail && "hidden min-[1100px]:block")}>
          <Outlet />
        </div>
      </div>
    </PageShell>
  );
}

type SessionSummary = SessionsIndexData["workoutSessions"][number];

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const weekday = (start.getDay() + 6) % 7; // Monday = 0
  start.setDate(start.getDate() - weekday);
  return start;
}

function weekLabel(weekStart: Date, now: Date) {
  const thisWeek = startOfWeek(now).getTime();
  const diffWeeks = Math.round((thisWeek - weekStart.getTime()) / (7 * 24 * 3600 * 1000));
  if (diffWeeks === 0) {
    return "This week";
  }
  if (diffWeeks === 1) {
    return "Last week";
  }
  const sameYear = weekStart.getFullYear() === now.getFullYear();
  return `Week of ${weekStart.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  })}`;
}

function groupByWeek(sessions: SessionSummary[]) {
  const now = new Date();
  const groups: { key: string; label: string; sessions: SessionSummary[] }[] = [];
  for (const session of sessions) {
    const weekStart = startOfWeek(new Date(session.startedAt));
    const key = weekStart.toISOString();
    const last = groups.at(-1);
    if (last && last.key === key) {
      last.sessions.push(session);
    } else {
      groups.push({ key, label: weekLabel(weekStart, now), sessions: [session] });
    }
  }
  return groups;
}

function sessionCounts(session: SessionSummary) {
  const exercises = session.workoutSessionExercises_aggregate.aggregate?.count ?? 0;
  const sets = session.workoutSessionExercises.reduce(
    (total, row) =>
      total +
      (row.workoutSessionStrengthSets_aggregate.aggregate?.count ?? 0) +
      (row.workoutSessionCardioEntries_aggregate.aggregate?.count ?? 0),
    0,
  );
  return { exercises, sets };
}

function SessionList({ activePath }: { activePath: string }) {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSessionsIndex();
  const sessions = useMemo(() => data?.pages.flatMap((p) => p.workoutSessions) ?? [], [data]);
  const groups = useMemo(() => groupByWeek(sessions), [sessions]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return <ErrorState title="Couldn't load sessions" message={error.message} />;
  }
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="No sessions yet"
        description="Pick a workout or open an exercise and start a session. It shows up here."
      >
        <Button asChild>
          <Link to="/workouts">Choose a workout</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <nav aria-label="Sessions" className="flex flex-col gap-1 rounded-xl border bg-card p-2">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-0.5">
          <h2 className="px-2.5 pt-2.5 pb-1 text-[13px] font-semibold text-muted-foreground">
            {group.label} · {group.sessions.length}
          </h2>
          {group.sessions.map((session) => {
            const date = new Date(session.startedAt);
            const { exercises, sets } = sessionCounts(session);
            const active = activePath.startsWith(`/sessions/${session.id}`);
            return (
              <Link
                key={session.id}
                to="/sessions/$sessionId"
                params={{ sessionId: session.id }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
                  active && "bg-muted hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg bg-surface-inset text-center leading-none",
                    active && "bg-accent-soft text-accent-soft-foreground",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase opacity-70">
                    {date.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">{date.getDate()}</span>
                </span>
                <span className="flex min-w-0 flex-col">
                  <strong className="truncate text-sm font-semibold">
                    {sessionDisplayName({
                      workoutName: session.workout?.name,
                      exerciseNames: session.workoutSessionExercises.map(
                        (row) => row.exercise.name,
                      ),
                    })}
                  </strong>
                  <span className="truncate text-[13px] text-muted-foreground tabular-nums">
                    {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ·{" "}
                    {exercises} {exercises === 1 ? "exercise" : "exercises"} · {sets}{" "}
                    {sets === 1 ? "set" : "sets"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ))}
      {hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? <Loader2 className="animate-spin" /> : null}
          Load more
        </Button>
      ) : null}
    </nav>
  );
}
