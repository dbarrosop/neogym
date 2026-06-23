import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type SubmitEvent, useId, useMemo, useState } from "react";
import { FoodPicker, type FoodPickerOption } from "@/components/food-picker";
import { MacroSummary } from "@/components/macro-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { mealMacroTotals, normalizeNumeric, parseMacroInput } from "@/lib/nutrition";

const MealFormFoodsQuery = graphql(`
  query MealFormFoods {
    foods(order_by: [{ isPublic: asc }, { name: asc }]) {
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

export interface MealFormIngredientValues {
  id?: string;
  foodId: string;
  grams: number;
  position: number;
}

export interface MealFormValues {
  name: string;
  description: string;
  ingredients: MealFormIngredientValues[];
}

interface MealFormProps {
  initialValues: MealFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: MealFormValues) => void;
  onCancel: () => void;
  extraActions?: React.ReactNode;
}

type IngredientDraft = {
  clientId: string;
  id?: string;
  foodId: string;
  grams: string;
};

let nextIngredientId = 0;

function createClientId() {
  nextIngredientId += 1;
  return `ingredient-${Date.now()}-${nextIngredientId}`;
}

function numberToInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

export function MealForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  extraActions,
}: MealFormProps) {
  const nameId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    initialValues.ingredients
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((ingredient) => {
        const draft: IngredientDraft = {
          clientId: ingredient.id ?? createClientId(),
          foodId: ingredient.foodId,
          grams: numberToInput(ingredient.grams),
        };
        if (ingredient.id) {
          draft.id = ingredient.id;
        }
        return draft;
      }),
  );
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "foods", "picker"],
    queryFn: () => gqlRequest(MealFormFoodsQuery),
  });

  const foods = useMemo<FoodPickerOption[]>(() => data?.foods ?? [], [data]);
  const foodsById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);

  const totals = useMemo(
    () =>
      mealMacroTotals(
        ingredients.map((ingredient) => ({
          grams: ingredient.grams,
          food: foodsById.get(ingredient.foodId) ?? null,
        })),
      ),
    [foodsById, ingredients],
  );

  const parsedIngredients = useMemo(
    () =>
      ingredients.map((ingredient, index) => ({
        ...ingredient,
        parsedGrams: parseMacroInput(ingredient.grams),
        position: index,
      })),
    [ingredients],
  );

  const trimmedName = name.trim();
  const hasMissingFood = parsedIngredients.some(
    (ingredient) => !ingredient.foodId || !foodsById.has(ingredient.foodId),
  );
  const hasInvalidGrams = parsedIngredients.some(
    (ingredient) =>
      ingredient.parsedGrams === null || normalizeNumeric(ingredient.parsedGrams) <= 0,
  );
  const nameError = submitted && trimmedName.length === 0 ? "Name is required." : null;
  const ingredientsError =
    submitted && ingredients.length === 0 ? "Add at least one food to this meal." : null;
  const missingFoodError =
    submitted && hasMissingFood ? "Every ingredient needs a selected food." : null;
  const gramsError =
    submitted && hasInvalidGrams ? "Ingredient grams must be greater than zero." : null;
  const formError = nameError ?? ingredientsError ?? missingFoodError ?? gramsError ?? null;
  const canSubmit = !isSubmitting && !isLoading;

  function addIngredient() {
    const firstFood = foods[0];
    setIngredients((current) => [
      ...current,
      { clientId: createClientId(), foodId: firstFood?.id ?? "", grams: "100" },
    ]);
  }

  function updateIngredient(clientId: string, patch: Partial<IngredientDraft>) {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.clientId === clientId ? { ...ingredient, ...patch } : ingredient,
      ),
    );
  }

  function removeIngredient(clientId: string) {
    setIngredients((current) => current.filter((ingredient) => ingredient.clientId !== clientId));
  }

  function moveIngredient(clientId: string, direction: -1 | 1) {
    setIngredients((current) => {
      const index = current.findIndex((ingredient) => ingredient.clientId === clientId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = current.slice();
      const [item] = next.splice(index, 1);
      if (!item) {
        return current;
      }
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit || trimmedName.length === 0 || ingredients.length === 0) {
      return;
    }
    if (hasMissingFood || hasInvalidGrams) {
      return;
    }
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      ingredients: parsedIngredients.map((ingredient) => {
        const values: MealFormIngredientValues = {
          foodId: ingredient.foodId,
          grams: ingredient.parsedGrams ?? 0,
          position: ingredient.position,
        };
        if (ingredient.id) {
          values.id = ingredient.id;
        }
        return values;
      }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            Meal name
          </label>
          <Input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Breakfast bowl"
            maxLength={160}
            aria-invalid={Boolean(nameError)}
            aria-describedby={formError ? errorId : undefined}
            autoFocus
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={descriptionId} className="text-sm font-medium">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Prep notes, serving idea, or anything useful for reuse."
            maxLength={1000}
            rows={3}
          />
        </div>
      </div>

      <MacroSummary
        totals={totals}
        title="Live meal totals"
        description="Computed from current food nutrition values and ingredient grams."
      />

      <section className="space-y-3" aria-describedby={formError ? errorId : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Ingredients</h2>
            <p className="text-xs text-muted-foreground">
              Pick from your private foods and public foods. Use the arrows to keep stable order.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addIngredient}
            disabled={isLoading}
          >
            <Plus className="h-4 w-4" />
            Add food
          </Button>
        </div>

        {isLoading ? <MealFormSkeleton /> : null}
        {error ? (
          <p className="text-sm text-destructive">Failed to load foods: {error.message}</p>
        ) : null}

        {!isLoading && ingredients.length === 0 ? (
          <Card className="border-border/60 border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Add at least one food to define this meal template.
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => {
            const gramsId = `${ingredient.clientId}-grams`;
            return (
              <Card key={ingredient.clientId} className="border-border/60 bg-muted/20">
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Ingredient {index + 1}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => moveIngredient(ingredient.clientId, -1)}
                        disabled={index === 0 || isSubmitting}
                        aria-label="Move ingredient up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => moveIngredient(ingredient.clientId, 1)}
                        disabled={index === ingredients.length - 1 || isSubmitting}
                        aria-label="Move ingredient down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeIngredient(ingredient.clientId)}
                        disabled={isSubmitting}
                        aria-label="Remove ingredient"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <FoodPicker
                    foods={foods}
                    value={ingredient.foodId}
                    onChange={(foodId) => updateIngredient(ingredient.clientId, { foodId })}
                    disabled={isSubmitting}
                  />

                  <div className="space-y-1.5 sm:max-w-xs">
                    <label htmlFor={gramsId} className="text-sm font-medium">
                      Grams
                    </label>
                    <div className="relative">
                      <Input
                        id={gramsId}
                        type="number"
                        inputMode="decimal"
                        min="0.1"
                        step="0.1"
                        value={ingredient.grams}
                        onChange={(event) =>
                          updateIngredient(ingredient.clientId, { grams: event.target.value })
                        }
                        className="pr-10"
                        required
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                        g
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {formError ? (
          <p id={errorId} className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col-reverse gap-2 border-border/60 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>{extraActions}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function MealFormSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}
