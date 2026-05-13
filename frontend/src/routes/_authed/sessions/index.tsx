import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { sessionDisplayName } from "@/lib/sessions";

const PAGE_SIZE = 25;

const SessionsIndexQuery = graphql(`
  query SessionsIndex($limit: Int!, $offset: Int!) {
    workoutSessions(order_by: { startedAt: desc }, limit: $limit, offset: $offset) {
      id
      startedAt
      workout {
        id
        name
      }
      workoutSessionExercises_aggregate {
        aggregate {
          count
        }
      }
      workoutSessionExercises(order_by: { position: asc }) {
        exercise {
          id
          name
        }
        workoutSessionStrengthSets_aggregate {
          aggregate {
            count
            sum {
              reps
            }
          }
        }
        workoutSessionCardioEntries_aggregate {
          aggregate {
            count
          }
        }
      }
    }
  }
`);

export const Route = createFileRoute("/_authed/sessions/")({
  component: SessionsRoute,
});

function SessionsRoute() {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["sessions", "index"],
      queryFn: ({ pageParam }) =>
        gqlRequest(SessionsIndexQuery, { limit: PAGE_SIZE, offset: pageParam }),
      initialPageParam: 0 as number,
      getNextPageParam: (lastPage, allPages): number | undefined => {
        if (lastPage.workoutSessions.length < PAGE_SIZE) {
          return undefined;
        }
        return allPages.reduce((acc, p) => acc + p.workoutSessions.length, 0);
      },
    });

  const allSessions = useMemo(() => data?.pages.flatMap((p) => p.workoutSessions) ?? [], [data]);

  const grouped = useMemo(() => {
    type Session = (typeof allSessions)[number];
    const groups = new Map<string, Session[]>();
    for (const s of allSessions) {
      const key = new Date(s.startedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      });
      const existing = groups.get(key);
      if (existing) {
        existing.push(s);
      } else {
        groups.set(key, [s]);
      }
    }
    return groups;
  }, [allSessions]);

  function renderContent() {
    if (isLoading) {
      return <SessionsSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (allSessions.length === 0) {
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">
            <p>No sessions yet.</p>
            <p>
              Pick a{" "}
              <Link to="/workouts" className="underline-offset-2 hover:underline">
                workout
              </Link>{" "}
              or open an{" "}
              <Link to="/exercises" className="underline-offset-2 hover:underline">
                exercise
              </Link>{" "}
              and tap <span className="font-medium text-foreground">Start session</span>.
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-6">
        {[...grouped.entries()].map(([month, sessions]) => (
          <div key={month} className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {month}
            </h2>
            <ul className="space-y-2">
              {sessions.map((s) => {
                const totalSets = s.workoutSessionExercises.reduce(
                  (acc, e) => acc + (e.workoutSessionStrengthSets_aggregate.aggregate?.count ?? 0),
                  0,
                );
                const totalCardioEntries = s.workoutSessionExercises.reduce(
                  (acc, e) => acc + (e.workoutSessionCardioEntries_aggregate.aggregate?.count ?? 0),
                  0,
                );
                const totalEntries = totalSets + totalCardioEntries;
                const exerciseCount = s.workoutSessionExercises_aggregate.aggregate?.count ?? 0;
                const date = new Date(s.startedAt);
                return (
                  <li key={s.id}>
                    <Link
                      to="/sessions/$sessionId"
                      params={{ sessionId: s.id }}
                      className="group block"
                    >
                      <Card className="border-border/60 py-0 backdrop-blur transition-colors group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80">
                        <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted text-center">
                              <span className="text-xs font-medium uppercase text-muted-foreground">
                                {date.toLocaleDateString(undefined, { month: "short" })}
                              </span>
                              <span className="-mt-0.5 text-base font-semibold leading-none">
                                {date.getDate()}
                              </span>
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <p className="truncate font-medium">
                                {sessionDisplayName({
                                  workoutName: s.workout?.name,
                                  exerciseNames: s.workoutSessionExercises.map(
                                    (e) => e.exercise.name,
                                  ),
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {date.toLocaleDateString(undefined, {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {exerciseCount} exercise{exerciseCount === 1 ? "" : "s"} ·{" "}
                                {totalEntries} entr{totalEntries === 1 ? "y" : "ies"}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            History
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Every session you've logged, newest first. To start a new one, pick a{" "}
            <Link to="/workouts" className="underline-offset-2 hover:underline">
              workout
            </Link>{" "}
            or open an{" "}
            <Link to="/exercises" className="underline-offset-2 hover:underline">
              exercise
            </Link>{" "}
            and tap <span className="font-medium text-foreground">Start session</span>.
          </p>
        </header>
        {renderContent()}
      </div>
    </section>
  );
}

function SessionsSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <li key={i}>
          <Card className="border-border/60 py-0">
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-11 w-11 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <CalendarDays className="h-4 w-4 text-muted-foreground/30" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
