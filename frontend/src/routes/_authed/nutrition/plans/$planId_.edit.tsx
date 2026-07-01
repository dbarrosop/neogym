import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  NutritionPlanForm,
  type NutritionPlanFormEntryValues,
  type NutritionPlanFormValues,
} from "@/components/nutrition-plan-form";
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
import { mergePlanEntriesByTime, timeToInputValue } from "@/lib/nutrition";

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
      nutritionPlanFoods(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
        id
        foodId
        grams
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
    $deleteMealIds: [uuid!]!
    $hasDeleteMeals: Boolean!
    $deleteFoodIds: [uuid!]!
    $hasDeleteFoods: Boolean!
    $insertMeals: [nutritionPlanMeals_insert_input!]!
    $hasInsertMeals: Boolean!
    $insertFoods: [nutritionPlanFoods_insert_input!]!
    $hasInsertFoods: Boolean!
    $mealUpdates: [nutritionPlanMeals_updates!]!
    $hasMealUpdates: Boolean!
    $foodUpdates: [nutritionPlanFoods_updates!]!
    $hasFoodUpdates: Boolean!
  ) {
    updateNutritionPlan(pk_columns: { id: $id }, _set: $set) {
      id
    }
    deleteNutritionPlanMeals(where: { id: { _in: $deleteMealIds } })
      @include(if: $hasDeleteMeals) {
      affected_rows
    }
    deleteNutritionPlanFoods(where: { id: { _in: $deleteFoodIds } })
      @include(if: $hasDeleteFoods) {
      affected_rows
    }
    insertNutritionPlanMeals(objects: $insertMeals) @include(if: $hasInsertMeals) {
      affected_rows
    }
    insertNutritionPlanFoods(objects: $insertFoods) @include(if: $hasInsertFoods) {
      affected_rows
    }
    update_nutritionPlanMeals_many(updates: $mealUpdates) @include(if: $hasMealUpdates) {
      affected_rows
    }
    update_nutritionPlanFoods_many(updates: $foodUpdates) @include(if: $hasFoodUpdates) {
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

type MealEntryValues = Extract<NutritionPlanFormEntryValues, { kind: "meal" }>;
type FoodEntryValues = Extract<NutritionPlanFormEntryValues, { kind: "food" }>;

type NutritionPlanMealInsertInput = {
  nutritionPlanId: string;
  mealId: string;
  slotTime: string;
  label: string | null;
  position: number;
};

type NutritionPlanFoodInsertInput = {
  nutritionPlanId: string;
  foodId: string;
  grams: number;
  slotTime: string;
  label: string | null;
  position: number;
};

type NutritionPlanMealUpdateInput = {
  where: { id: { _eq: string } };
  _set: { slotTime: string; label: string | null; position: number };
};

type NutritionPlanFoodUpdateInput = {
  where: { id: { _eq: string } };
  _set: { grams: number; slotTime: string; label: string | null; position: number };
};

type NutritionPlanSaveDiff = {
  deleteMealIds: string[];
  deleteFoodIds: string[];
  insertMeals: NutritionPlanMealInsertInput[];
  insertFoods: NutritionPlanFoodInsertInput[];
  mealUpdates: NutritionPlanMealUpdateInput[];
  foodUpdates: NutritionPlanFoodUpdateInput[];
};

function entriesById<TEntry extends NutritionPlanFormEntryValues>(entries: TEntry[]) {
  return new Map(
    entries
      .filter((entry): entry is TEntry & { id: string } => Boolean(entry.id))
      .map((entry) => [entry.id, entry]),
  );
}

function buildNutritionPlanSaveDiff(
  planId: string,
  initialEntries: NutritionPlanFormEntryValues[],
  nextEntries: NutritionPlanFormEntryValues[],
): NutritionPlanSaveDiff {
  const existingMealsById = entriesById(
    initialEntries.filter((entry): entry is MealEntryValues => entry.kind === "meal"),
  );
  const existingFoodsById = entriesById(
    initialEntries.filter((entry): entry is FoodEntryValues => entry.kind === "food"),
  );
  const diff: NutritionPlanSaveDiff = {
    deleteMealIds: [],
    deleteFoodIds: [],
    insertMeals: [],
    insertFoods: [],
    mealUpdates: [],
    foodUpdates: [],
  };
  const preservedMealIds = new Set<string>();
  const preservedFoodIds = new Set<string>();

  for (const entry of nextEntries) {
    if (entry.kind === "meal") {
      upsertMealDiff(planId, entry, existingMealsById, preservedMealIds, diff);
    } else {
      upsertFoodDiff(planId, entry, existingFoodsById, preservedFoodIds, diff);
    }
  }

  diff.deleteMealIds = Array.from(existingMealsById.keys()).filter(
    (id) => !preservedMealIds.has(id),
  );
  diff.deleteFoodIds = Array.from(existingFoodsById.keys()).filter(
    (id) => !preservedFoodIds.has(id),
  );
  return diff;
}

function upsertMealDiff(
  planId: string,
  entry: MealEntryValues,
  existingById: Map<string, MealEntryValues>,
  preservedIds: Set<string>,
  diff: NutritionPlanSaveDiff,
) {
  const label = entry.label === "" ? null : entry.label;
  const existing = entry.id ? existingById.get(entry.id) : null;
  if (existing?.id && existing.mealId === entry.mealId) {
    preservedIds.add(existing.id);
    diff.mealUpdates.push({
      where: { id: { _eq: existing.id } },
      _set: { slotTime: entry.slotTime, label, position: entry.position },
    });
    return;
  }
  diff.insertMeals.push({
    nutritionPlanId: planId,
    mealId: entry.mealId,
    slotTime: entry.slotTime,
    label,
    position: entry.position,
  });
}

function upsertFoodDiff(
  planId: string,
  entry: FoodEntryValues,
  existingById: Map<string, FoodEntryValues>,
  preservedIds: Set<string>,
  diff: NutritionPlanSaveDiff,
) {
  const label = entry.label === "" ? null : entry.label;
  const existing = entry.id ? existingById.get(entry.id) : null;
  if (existing?.id && existing.foodId === entry.foodId) {
    preservedIds.add(existing.id);
    diff.foodUpdates.push({
      where: { id: { _eq: existing.id } },
      _set: { grams: entry.grams, slotTime: entry.slotTime, label, position: entry.position },
    });
    return;
  }
  diff.insertFoods.push({
    nutritionPlanId: planId,
    foodId: entry.foodId,
    grams: entry.grams,
    slotTime: entry.slotTime,
    label,
    position: entry.position,
  });
}

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
      entries: mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods).map(
        (entry) => {
          if (entry.kind === "meal") {
            return {
              kind: "meal" as const,
              id: entry.id,
              mealId: entry.mealId ?? "",
              slotTime: timeToInputValue(entry.slotTime),
              label: entry.label ?? "",
              position: entry.position,
            };
          }
          return {
            kind: "food" as const,
            id: entry.id,
            foodId: entry.foodId ?? "",
            grams: Number(entry.grams),
            slotTime: timeToInputValue(entry.slotTime),
            label: entry.label ?? "",
            position: entry.position,
          };
        },
      ),
    };
  }, [plan]);

  const saveMutation = useMutation({
    mutationFn: (values: NutritionPlanFormValues) => {
      const diff = buildNutritionPlanSaveDiff(planId, initialValues?.entries ?? [], values.entries);

      return gqlRequest(SaveNutritionPlanMutation, {
        id: planId,
        set: {
          name: values.name,
          description: values.description === "" ? null : values.description,
        },
        deleteMealIds: diff.deleteMealIds,
        hasDeleteMeals: diff.deleteMealIds.length > 0,
        deleteFoodIds: diff.deleteFoodIds,
        hasDeleteFoods: diff.deleteFoodIds.length > 0,
        insertMeals: diff.insertMeals,
        hasInsertMeals: diff.insertMeals.length > 0,
        insertFoods: diff.insertFoods,
        hasInsertFoods: diff.insertFoods.length > 0,
        mealUpdates: diff.mealUpdates,
        hasMealUpdates: diff.mealUpdates.length > 0,
        foodUpdates: diff.foodUpdates,
        hasFoodUpdates: diff.foodUpdates.length > 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "plans"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days"] });
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
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days"] });
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
