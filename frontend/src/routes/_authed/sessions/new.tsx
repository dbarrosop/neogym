import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Globe2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const NewSessionWorkoutsQuery = graphql(`
  query NewSessionWorkouts {
    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {
      id
      name
      description
      isPublic
      workoutExercises(order_by: { position: asc }) {
        id
        position
        exercise {
          id
        }
      }
    }
  }
`);

const StartSessionMutation = graphql(`
  mutation StartSession($obj: workoutSessions_insert_input!) {
    insertWorkoutSession(object: $obj) {
      id
    }
  }
`);

const searchSchema = z.object({
  workoutId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authed/sessions/new")({
  validateSearch: searchSchema,
  component: NewSessionRoute,
});

function NewSessionRoute() {
  const { workoutId: presetWorkoutId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingWorkoutId, setPendingWorkoutId] = useState<string | null>(null);
  const autoStartedRef = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sessions", "new", "workouts"],
    queryFn: () => gqlRequest(NewSessionWorkoutsQuery),
  });

  const startMutation = useMutation({
    mutationFn: (obj: SessionInsertInput) => gqlRequest(StartSessionMutation, { obj }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      // Replace so the workout picker doesn't sit on the history stack —
      // back from the new session should land on /sessions, not the picker.
      navigate({
        to: "/sessions/$sessionId",
        params: { sessionId: res.insertWorkoutSession?.id },
        replace: true,
      });
    },
    onError: (e) => {
      setPendingWorkoutId(null);
      toast.error(`Failed to start: ${e.message}`);
    },
  });

  const { mutate: startSession, isPending: isStarting } = startMutation;

  const handlePick = useCallback(
    (workout: NonNullable<typeof data>["workouts"][number]) => {
      if (isStarting) {
        return;
      }
      setPendingWorkoutId(workout.id);
      startSession({
        workoutId: workout.id,
        startedAt: new Date().toISOString(),
        workoutSessionExercises: {
          data: workout.workoutExercises.map((we) => ({
            exerciseId: we.exercise.id,
            position: we.position,
          })),
        },
      });
    },
    [isStarting, startSession],
  );

  // Auto-pick if a workoutId was provided in the URL (e.g., from "Start session" on workout detail).
  useEffect(() => {
    if (autoStartedRef.current) {
      return;
    }
    if (!presetWorkoutId || !data) {
      return;
    }
    const match = data.workouts.find((w) => w.id === presetWorkoutId);
    if (!match) {
      return;
    }
    autoStartedRef.current = true;
    handlePick(match);
  }, [presetWorkoutId, data, handlePick]);

  function renderContent() {
    if (isLoading) {
      return <PickerSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!data || data.workouts.length === 0) {
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No workouts available yet.
          </CardContent>
        </Card>
      );
    }
    return (
      <ul className="space-y-3">
        {data.workouts.map((w) => {
          const isPending = pendingWorkoutId === w.id && isStarting;
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => handlePick(w)}
                disabled={isStarting}
                className="group block w-full text-left disabled:opacity-50"
              >
                <Card className="border-border/60 backdrop-blur transition-colors group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0 space-y-1">
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
                          {w.description}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {w.workoutExercises.length} exercise
                        {w.workoutExercises.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {isPending ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                    )}
                  </CardContent>
                </Card>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-1">
            <BackLink fallback="/sessions" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              New session
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Pick a workout</h1>
          <p className="text-sm text-muted-foreground">
            We'll create the session and you can start logging sets right away.
          </p>
        </header>

        {renderContent()}

        <p className="text-center text-xs text-muted-foreground">
          Looking for an existing session?{" "}
          <Link to="/sessions" className="underline-offset-2 hover:underline">
            View history
          </Link>
        </p>
      </div>
    </section>
  );
}

type SessionInsertInput = {
  workoutId: string;
  startedAt: string;
  workoutSessionExercises: {
    data: Array<{
      exerciseId: string;
      position: number;
    }>;
  };
};

function PickerSkeleton() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <Card className="border-border/60">
            <CardContent className="space-y-2 py-4">
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
