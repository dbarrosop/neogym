import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { MealForm, type MealFormValues } from "@/components/meal-form";
import type { MealPickerOption } from "@/components/meal-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { normalizeNumeric } from "@/lib/nutrition";

const InlineCreateMealMutation = graphql(`
  mutation InlineCreateMeal($object: meals_insert_input!) {
    insertMeal(object: $object) {
      id
      name
      description
      mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
        id
        grams
        position
        food {
          id
          name
          kcalPer100g
          fatPer100g
          carbsPer100g
          proteinPer100g
          fiberPer100g
          sugarPer100g
        }
      }
    }
  }
`);

const InlineSaveMealMutation = graphql(`
  mutation InlineSaveMeal(
    $id: uuid!
    $set: meals_set_input!
    $deleteIngredientIds: [uuid!]!
    $hasDeleteIngredients: Boolean!
    $insertIngredients: [mealIngredients_insert_input!]!
    $hasInsertIngredients: Boolean!
    $ingredientUpdates: [mealIngredients_updates!]!
    $hasIngredientUpdates: Boolean!
  ) {
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
    updateMeal(pk_columns: { id: $id }, _set: $set) {
      id
      name
      description
      mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
        id
        grams
        position
        food {
          id
          name
          kcalPer100g
          fatPer100g
          carbsPer100g
          proteinPer100g
          fiberPer100g
          sugarPer100g
        }
      }
    }
  }
`);

export const EMPTY_MEAL_VALUES: MealFormValues = {
  name: "",
  description: "",
  ingredients: [],
};

type QuickMealDialogMode = { kind: "create" } | { kind: "edit"; meal: MealPickerOption };

interface QuickMealDialogProps {
  open: boolean;
  mode: QuickMealDialogMode;
  onOpenChange: (open: boolean) => void;
  onSaved: (meal: MealPickerOption) => void;
}

type MealIngredientInput = {
  foodId: string;
  grams: number;
  position: number;
};

type MealIngredientInsertInput = MealIngredientInput & {
  mealId: string;
};

type MealIngredientUpdateInput = {
  where: { id: { _eq: string } };
  _set: { grams: number; position: number };
};

export function mealFormValuesFromOption(meal: MealPickerOption): MealFormValues {
  return {
    name: meal.name,
    description: meal.description ?? "",
    ingredients: meal.mealIngredients.map((ingredient) => ({
      id: ingredient.id,
      foodId: ingredient.food.id,
      grams: normalizeNumeric(ingredient.grams),
      position: ingredient.position,
    })),
  };
}

function valuesToMealInput(values: MealFormValues) {
  return {
    name: values.name,
    description: values.description === "" ? null : values.description,
  };
}

function nestedIngredientInsertData(values: MealFormValues): MealIngredientInput[] {
  return values.ingredients.map((ingredient) => ({
    foodId: ingredient.foodId,
    grams: ingredient.grams,
    position: ingredient.position,
  }));
}

function buildInlineMealSaveVariables(
  mealId: string,
  initialValues: MealFormValues,
  nextValues: MealFormValues,
) {
  const existingById = new Map(
    initialValues.ingredients
      .filter((ingredient): ingredient is typeof ingredient & { id: string } =>
        Boolean(ingredient.id),
      )
      .map((ingredient) => [ingredient.id, ingredient]),
  );
  const preservedIds = new Set<string>();
  const insertIngredients: MealIngredientInsertInput[] = [];
  const ingredientUpdates: MealIngredientUpdateInput[] = [];

  for (const ingredient of nextValues.ingredients) {
    const existing = ingredient.id ? existingById.get(ingredient.id) : null;
    if (existing?.id && existing.foodId === ingredient.foodId) {
      preservedIds.add(existing.id);
      ingredientUpdates.push({
        where: { id: { _eq: existing.id } },
        _set: { grams: ingredient.grams, position: ingredient.position },
      });
      continue;
    }
    insertIngredients.push({
      mealId,
      foodId: ingredient.foodId,
      grams: ingredient.grams,
      position: ingredient.position,
    });
  }

  const deleteIngredientIds = Array.from(existingById.keys()).filter((id) => !preservedIds.has(id));

  return {
    deleteIngredientIds,
    hasDeleteIngredients: deleteIngredientIds.length > 0,
    insertIngredients,
    hasInsertIngredients: insertIngredients.length > 0,
    ingredientUpdates,
    hasIngredientUpdates: ingredientUpdates.length > 0,
  };
}

export const __testing = {
  buildInlineMealSaveVariables,
  mealFormValuesFromOption,
};

export function QuickMealDialog({ open, mode, onOpenChange, onSaved }: QuickMealDialogProps) {
  const queryClient = useQueryClient();
  const isCreate = mode.kind === "create";
  const initialValues = useMemo(
    () => (mode.kind === "edit" ? mealFormValuesFromOption(mode.meal) : EMPTY_MEAL_VALUES),
    [mode],
  );

  async function invalidateNutritionMealConsumers() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["nutrition", "meals"] }),
      queryClient.invalidateQueries({ queryKey: ["nutrition", "plans"] }),
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days"] }),
      queryClient.invalidateQueries({ queryKey: ["nutrition", "plan-form", "pickers"] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (values: MealFormValues) =>
      gqlRequest(InlineCreateMealMutation, {
        object: {
          ...valuesToMealInput(values),
          mealIngredients: {
            data: nestedIngredientInsertData(values),
          },
        },
      }),
    onSuccess: async (data) => {
      const meal = data.insertMeal;
      if (!meal) {
        toast.error("Meal was created, but the new row was not returned.");
        return;
      }
      onSaved(meal);
      toast.success("Meal created");
      onOpenChange(false);
      await invalidateNutritionMealConsumers();
    },
    onError: (error) => {
      toast.error(`Failed to create meal: ${error.message}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: MealFormValues) => {
      if (mode.kind !== "edit") {
        throw new Error("No meal selected for editing.");
      }
      const diff = buildInlineMealSaveVariables(mode.meal.id, initialValues, values);
      return gqlRequest(InlineSaveMealMutation, {
        id: mode.meal.id,
        set: valuesToMealInput(values),
        ...diff,
      });
    },
    onSuccess: async (data) => {
      const meal = data.updateMeal;
      if (!meal) {
        toast.error("Meal was saved, but the updated row was not returned.");
        return;
      }
      onSaved(meal);
      toast.success("Meal saved");
      onOpenChange(false);
      await invalidateNutritionMealConsumers();
    },
    onError: (error) => {
      toast.error(`Failed to save meal: ${error.message}`);
    },
  });

  const isSubmitting = createMutation.isPending || saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create meal" : `Edit ${mode.meal.name}`}</DialogTitle>
          <DialogDescription>
            Build or adjust a private meal template without leaving the plan draft. Ingredients keep
            their add, reorder, remove, and live-total behavior.
          </DialogDescription>
        </DialogHeader>
        <MealForm
          initialValues={initialValues}
          submitLabel={isCreate ? "Create meal" : "Save meal"}
          isSubmitting={isSubmitting}
          onSubmit={(values) => {
            if (isCreate) {
              createMutation.mutate(values);
            } else {
              saveMutation.mutate(values);
            }
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
