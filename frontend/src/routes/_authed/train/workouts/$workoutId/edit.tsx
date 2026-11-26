import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { DangerZone, FormPage } from "@/components/patterns/form-page";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutForm, type WorkoutFormValues } from "@/components/workout-form";
import { graphql } from "@/gql";
import { Labels_Constraint } from "@/gql/graphql";
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
          kind
          primaryMuscleGroup
          image1FileId
          strength { doubleWeight }
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
    $hasDeleteRows: Boolean!
    $insertRows: [workoutExercises_insert_input!]!
    $hasInsertRows: Boolean!
    $positionUpdates: [workoutExercises_updates!]!
    $hasPositionUpdates: Boolean!
    $deleteLabelIds: [uuid!]!
    $hasDeleteLabels: Boolean!
    $insertLabels: [workoutLabels_insert_input!]!
    $hasInsertLabels: Boolean!
  ) {
    updateWorkout(pk_columns: { id: $id }, _set: $set) {
      id
    }
    deleteWorkoutExercises(where: { id: { _in: $deleteRowIds } }) @include(if: $hasDeleteRows) {
      affected_rows
    }
    insertWorkoutExercises(objects: $insertRows) @include(if: $hasInsertRows) {
      affected_rows
    }
    update_workoutExercises_many(updates: $positionUpdates) @include(if: $hasPositionUpdates) {
      affected_rows
    }
    deleteWorkoutLabels(
      where: { workoutId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }
    ) @include(if: $hasDeleteLabels) {
      affected_rows
    }
    insertWorkoutLabels(
      objects: $insertLabels
      on_conflict: { constraint: workout_labels_pkey, update_columns: [] }
    ) @include(if: $hasInsertLabels) {
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

export const Route = createFileRoute("/_authed/train/workouts/$workoutId/edit")({
  component: EditWorkoutRoute,
});

function EditWorkoutRoute() {
  const { workoutId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["workouts", "edit", workoutId],
    queryFn: () => gqlRequest(EditWorkoutQuery, { id: workoutId }),
  });

  const workout = data?.workout ?? null;
  const isOwner = Boolean(user && workout && workout.userId === user.id && !workout.isPublic);

  // Public/non-owned workouts can't be edited via Hasura — bounce out instead of
  // letting the user fill in a form that will fail on submit.
  useEffect(() => {
    if (!isLoading && workout && !isOwner) {
      navigate({
        to: "/train/workouts/$workoutId",
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
        kind: we.exercise.kind ?? "strength",
        primaryMuscleGroup: we.exercise.primaryMuscleGroup,
        doubleWeight: we.exercise.strength?.doubleWeight ?? false,
        image1FileId: we.exercise.image1FileId ?? null,
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
          l.id
            ? { workoutId, labelId: l.id }
            : {
                workoutId,
                label: {
                  data: { name: l.name },
                  on_conflict: {
                    constraint: Labels_Constraint.LabelsUserNameKey,
                    update_columns: [],
                  },
                },
              },
        );

      return gqlRequest(SaveWorkoutMutation, {
        id: workoutId,
        set: {
          name: values.name,
          description: values.description || null,
        },
        deleteRowIds,
        hasDeleteRows: deleteRowIds.length > 0,
        insertRows,
        hasInsertRows: insertRows.length > 0,
        positionUpdates,
        hasPositionUpdates: positionUpdates.length > 0,
        deleteLabelIds,
        hasDeleteLabels: deleteLabelIds.length > 0,
        insertLabels,
        hasInsertLabels: insertLabels.length > 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      // Replace so back from the detail page doesn't land in the edit form.
      navigate({
        to: "/train/workouts/$workoutId",
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
      // Replace — the workout no longer exists, so back must skip its edit page.
      navigate({ to: "/train/workouts", replace: true });
    },
    onError: (e) => {
      toast.error(`Failed to delete: ${e.message}`);
    },
  });

  function renderContent() {
    if (isLoading) {
      return (
        <PageShell maxWidth="4xl">
          <EditSkeleton />
        </PageShell>
      );
    }
    if (error) {
      return (
        <PageShell maxWidth="4xl">
          <ErrorState
            title="Couldn't load this workout"
            message={error.message}
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        </PageShell>
      );
    }
    if (!workout || !initialValues) {
      return (
        <PageShell maxWidth="4xl">
          <EmptyState
            title="Workout not found"
            description="It may have been deleted or is not shared with you."
          />
        </PageShell>
      );
    }
    if (!isOwner) {
      // Redirect is queued in the effect; show a blank-ish state to avoid a flash.
      return null;
    }
    return (
      <FormPage
        title="Edit workout"
        width="wide"
        layout="sections"
        danger={
          <DangerZone
            title="Delete this workout"
            description="Sessions started from it stay in your history as ad-hoc sessions."
            actionLabel="Delete workout"
            onAction={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending || saveMutation.isPending}
          />
        }
      >
        <WorkoutForm
          initialValues={initialValues}
          submitLabel="Save"
          isSubmitting={saveMutation.isPending}
          labelSuggestions={data?.labels ?? []}
          onSubmit={(values) => saveMutation.mutate(values)}
          onCancel={() =>
            navigate({ to: "/train/workouts/$workoutId", params: { workoutId }, replace: true })
          }
        />
      </FormPage>
    );
  }

  return (
    <>
      {renderContent()}

      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={workout?.name ? `Delete ${workout.name}?` : "Delete this workout?"}
        description="Its exercise list is removed. Sessions started from it stay in your history as ad-hoc sessions. This can't be undone."
        confirmLabel="Delete workout"
        pendingLabel="Deleting…"
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}

function EditSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading">
      <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full sm:col-span-2" />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
