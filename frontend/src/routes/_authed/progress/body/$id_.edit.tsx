import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BodyMeasurementForm } from "@/components/body-measurement-form";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { DangerZone, FormPage } from "@/components/patterns/form-page";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import {
  type BodyMeasurementFormValues,
  bodyMeasurementInput,
  bodyMeasurementMutationError,
} from "@/lib/body-measurements";
import { gqlRequest } from "@/lib/graphql";
import { useInvalidateBodyMeasurements } from "@/lib/hooks/use-progress-entry-invalidation";

const EditBodyMeasurementQuery = graphql(`
  query EditBodyMeasurement($id: uuid!) {
    bodyMeasurement(id: $id) {
      id
      measuredOn
      weightKg
      bodyFatPct
      notes
    }
  }
`);

const UpdateBodyMeasurementMutation = graphql(`
  mutation UpdateBodyMeasurement($id: uuid!, $set: bodyMeasurements_set_input!) {
    updateBodyMeasurement(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`);

const DeleteBodyMeasurementMutation = graphql(`
  mutation DeleteBodyMeasurement($id: uuid!) {
    deleteBodyMeasurement(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/progress/body/$id_/edit")({
  component: EditBodyMeasurementRoute,
});

function EditBodyMeasurementRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidateBodyMeasurements();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["body_measurements", id, "edit"],
    queryFn: () => gqlRequest(EditBodyMeasurementQuery, { id }),
  });

  const measurement = data?.bodyMeasurement ?? null;

  const initialValues = useMemo<BodyMeasurementFormValues | null>(() => {
    if (!measurement) {
      return null;
    }
    return {
      measuredOn: measurement.measuredOn,
      weightKg:
        measurement.weightKg !== null && measurement.weightKg !== undefined
          ? String(measurement.weightKg)
          : "",
      bodyFatPct:
        measurement.bodyFatPct !== null && measurement.bodyFatPct !== undefined
          ? String(measurement.bodyFatPct)
          : "",
      notes: measurement.notes ?? "",
    };
  }, [measurement]);

  const saveMutation = useMutation({
    mutationFn: (values: BodyMeasurementFormValues) =>
      gqlRequest(UpdateBodyMeasurementMutation, { id, set: bodyMeasurementInput(values) }),
    onSuccess: () => {
      invalidate();
      navigate({ to: "/progress/body/$id", params: { id }, replace: true });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteBodyMeasurementMutation, { id }),
    onSuccess: () => {
      invalidate();
      navigate({ to: "/progress/body", replace: true });
    },
    onError: (e) => {
      toast.error(bodyMeasurementMutationError(e, "delete").message);
    },
  });

  function renderContent() {
    if (isLoading) {
      return (
        <PageShell contentClassName="max-w-[760px]">
          <EditSkeleton />
        </PageShell>
      );
    }
    if (error) {
      return (
        <PageShell contentClassName="max-w-[760px]">
          <ErrorState
            title="Couldn't load this measurement"
            message={error.message}
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        </PageShell>
      );
    }
    if (!measurement || !initialValues) {
      return (
        <PageShell contentClassName="max-w-[760px]">
          <EmptyState title="Measurement not found." />
        </PageShell>
      );
    }
    return (
      <FormPage
        title="Edit measurement"
        width="form"
        layout="sections"
        danger={
          <DangerZone
            title="Delete this measurement"
            description="Removes it from the Body trend and Today."
            actionLabel="Delete measurement"
            onAction={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending || saveMutation.isPending}
          />
        }
      >
        <BodyMeasurementForm
          initialValues={initialValues}
          submitLabel="Save"
          isSubmitting={saveMutation.isPending}
          serverError={
            saveMutation.error ? bodyMeasurementMutationError(saveMutation.error, "save") : null
          }
          onEdit={() => {
            if (saveMutation.isError) {
              saveMutation.reset();
            }
          }}
          onSubmit={(values) => saveMutation.mutate(values)}
          onCancel={() => navigate({ to: "/progress/body/$id", params: { id }, replace: true })}
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
        title="Delete this measurement?"
        description="It will be removed from the Body trend and Today. This can't be undone."
        confirmLabel="Delete measurement"
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
    <SkeletonState>
      <Card className="border-border/60">
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </SkeletonState>
  );
}
