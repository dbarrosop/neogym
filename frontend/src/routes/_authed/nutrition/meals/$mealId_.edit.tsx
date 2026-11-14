import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MealForm, type MealFormValues } from "@/components/meal-form";
import { LibraryDetailSkeleton } from "@/components/nutrition-library";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { DangerZone, FormPage } from "@/components/patterns/form-page";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { buildMealIngredientDiff, mealDeleteBlockedReason } from "@/lib/meal-template";
import { isMealInUseByPlanError, normalizeNumeric } from "@/lib/nutrition";

const EditMealQuery = graphql(`
  query EditMeal($id: uuid!) {
    meal(id: $id) {
      id
      name
      description
      mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
        id
        foodId
        grams
        position
      }
      nutritionPlanMeals(order_by: [{ nutritionPlan: { name: asc } }, { id: asc }]) {
        id
        nutritionPlan {
          id
          name
        }
      }
    }
  }
`);

const SaveMealMutation = graphql(`
  mutation SaveMeal(
    $id: uuid!
    $set: meals_set_input!
    $deleteIngredientIds: [uuid!]!
    $hasDeleteIngredients: Boolean!
    $insertIngredients: [mealIngredients_insert_input!]!
    $hasInsertIngredients: Boolean!
    $ingredientUpdates: [mealIngredients_updates!]!
    $hasIngredientUpdates: Boolean!
  ) {
    updateMeal(pk_columns: { id: $id }, _set: $set) {
      id
    }
    deleteMealIngredients(where: { id: { _in: $deleteIngredientIds } })
      @include(if: $hasDeleteIngredients) {
      affected_rows
    }
    insertMealIngredients(objects: $insertIngredients) @include(if: $hasInsertIngredients) {
      affected_rows
    }
    update_mealIngredients_many(updates: $ingredientUpdates) @include(if: $hasIngredientUpdates) {
      affected_rows
    }
  }
`);

const DeleteMealMutation = graphql(`
  mutation DeleteMeal($id: uuid!) {
    deleteMeal(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/nutrition/meals/$mealId_/edit")({
  component: EditMealRoute,
});

function EditMealRoute() {
  const { mealId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nutrition", "meals", "edit", mealId],
    queryFn: () => gqlRequest(EditMealQuery, { id: mealId }),
    // Plan edits don't invalidate meals; re-check the plans that block delete on every visit.
    refetchOnMount: "always",
  });

  const meal = data?.meal ?? null;
  const initialValues = useMemo<MealFormValues | null>(() => {
    if (!meal) {
      return null;
    }
    return {
      name: meal.name,
      description: meal.description ?? "",
      ingredients: meal.mealIngredients.map((ingredient) => ({
        id: ingredient.id,
        foodId: ingredient.foodId,
        grams: normalizeNumeric(ingredient.grams),
        position: ingredient.position,
      })),
    };
  }, [meal]);

  const saveMutation = useMutation({
    mutationFn: (values: MealFormValues) =>
      gqlRequest(SaveMealMutation, {
        id: mealId,
        set: {
          name: values.name,
          description: values.description === "" ? null : values.description,
        },
        ...buildMealIngredientDiff(mealId, initialValues?.ingredients ?? [], values.ingredients),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "meals"] });
      toast.success("Meal saved");
      navigate({ to: "/nutrition/meals/$mealId", params: { mealId }, replace: true });
    },
    onError: (error) => {
      toast.error(`Failed to save meal: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteMealMutation, { id: mealId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "meals"] });
      toast.success("Meal deleted");
      navigate({ to: "/nutrition/meals", replace: true });
    },
    onError: (error) => {
      setConfirmDelete(false);
      if (isMealInUseByPlanError(error)) {
        // A plan started using it since this page loaded: show which one.
        void refetch();
        toast.error("This meal is used by a nutrition plan. Remove it there first.");
        return;
      }
      toast.error(`Failed to delete meal: ${error.message}`);
    },
  });

  const deleteBlockedReason = meal ? mealDeleteBlockedReason(meal.nutritionPlanMeals) : null;

  function renderContent() {
    if (isLoading) {
      return (
        <PageShell maxWidth="2xl">
          <LibraryDetailSkeleton />
        </PageShell>
      );
    }
    if (error) {
      return (
        <PageShell maxWidth="2xl">
          <ErrorState
            title="Couldn’t load this meal"
            message={error.message}
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        </PageShell>
      );
    }
    if (!meal || !initialValues) {
      return (
        <PageShell maxWidth="2xl">
          <EmptyState title="Meal not found" description="It may have been deleted." />
        </PageShell>
      );
    }
    return (
      <FormPage
        title="Edit meal"
        width="split"
        layout="sections"
        danger={
          <DangerZone
            title="Delete this meal"
            description={deleteBlockedReason ?? "Days already logged keep their snapshot."}
            actionLabel="Delete meal"
            onAction={() => setConfirmDelete(true)}
            disabled={
              deleteBlockedReason !== null || deleteMutation.isPending || saveMutation.isPending
            }
          />
        }
      >
        <MealForm
          initialValues={initialValues}
          submitLabel="Save"
          isSubmitting={saveMutation.isPending}
          onSubmit={(values) => saveMutation.mutate(values)}
          onCancel={() =>
            navigate({ to: "/nutrition/meals/$mealId", params: { mealId }, replace: true })
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
        title={meal ? `Delete ${meal.name}?` : "Delete this meal?"}
        description="This meal template will be deleted. Days already logged keep their snapshot. This can't be undone."
        confirmLabel="Delete meal"
        pendingLabel="Deleting…"
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
        destructive={true}
      />
    </>
  );
}
