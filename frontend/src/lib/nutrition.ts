export interface MacroFields {
  kcalPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
  proteinPer100g: unknown;
  fiberPer100g: unknown;
  sugarPer100g: unknown;
}

export interface NormalizedMacros {
  kcalPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
}

export interface MacroTotals {
  kcal: number;
  fat: number;
  carbs: number;
  protein: number;
  fiber: number;
  sugar: number;
}

export interface MealTotalIngredient {
  grams: unknown;
  food?: MacroFields | null;
}

const MACRO_LABELS: Record<keyof NormalizedMacros, string> = {
  kcalPer100g: "kcal",
  fatPer100g: "fat",
  carbsPer100g: "carbs",
  proteinPer100g: "protein",
  fiberPer100g: "fiber",
  sugarPer100g: "sugar",
};

export const EMPTY_MACRO_TOTALS: MacroTotals = {
  kcal: 0,
  fat: 0,
  carbs: 0,
  protein: 0,
  fiber: 0,
  sugar: 0,
};

export function normalizeNumeric(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeMacros(input: MacroFields): NormalizedMacros {
  return {
    kcalPer100g: normalizeNumeric(input.kcalPer100g),
    fatPer100g: normalizeNumeric(input.fatPer100g),
    carbsPer100g: normalizeNumeric(input.carbsPer100g),
    proteinPer100g: normalizeNumeric(input.proteinPer100g),
    fiberPer100g: normalizeNumeric(input.fiberPer100g),
    sugarPer100g: normalizeNumeric(input.sugarPer100g),
  };
}

export function parseMacroInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function formatMacro(value: unknown, unit: "g" | "kcal"): string {
  const normalized = normalizeNumeric(value);
  const precision = Number.isInteger(normalized) ? 0 : 1;
  return `${normalized.toLocaleString(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  })} ${unit}`;
}

export function macrosForGrams(input: MacroFields, grams: unknown): MacroTotals {
  const macros = normalizeMacros(input);
  const multiplier = normalizeNumeric(grams) / 100;
  return {
    kcal: macros.kcalPer100g * multiplier,
    fat: macros.fatPer100g * multiplier,
    carbs: macros.carbsPer100g * multiplier,
    protein: macros.proteinPer100g * multiplier,
    fiber: macros.fiberPer100g * multiplier,
    sugar: macros.sugarPer100g * multiplier,
  };
}

export function addMacroTotals(left: MacroTotals, right: MacroTotals): MacroTotals {
  return {
    kcal: left.kcal + right.kcal,
    fat: left.fat + right.fat,
    carbs: left.carbs + right.carbs,
    protein: left.protein + right.protein,
    fiber: left.fiber + right.fiber,
    sugar: left.sugar + right.sugar,
  };
}

export function mealMacroTotals(ingredients: MealTotalIngredient[]): MacroTotals {
  return ingredients.reduce((total, ingredient) => {
    if (!ingredient.food) {
      return total;
    }
    return addMacroTotals(total, macrosForGrams(ingredient.food, ingredient.grams));
  }, EMPTY_MACRO_TOTALS);
}

export function macroTotalsSummary(totals: MacroTotals): string {
  return [
    formatMacro(totals.kcal, "kcal"),
    `${formatMacro(totals.fat, "g")} fat`,
    `${formatMacro(totals.carbs, "g")} carbs`,
    `${formatMacro(totals.protein, "g")} protein`,
    `${formatMacro(totals.fiber, "g")} fiber`,
    `${formatMacro(totals.sugar, "g")} sugar`,
  ].join(" · ");
}

export function macroSummary(input: MacroFields): string {
  const macros = normalizeMacros(input);
  return (Object.entries(macros) as [keyof NormalizedMacros, number][])
    .map(([key, value]) => {
      if (key === "kcalPer100g") {
        return formatMacro(value, "kcal");
      }
      return `${formatMacro(value, "g")} ${MACRO_LABELS[key]}`;
    })
    .join(" · ");
}

export function isFoodInUseError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("foreign key") ||
    message.includes("meal_ingredients") ||
    message.includes("nutrition_log_entries") ||
    message.includes("violates constraint")
  );
}

export function isMealInUseByPlanError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("foreign key") ||
    message.includes("nutrition_plan_meals") ||
    message.includes("violates constraint")
  );
}
