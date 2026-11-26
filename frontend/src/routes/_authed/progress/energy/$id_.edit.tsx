import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DailyEnergyForm } from "@/components/daily-energy-form";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { DangerZone, FormPage } from "@/components/patterns/form-page";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import {
  type DailyEnergyFormValues,
  dailyEnergyInput,
  dailyEnergyMutationError,
} from "@/lib/daily-energy";
import { gqlRequest } from "@/lib/graphql";
import { useInvalidateDailyEnergy } from "@/lib/hooks/use-progress-entry-invalidation";

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
  const invalidate = useInvalidateDailyEnergy();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
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
      gqlRequest(UpdateDailyEnergyMutation, { id, set: dailyEnergyInput(values) }),
    onSuccess: () => {
      invalidate();
      navigate({ to: "/progress/energy/$id", params: { id }, replace: true });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteDailyEnergyMutation, { id }),
    onSuccess: () => {
      invalidate();
      navigate({ to: "/progress/energy", replace: true });
    },
    onError: (e) => {
      toast.error(dailyEnergyMutationError(e, "delete").message);
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
            title="Couldn't load this energy day"
            message={error.message}
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        </PageShell>
      );
    }
    if (!entry || !initialValues) {
      return (
        <PageShell contentClassName="max-w-[760px]">
          <EmptyState title="Energy day not found." />
        </PageShell>
      );
    }
    return (
      <FormPage
        title="Edit energy day"
        width="form"
        layout="sections"
        danger={
          <DangerZone
            title="Delete this energy day"
            description="Removes it from the Energy trend, Calories and Today."
            actionLabel="Delete energy day"
            onAction={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending || saveMutation.isPending}
          />
        }
      >
        <DailyEnergyForm
          initialValues={initialValues}
          submitLabel="Save"
          isSubmitting={saveMutation.isPending}
          serverError={
            saveMutation.error ? dailyEnergyMutationError(saveMutation.error, "save") : null
          }
          onEdit={() => {
            if (saveMutation.isError) {
              saveMutation.reset();
            }
          }}
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
        description="It will be removed from the Energy trend, Calories and Today. This can't be undone."
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
