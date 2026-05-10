import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BodyMeasurementForm,
  type BodyMeasurementFormValues,
} from "@/components/body-measurement-form";
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
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

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

export const Route = createFileRoute("/_authed/body/$id_/edit")({
  component: EditBodyMeasurementRoute,
});

function EditBodyMeasurementRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
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
      gqlRequest(UpdateBodyMeasurementMutation, {
        id,
        set: {
          measuredOn: values.measuredOn,
          weightKg: values.weightKg ? values.weightKg : null,
          bodyFatPct: values.bodyFatPct ? values.bodyFatPct : null,
          notes: values.notes ? values.notes : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body_measurements"] });
      navigate({ to: "/body/$id", params: { id }, replace: true });
    },
    onError: (e) => {
      toast.error(`Failed to save: ${e.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteBodyMeasurementMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body_measurements"] });
      navigate({ to: "/body", replace: true });
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
    if (!measurement || !initialValues) {
      return <p className="text-sm text-muted-foreground">Measurement not found.</p>;
    }
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl tracking-tight">Edit measurement</CardTitle>
        </CardHeader>
        <CardContent>
          <BodyMeasurementForm
            initialValues={initialValues}
            submitLabel="Save changes"
            isSubmitting={saveMutation.isPending}
            onSubmit={(values) => saveMutation.mutate(values)}
            onCancel={() => navigate({ to: "/body/$id", params: { id }, replace: true })}
            extraActions={
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMutation.isPending || saveMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete measurement
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
            <DialogTitle>Delete this measurement?</DialogTitle>
            <DialogDescription>
              This entry will be removed from your body history.
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
              {deleteMutation.isPending ? "Deleting…" : "Delete measurement"}
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
      <CardHeader className="space-y-2">
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}
