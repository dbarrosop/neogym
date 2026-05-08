import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Globe2, Pencil, Play, User } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
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
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">{workout.name}</CardTitle>
              {workout.description ? (
                <p className="text-sm text-muted-foreground">{workout.description}</p>
              ) : null}
            </div>
            {workout.isPublic ? (
              <Badge variant="primary">
                <Globe2 className="h-3 w-3" /> Public
              </Badge>
            ) : (
              <Badge>
                <User className="h-3 w-3" /> Mine
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {workout.workoutExercises.length} exercise
            {workout.workoutExercises.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="flex-1">
              <Link to="/sessions/new" search={{ workoutId: workout.id }}>
                <Play className="mr-1 h-4 w-4" />
                Start session
              </Link>
            </Button>
            {canEdit ? (
              <Button asChild size="lg" variant="outline" className="sm:w-auto">
                <Link to="/workouts/$workoutId/edit" params={{ workoutId: workout.id }}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-0 pb-2">
          <ol className="divide-y divide-border/50">
            {workout.workoutExercises.map((we, idx) => (
              <li key={we.id}>
                <Link
                  to="/exercises/$exerciseId"
                  params={{ exerciseId: we.exercise.id }}
                  className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/50"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {idx + 1}
                  </span>
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
        <BackLink fallback="/workouts">Back</BackLink>
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
