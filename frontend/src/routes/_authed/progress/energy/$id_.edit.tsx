import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DailyEnergyForm, type DailyEnergyFormValues } from "@/components/daily-energy-form";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { DangerZone, FormPage } from "@/components/patterns/form-page";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { dailyEnergyMutationErrorMessage } from "@/lib/daily-energy";
import { gqlRequest } from "@/lib/graphql";

const EditDailyEnergyQuery = graphql(`
  query EditDailyEnergy($id: uuid!) {
    dailyEnergyEntry(id: $id) {
      id
      energyOn
      activeKcal
      restingKcal
      notes
    }
  }
`);

const UpdateDailyEnergyMutation = graphql(`
  mutation UpdateDailyEnergy($id: uuid!, $set: dailyEnergy_set_input!) {
    updateDailyEnergyEntry(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`);

const DeleteDailyEnergyMutation = graphql(`
  mutation DeleteDailyEnergy($id: uuid!) {
    deleteDailyEnergyEntry(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/progress/energy/$id_/edit")({
  component: EditDailyEnergyRoute,
});

function EditDailyEnergyRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["daily_energy", id, "edit"],
    queryFn: () => gqlRequest(EditDailyEnergyQuery, { id }),
  });

  const entry = data?.dailyEnergyEntry ?? null;

  const initialValues = useMemo<DailyEnergyFormValues | null>(() => {
    if (!entry) {
      return null;
    }
    return {
      energyOn: entry.energyOn,
      activeKcal:
        entry.activeKcal !== null && entry.activeKcal !== undefined ? String(entry.activeKcal) : "",
      restingKcal:
        entry.restingKcal !== null && entry.restingKcal !== undefined
          ? String(entry.restingKcal)
          : "",
      notes: entry.notes ?? "",
    };
  }, [entry]);

  const saveMutation = useMutation({
    mutationFn: (values: DailyEnergyFormValues) =>
      gqlRequest(UpdateDailyEnergyMutation, {
        id,
        set: {
          energyOn: values.energyOn,
          activeKcal: values.activeKcal ? values.activeKcal : null,
          restingKcal: values.restingKcal ? values.restingKcal : null,
          notes: values.notes ? values.notes : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_energy"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "energy-projection"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      navigate({ to: "/progress/energy/$id", params: { id }, replace: true });
    },
    onError: (e) => {
      toast.error(dailyEnergyMutationErrorMessage(e, "save"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteDailyEnergyMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_energy"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "energy-projection"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      navigate({ to: "/progress/energy", replace: true });
    },
    onError: (e) => {
      toast.error(dailyEnergyMutationErrorMessage(e, "delete"));
    },
  });

  function renderContent() {
    if (isLoading) {
      return (
        <PageShell maxWidth="2xl">
          <EditSkeleton />
        </PageShell>
      );
    }
    if (error) {
      return (
        <PageShell maxWidth="2xl">
          <ErrorState title="Failed to load energy day" message={error.message} />
        </PageShell>
      );
    }
    if (!entry || !initialValues) {
      return (
        <PageShell maxWidth="2xl">
          <EmptyState title="Energy day not found." />
        </PageShell>
      );
    }
    return (
      <FormPage
        title="Edit energy day"
        width="2xl"
        danger={
          <DangerZone
            title="Delete this energy day"
            description="Removes it from your energy history and estimates."
            actionLabel="Delete energy day"
            onAction={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending || saveMutation.isPending}
          />
        }
      >
        <DailyEnergyForm
          initialValues={initialValues}
          submitLabel="Save changes"
          isSubmitting={saveMutation.isPending}
          onSubmit={(values) => saveMutation.mutate(values)}
          onCancel={() => navigate({ to: "/progress/energy/$id", params: { id }, replace: true })}
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
        title="Delete this energy day?"
        description="This entry will be removed from your energy history."
        confirmLabel="Delete energy day"
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
