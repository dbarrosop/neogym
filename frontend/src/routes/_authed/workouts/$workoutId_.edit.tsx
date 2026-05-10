import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutForm, type WorkoutFormValues } from "@/components/workout-form";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";

const EditWorkoutQuery = graphql(`
  query EditWorkout($id: uuid!) {
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
          primaryMuscleGroup
          doubleWeight
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

const SaveWorkoutMutation = graphql(`
  mutation SaveWorkout(
    $id: uuid!
    $set: workouts_set_input!
    $deleteRowIds: [uuid!]!
    $insertRows: [workoutExercises_insert_input!]!
    $positionUpdates: [workoutExercises_updates!]!
    $deleteLabelIds: [uuid!]!
    $insertLabels: [workoutLabels_insert_input!]!
  ) {
    updateWorkout(pk_columns: { id: $id }, _set: $set) {
      id
    }
    deleteWorkoutExercises(where: { id: { _in: $deleteRowIds } }) {
      affected_rows
    }
    insertWorkoutExercises(objects: $insertRows) {
      affected_rows
    }
    update_workoutExercises_many(updates: $positionUpdates) {
      affected_rows
    }
    deleteWorkoutLabels(
      where: { workoutId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }
    ) {
      affected_rows
    }
    insertWorkoutLabels(
      objects: $insertLabels
      on_conflict: { constraint: workout_labels_pkey, update_columns: [] }
    ) {
      affected_rows
    }
  }
`);

const DeleteWorkoutMutation = graphql(`
  mutation DeleteWorkout($id: uuid!) {
    deleteWorkout(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/workouts/$workoutId_/edit")({
  component: EditWorkoutRoute,
});

function EditWorkoutRoute() {
  const { workoutId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["workouts", "detail", workoutId],
    queryFn: () => gqlRequest(EditWorkoutQuery, { id: workoutId }),
  });

  const workout = data?.workout ?? null;
  const isOwner = Boolean(user && workout && workout.userId === user.id && !workout.isPublic);

  // Public/non-owned workouts can't be edited via Hasura — bounce out instead of
  // letting the user fill in a form that will fail on submit.
  useEffect(() => {
    if (!isLoading && workout && !isOwner) {
      navigate({
        to: "/workouts/$workoutId",
        params: { workoutId },
        replace: true,
      });
    }
  }, [isLoading, workout, isOwner, navigate, workoutId]);

  const initialValues = useMemo<WorkoutFormValues | null>(() => {
    if (!workout) {
      return null;
    }
    return {
      name: workout.name,
      description: workout.description ?? "",
      exercises: workout.workoutExercises.map((we) => ({
        rowId: we.id,
        exerciseId: we.exercise.id,
        name: we.exercise.name,
        primaryMuscleGroup: we.exercise.primaryMuscleGroup,
        doubleWeight: we.exercise.doubleWeight,
      })),
      labels: workout.workoutLabels.map((wl) => ({ id: wl.label.id, name: wl.label.name })),
    };
  }, [workout]);

  const saveMutation = useMutation({
    mutationFn: (values: WorkoutFormValues) => {
      if (!initialValues) {
        throw new Error("Workout not loaded");
      }

      const originalRowIds = new Set(initialValues.exercises.map((e) => e.rowId));
      const nextRowIds = new Set(values.exercises.map((e) => e.rowId));

      const deleteRowIds = initialValues.exercises
        .filter((e) => !nextRowIds.has(e.rowId))
        .map((e) => e.rowId);

      const insertRows: {
        workoutId: string;
        exerciseId: string;
        position: number;
      }[] = [];
      const positionUpdates: {
        where: { id: { _eq: string } };
        _set: { position: number };
      }[] = [];

      // Rewrite every surviving row's position rather than diffing against the
      // loaded order — the DB doesn't necessarily store contiguous 1-based
      // positions (seeds use 0-based, gaps are possible), so a "looks unchanged"
      // shortcut would leave old positions in place and collide with rows we
      // did move. The deferred unique constraint makes redundant writes safe.
      values.exercises.forEach((ex, idx) => {
        const position = idx + 1;
        if (originalRowIds.has(ex.rowId)) {
          positionUpdates.push({
            where: { id: { _eq: ex.rowId } },
            _set: { position },
          });
        } else {
          insertRows.push({ workoutId, exerciseId: ex.exerciseId, position });
        }
      });

      const originalIds = new Set(
        initialValues.labels.map((l) => l.id).filter((id): id is string => Boolean(id)),
      );
      const nextIds = new Set(
        values.labels.map((l) => l.id).filter((id): id is string => Boolean(id)),
      );
      const deleteLabelIds = [...originalIds].filter((id) => !nextIds.has(id));
      const insertLabels = values.labels
        .filter((l) => !l.id || !originalIds.has(l.id))
        .map((l) =>
          l.id ? { workoutId, labelId: l.id } : { workoutId, label: { data: { name: l.name } } },
        );

      return gqlRequest(SaveWorkoutMutation, {
        id: workoutId,
        set: {
          name: values.name,
          description: values.description || null,
        },
        deleteRowIds,
        insertRows,
        positionUpdates,
        deleteLabelIds,
        insertLabels,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      toast.success("Workout saved");
      // Replace so back from the detail page doesn't land in the edit form.
      navigate({
        to: "/workouts/$workoutId",
        params: { workoutId },
        replace: true,
      });
    },
    onError: (e) => {
      toast.error(`Failed to save: ${e.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteWorkoutMutation, { id: workoutId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      toast.success("Workout deleted");
      // Replace — the workout no longer exists, so back must skip its edit page.
      navigate({ to: "/workouts", replace: true });
    },
    onError: (e) => {
      toast.error(`Failed to delete: ${e.message}`);
    },
  });

  function renderContent() {
    if (isLoading) {
      return <EditSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!workout || !initialValues) {
      return <p className="text-sm text-muted-foreground">Workout not found.</p>;
    }
    if (!isOwner) {
      // Redirect is queued in the effect; show a blank-ish state to avoid a flash.
      return null;
    }
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl tracking-tight">{workout.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkoutForm
            initialValues={initialValues}
            submitLabel="Save changes"
            isSubmitting={saveMutation.isPending}
            labelSuggestions={data?.labels ?? []}
            onSubmit={(values) => saveMutation.mutate(values)}
            onCancel={() =>
              navigate({ to: "/workouts/$workoutId", params: { workoutId }, replace: true })
            }
            extraActions={
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMutation.isPending || saveMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete workout
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Edit</p>
        {renderContent()}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>
              {workout?.name
                ? `"${workout.name}" and its exercise list will be removed.`
                : "This will remove the workout and its exercise list."}{" "}
              Past sessions you've logged with it stay intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete workout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EditSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
