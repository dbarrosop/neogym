import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Globe2, Loader2, Pencil, Play, Tag, User } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { AlternatingStorageImage } from "@/components/storage-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useStartSession } from "@/lib/hooks/use-start-session";
import { useAuth } from "@/lib/nhost/auth-provider";

const WorkoutDetailQuery = graphql(`
  query WorkoutDetail($id: uuid!) {
    workout(id: $id) {
      id
      name
      description
      isPublic
      userId
      workoutExercises(order_by: { position: asc }) {
        id
        position
        exercise {
          id
          name
          doubleWeight
          primaryMuscleGroup
          image1FileId
          image2FileId
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

export const Route = createFileRoute("/_authed/workouts/$workoutId")({
  component: WorkoutDetailRoute,
});

function WorkoutDetailRoute() {
  const { workoutId } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["workouts", "detail", workoutId],
    queryFn: () => gqlRequest(WorkoutDetailQuery, { id: workoutId }),
  });
  const startSession = useStartSession();

  function renderContent() {
    if (isLoading) {
      return <DetailSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!data?.workout) {
      return <p className="text-sm text-muted-foreground">Workout not found.</p>;
    }
    const workout = data.workout;
    const canEdit = Boolean(user && workout.userId === user.id && !workout.isPublic);
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="min-w-0 text-2xl tracking-tight">{workout.name}</CardTitle>
            <div className="flex shrink-0 items-center gap-2">
              {workout.isPublic ? (
                <Badge variant="primary">
                  <Globe2 className="h-3 w-3" /> Public
                </Badge>
              ) : (
                <Badge>
                  <User className="h-3 w-3" /> Mine
                </Badge>
              )}
              {canEdit ? (
                <Button asChild size="icon" variant="ghost" aria-label="Edit workout">
                  <Link to="/workouts/$workoutId/edit" params={{ workoutId: workout.id }}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          {workout.description ? <Markdown>{workout.description}</Markdown> : null}
          {workout.workoutLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {workout.workoutLabels.map((wl) => (
                <Badge key={wl.labelId} variant="primary">
                  <Tag className="h-3 w-3" />
                  {wl.label.name}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {workout.workoutExercises.length} exercise
            {workout.workoutExercises.length === 1 ? "" : "s"}
          </p>
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={startSession.isPending}
            onClick={() =>
              startSession.mutate({
                workoutId: workout.id,
                exercises: workout.workoutExercises.map((we) => ({
                  exerciseId: we.exercise.id,
                  position: we.position,
                })),
              })
            }
          >
            {startSession.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            Start session
          </Button>
        </CardHeader>
        <CardContent className="px-2 pt-0 pb-2">
          <ol className="divide-y divide-border/50">
            {workout.workoutExercises.map((we, idx) => (
              <li key={we.id}>
                <Link
                  to="/workouts/$workoutId/exercises/$exerciseId"
                  params={{ workoutId, exerciseId: we.exercise.id }}
                  className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
                    <AlternatingStorageImage
                      fileIds={[we.exercise.image1FileId, we.exercise.image2FileId]}
                      alt={we.exercise.name}
                      className="h-full w-full"
                    />
                    <span className="absolute right-0.5 bottom-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-background/90 px-1 text-[10px] font-semibold tabular-nums text-foreground shadow-sm ring-1 ring-border/60">
                      {idx + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{we.exercise.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {we.exercise.primaryMuscleGroup}
                      {we.exercise.doubleWeight ? " · two-handed" : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                </Link>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Workout
        </p>
        {renderContent()}
      </div>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-3 w-20" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
