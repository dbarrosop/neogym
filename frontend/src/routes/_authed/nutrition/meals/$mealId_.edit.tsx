import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MealForm, type MealFormValues } from "@/components/meal-form";
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
    }
  }
`);

const SaveMealMutation = graphql(`
  mutation SaveMeal(
    $id: uuid!
    $set: meals_set_input!
    $deleteIngredientIds: [uuid!]!
    $insertIngredients: [mealIngredients_insert_input!]!
    $ingredientUpdates: [mealIngredients_updates!]!
  ) {
    updateMeal(pk_columns: { id: $id }, _set: $set) {
      id
    }
    deleteMealIngredients(where: { id: { _in: $deleteIngredientIds } }) {
      affected_rows
    }
    insertMealIngredients(objects: $insertIngredients) {
      affected_rows
    }
    update_mealIngredients_many(updates: $ingredientUpdates) {
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

type MealIngredientInsertInput = {
  mealId: string;
  foodId: string;
  grams: number;
  position: number;
};

type MealIngredientUpdateInput = {
  where: { id: { _eq: string } };
  _set: { grams: number; position: number };
};

export const Route = createFileRoute("/_authed/nutrition/meals/$mealId_/edit")({
  component: EditMealRoute,
});

function EditMealRoute() {
  const { mealId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "meals", "edit", mealId],
    queryFn: () => gqlRequest(EditMealQuery, { id: mealId }),
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
    mutationFn: (values: MealFormValues) => {
      const existingById = new Map(
        (initialValues?.ingredients ?? [])
          .filter((ingredient) => ingredient.id)
          .map((ingredient) => [ingredient.id as string, ingredient]),
      );
      const preservedIds = new Set<string>();
      const insertIngredients: MealIngredientInsertInput[] = [];
      const ingredientUpdates: MealIngredientUpdateInput[] = [];

      for (const ingredient of values.ingredients) {
        const existing = ingredient.id ? existingById.get(ingredient.id) : null;
        if (existing?.id && existing.foodId === ingredient.foodId) {
          preservedIds.add(existing.id);
          ingredientUpdates.push({
            where: { id: { _eq: existing.id } },
            _set: { grams: ingredient.grams, position: ingredient.position },
          });
        } else {
          insertIngredients.push({
            mealId,
            foodId: ingredient.foodId,
            grams: ingredient.grams,
            position: ingredient.position,
          });
        }
      }

      const deleteIngredientIds = Array.from(existingById.keys()).filter(
        (id) => !preservedIds.has(id),
      );

      return gqlRequest(SaveMealMutation, {
        id: mealId,
        set: {
          name: values.name,
          description: values.description === "" ? null : values.description,
        },
        deleteIngredientIds,
        insertIngredients,
        ingredientUpdates,
      });
    },
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
      const message = isMealInUseByPlanError(error)
        ? "This meal is used by a nutrition plan. Remove it from plan slots before deleting it. Logged days do not block deletion."
        : `Failed to delete meal: ${error.message}`;
      toast.error(message);
    },
  });

  function renderContent() {
    if (isLoading) {
      return <EditMealSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!meal || !initialValues) {
      return <p className="text-sm text-muted-foreground">Meal not found.</p>;
    }
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Edit meal
          </p>
          <CardTitle className="text-2xl tracking-tight">{meal.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <MealForm
            initialValues={initialValues}
            submitLabel="Save changes"
            isSubmitting={saveMutation.isPending}
            onSubmit={(values) => saveMutation.mutate(values)}
            onCancel={() =>
              navigate({ to: "/nutrition/meals/$mealId", params: { mealId }, replace: true })
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
                Delete meal
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
            <DialogTitle>Delete this meal?</DialogTitle>
            <DialogDescription>
              {meal?.name
                ? `"${meal.name}" will be removed from your private meal templates.`
                : "This meal will be removed from your private meal templates."}{" "}
              Meal deletion is blocked while a nutrition plan slot references it. Historical logged
              meals keep their food snapshots and detach their template provenance instead of
              blocking deletion.
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
              {deleteMutation.isPending ? "Deleting…" : "Delete meal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditMealSkeleton() {
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
