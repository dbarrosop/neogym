import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { FoodForm, type FoodFormValues } from "@/components/food-form";
import type { FoodPickerOption } from "@/components/food-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { normalizeMacros } from "@/lib/nutrition";

const InlineCreateFoodMutation = graphql(`
  mutation InlineCreateFood($object: foods_insert_input!) {
    insertFood(object: $object) {
      id
      name
      userId
      isPublic
      kcalPer100g
      fatPer100g
      carbsPer100g
      proteinPer100g
      fiberPer100g
      sugarPer100g
    }
  }
`);

const InlineSaveFoodMutation = graphql(`
  mutation InlineSaveFood($id: uuid!, $set: foods_set_input!) {
    updateFood(pk_columns: { id: $id }, _set: $set) {
      id
      name
      userId
      isPublic
      kcalPer100g
      fatPer100g
      carbsPer100g
      proteinPer100g
      fiberPer100g
      sugarPer100g
    }
  }
`);

export const EMPTY_FOOD_VALUES: FoodFormValues = {
  name: "",
  kcalPer100g: 0,
  fatPer100g: 0,
  carbsPer100g: 0,
  proteinPer100g: 0,
  fiberPer100g: 0,
  sugarPer100g: 0,
};

type QuickFoodDialogMode = { kind: "create" } | { kind: "edit"; food: FoodPickerOption };

interface QuickFoodDialogProps {
  open: boolean;
  mode: QuickFoodDialogMode;
  onOpenChange: (open: boolean) => void;
  onSaved: (food: FoodPickerOption) => void;
}

export function isEditablePrivateFood(food: FoodPickerOption | null | undefined): boolean {
  return Boolean(food && !food.isPublic);
}

export function foodFormValuesFromOption(food: FoodPickerOption): FoodFormValues {
  return {
    name: food.name,
    ...normalizeMacros(food),
  };
}

function valuesToFoodInput(values: FoodFormValues) {
  return {
    name: values.name,
    kcalPer100g: values.kcalPer100g,
    fatPer100g: values.fatPer100g,
    carbsPer100g: values.carbsPer100g,
    proteinPer100g: values.proteinPer100g,
    fiberPer100g: values.fiberPer100g,
    sugarPer100g: values.sugarPer100g,
  };
}

export function QuickFoodDialog({ open, mode, onOpenChange, onSaved }: QuickFoodDialogProps) {
  const queryClient = useQueryClient();
  const isCreate = mode.kind === "create";
  const canSubmit = isCreate || isEditablePrivateFood(mode.food);
  const initialValues = useMemo(
    () => (mode.kind === "edit" ? foodFormValuesFromOption(mode.food) : EMPTY_FOOD_VALUES),
    [mode],
  );

  async function invalidateNutritionFoodConsumers() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["nutrition", "foods"] }),
      queryClient.invalidateQueries({ queryKey: ["nutrition", "meals"] }),
      queryClient.invalidateQueries({ queryKey: ["nutrition", "plans"] }),
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days"] }),
      queryClient.invalidateQueries({ queryKey: ["nutrition", "plan-form", "pickers"] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (values: FoodFormValues) =>
      gqlRequest(InlineCreateFoodMutation, { object: valuesToFoodInput(values) }),
    onSuccess: async (data) => {
      const food = data.insertFood;
      if (!food) {
        toast.error("Food was created, but the new row was not returned.");
        return;
      }
      onSaved(food);
      toast.success("Food created");
      onOpenChange(false);
      await invalidateNutritionFoodConsumers();
    },
    onError: (error) => {
      toast.error(`Failed to create food: ${error.message}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: FoodFormValues) => {
      if (mode.kind !== "edit") {
        throw new Error("No food selected for editing.");
      }
      return gqlRequest(InlineSaveFoodMutation, {
        id: mode.food.id,
        set: valuesToFoodInput(values),
      });
    },
    onSuccess: async (data) => {
      const food = data.updateFood;
      if (!food) {
        toast.error("Food was saved, but the updated row was not returned.");
        return;
      }
      onSaved(food);
      toast.success("Food saved");
      onOpenChange(false);
      await invalidateNutritionFoodConsumers();
    },
    onError: (error) => {
      toast.error(`Failed to save food: ${error.message}`);
    },
  });

  const isSubmitting = createMutation.isPending || saveMutation.isPending;
  const title = isCreate ? "Create private food" : `Edit ${mode.food.name}`;
  const description = isCreate
    ? "Add a private food without leaving the current meal or plan draft."
    : "Update this private food's live nutrition values. Existing logs keep their snapshots.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {canSubmit ? (
          <FoodForm
            initialValues={initialValues}
            submitLabel={isCreate ? "Create food" : "Save food"}
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
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Public foods are read-only here. Create a new private food if you need a custom
              variant.
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
