import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DailyEnergyForm, type DailyEnergyFormValues } from "@/components/daily-energy-form";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { FormCardShell, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authed/energy/$id_/edit")({
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
      navigate({ to: "/energy/$id", params: { id }, replace: true });
    },
    onError: (e) => {
      toast.error(dailyEnergyMutationErrorMessage(e, "save"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteDailyEnergyMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_energy"] });
      navigate({ to: "/energy", replace: true });
    },
    onError: (e) => {
      toast.error(dailyEnergyMutationErrorMessage(e, "delete"));
    },
  });

  function renderContent() {
    if (isLoading) {
      return <EditSkeleton />;
    }
    if (error) {
      return <ErrorState title="Failed to load energy day" message={error.message} />;
    }
    if (!entry || !initialValues) {
      return <EmptyState title="Energy day not found." />;
    }
    return (
      <FormCardShell eyebrow="Edit" title="Edit energy day">
        <DailyEnergyForm
          initialValues={initialValues}
          submitLabel="Save changes"
          isSubmitting={saveMutation.isPending}
          onSubmit={(values) => saveMutation.mutate(values)}
          onCancel={() => navigate({ to: "/energy/$id", params: { id }, replace: true })}
          extraActions={
            <Button
              type="button"
              variant="ghost"
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteMutation.isPending || saveMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete energy day
            </Button>
          }
        />
      </FormCardShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
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
    </PageShell>
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
