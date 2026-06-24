import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { NutritionPlanForm, type NutritionPlanFormValues } from "@/components/nutrition-plan-form";
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
import { timeToInputValue } from "@/lib/nutrition";

const EditNutritionPlanQuery = graphql(`
  query EditNutritionPlan($id: uuid!) {
    nutritionPlan(id: $id) {
      id
      name
      description
      nutritionPlanMeals(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
        id
        mealId
        slotTime
        label
        position
      }
    }
  }
`);

const SaveNutritionPlanMutation = graphql(`
  mutation SaveNutritionPlan(
    $id: uuid!
    $set: nutritionPlans_set_input!
    $deleteSlotIds: [uuid!]!
    $hasDeleteSlots: Boolean!
    $insertSlots: [nutritionPlanMeals_insert_input!]!
    $hasInsertSlots: Boolean!
    $slotUpdates: [nutritionPlanMeals_updates!]!
    $hasSlotUpdates: Boolean!
  ) {
    updateNutritionPlan(pk_columns: { id: $id }, _set: $set) {
      id
    }
    deleteNutritionPlanMeals(where: { id: { _in: $deleteSlotIds } })
      @include(if: $hasDeleteSlots) {
      affected_rows
    }
    insertNutritionPlanMeals(objects: $insertSlots) @include(if: $hasInsertSlots) {
      affected_rows
    }
    update_nutritionPlanMeals_many(updates: $slotUpdates) @include(if: $hasSlotUpdates) {
      affected_rows
    }
  }
`);

const DeleteNutritionPlanMutation = graphql(`
  mutation DeleteNutritionPlan($id: uuid!) {
    deleteNutritionPlan(id: $id) {
      id
    }
  }
`);

type NutritionPlanSlotInsertInput = {
  nutritionPlanId: string;
  mealId: string;
  slotTime: string;
  label: string | null;
  position: number;
};

type NutritionPlanSlotUpdateInput = {
  where: { id: { _eq: string } };
  _set: { slotTime: string; label: string | null; position: number };
};

export const Route = createFileRoute("/_authed/nutrition/plans/$planId_/edit")({
  component: EditNutritionPlanRoute,
});

function EditNutritionPlanRoute() {
  const { planId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "plans", "edit", planId],
    queryFn: () => gqlRequest(EditNutritionPlanQuery, { id: planId }),
  });

  const plan = data?.nutritionPlan ?? null;
  const initialValues = useMemo<NutritionPlanFormValues | null>(() => {
    if (!plan) {
      return null;
    }
    return {
      name: plan.name,
      description: plan.description ?? "",
      slots: plan.nutritionPlanMeals.map((slot) => ({
        id: slot.id,
        mealId: slot.mealId,
        slotTime: timeToInputValue(slot.slotTime),
        label: slot.label ?? "",
        position: slot.position,
      })),
    };
  }, [plan]);

  const saveMutation = useMutation({
    mutationFn: (values: NutritionPlanFormValues) => {
      const existingById = new Map(
        (initialValues?.slots ?? [])
          .filter((slot) => slot.id)
          .map((slot) => [slot.id as string, slot]),
      );
      const preservedIds = new Set<string>();
      const insertSlots: NutritionPlanSlotInsertInput[] = [];
      const slotUpdates: NutritionPlanSlotUpdateInput[] = [];

      for (const slot of values.slots) {
        const label = slot.label === "" ? null : slot.label;
        const existing = slot.id ? existingById.get(slot.id) : null;
        if (existing?.id && existing.mealId === slot.mealId) {
          preservedIds.add(existing.id);
          slotUpdates.push({
            where: { id: { _eq: existing.id } },
            _set: { slotTime: slot.slotTime, label, position: slot.position },
          });
        } else {
          insertSlots.push({
            nutritionPlanId: planId,
            mealId: slot.mealId,
            slotTime: slot.slotTime,
            label,
            position: slot.position,
          });
        }
      }

      const deleteSlotIds = Array.from(existingById.keys()).filter((id) => !preservedIds.has(id));

      return gqlRequest(SaveNutritionPlanMutation, {
        id: planId,
        set: {
          name: values.name,
          description: values.description === "" ? null : values.description,
        },
        deleteSlotIds,
        hasDeleteSlots: deleteSlotIds.length > 0,
        insertSlots,
        hasInsertSlots: insertSlots.length > 0,
        slotUpdates,
        hasSlotUpdates: slotUpdates.length > 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "plans"] });
      toast.success("Plan saved");
      navigate({ to: "/nutrition/plans/$planId", params: { planId }, replace: true });
    },
    onError: (error) => {
      toast.error(`Failed to save plan: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteNutritionPlanMutation, { id: planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "plans"] });
      toast.success("Plan deleted");
      navigate({ to: "/nutrition/plans", replace: true });
    },
    onError: (error) => {
      toast.error(`Failed to delete plan: ${error.message}`);
    },
  });

  function renderContent() {
    if (isLoading) {
      return <EditNutritionPlanSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!plan || !initialValues) {
      return <p className="text-sm text-muted-foreground">Plan not found.</p>;
    }
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Edit plan
          </p>
          <CardTitle className="text-2xl tracking-tight">{plan.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <NutritionPlanForm
            initialValues={initialValues}
            submitLabel="Save changes"
            isSubmitting={saveMutation.isPending}
            onSubmit={(values) => saveMutation.mutate(values)}
            onCancel={() =>
              navigate({ to: "/nutrition/plans/$planId", params: { planId }, replace: true })
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
                Delete plan
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {renderContent()}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this plan?</DialogTitle>
            <DialogDescription>
              {plan?.name
                ? `"${plan.name}" will be removed from your private daily plan templates.`
                : "This plan will be removed from your private daily plan templates."}{" "}
              Days that selected this plan are detached by the database; historical logs remain.
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
              {deleteMutation.isPending ? "Deleting…" : "Delete plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditNutritionPlanSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  );
}
