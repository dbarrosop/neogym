import { formatKcal } from "@/lib/metric-format";
import { type MacroFields, macrosForGrams, parseMacroInput } from "@/lib/nutrition";

/**
 * Kilocalories of one meal ingredient row from its food's per-100 g values,
 * or null while the row has no food or its grams don't parse.
 */
export function ingredientKcal(
  food: MacroFields | null | undefined,
  grams: string | number,
): number | null {
  if (!food) {
    return null;
  }
  const parsed = typeof grams === "number" ? grams : parseMacroInput(grams);
  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return macrosForGrams(food, parsed).kcal;
}

/** The meal editor's per-row value: "146 kcal", or "—" while the row is incomplete. */
export function formatIngredientKcal(
  food: MacroFields | null | undefined,
  grams: string | number,
): string {
  const kcal = ingredientKcal(food, grams);
  return kcal === null ? "—" : formatKcal(kcal);
}

export interface MealPlanReference {
  nutritionPlan: { id: string; name: string } | null;
}

/**
 * Plans that use a meal, once each, sorted like iOS `Meal.usedInPlanNames`
 * (`localizedStandardCompare`: case-insensitive, numbers by value).
 */
export function mealPlanNames(references: readonly MealPlanReference[]): string[] {
  const names = new Map<string, string>();
  for (const reference of references) {
    const plan = reference.nutritionPlan;
    if (plan && !names.has(plan.id)) {
      names.set(plan.id, plan.name);
    }
  }
  return [...names.values()].toSorted((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }),
  );
}

/**
 * Why a meal can't be deleted yet: plan slots reference it with
 * `ON DELETE RESTRICT`. Null when no plan uses it.
 * "Used in 2 plans (Cut, Maintenance ~2200). Remove it there first."
 */
export function mealDeleteBlockedReason(references: readonly MealPlanReference[]): string | null {
  const names = mealPlanNames(references);
  if (names.length === 0) {
    return null;
  }
  const noun = names.length === 1 ? "plan" : "plans";
  return `Used in ${names.length} ${noun} (${names.join(", ")}). Remove it there first.`;
}

/**
 * Puts a just-created food into the first row that has no food yet, or
 * appends a new row for it, so "New private food" lands where it is expected.
 */
export function placeFoodInRows<T extends { foodId: string }>(
  rows: readonly T[],
  foodId: string,
  createRow: (foodId: string) => T,
): T[] {
  const emptyIndex = rows.findIndex((row) => !row.foodId);
  if (emptyIndex < 0) {
    return [...rows, createRow(foodId)];
  }
  return rows.map((row, index) => (index === emptyIndex ? { ...row, foodId } : row));
}

export interface MealIngredientValues {
  id?: string;
  foodId: string;
  grams: number;
  position: number;
}

export interface MealIngredientDiff {
  deleteIngredientIds: string[];
  hasDeleteIngredients: boolean;
  insertIngredients: { mealId: string; foodId: string; grams: number; position: number }[];
  hasInsertIngredients: boolean;
  ingredientUpdates: {
    where: { id: { _eq: string } };
    _set: { grams: number; position: number };
  }[];
  hasIngredientUpdates: boolean;
}

/**
 * Save variables for an edited meal's ingredients: rows that keep their food
 * are updated in place (grams and position), rows whose food changed are
 * deleted and re-inserted, and removed rows are deleted. Foods themselves are
 * never written.
 */
export function buildMealIngredientDiff(
  mealId: string,
  initial: readonly MealIngredientValues[],
  next: readonly MealIngredientValues[],
): MealIngredientDiff {
  const existingById = new Map(
    initial
      .filter((ingredient): ingredient is MealIngredientValues & { id: string } =>
        Boolean(ingredient.id),
      )
      .map((ingredient) => [ingredient.id, ingredient]),
  );
  const preservedIds = new Set<string>();
  const insertIngredients: MealIngredientDiff["insertIngredients"] = [];
  const ingredientUpdates: MealIngredientDiff["ingredientUpdates"] = [];

  for (const ingredient of next) {
    const existing = ingredient.id ? existingById.get(ingredient.id) : undefined;
    if (existing && existing.foodId === ingredient.foodId) {
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

  const deleteIngredientIds = [...existingById.keys()].filter((id) => !preservedIds.has(id));

  return {
    deleteIngredientIds,
    hasDeleteIngredients: deleteIngredientIds.length > 0,
    insertIngredients,
    hasInsertIngredients: insertIngredients.length > 0,
    ingredientUpdates,
    hasIngredientUpdates: ingredientUpdates.length > 0,
  };
}
