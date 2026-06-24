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

export interface PlanTotalSlot {
  meal?: {
    mealIngredients: MealTotalIngredient[];
  } | null;
}

export interface LoggedSnapshotEntry {
  grams: unknown;
  snapshotKcalPer100g: unknown;
  snapshotFatPer100g: unknown;
  snapshotCarbsPer100g: unknown;
  snapshotProteinPer100g: unknown;
  snapshotFiberPer100g: unknown;
  snapshotSugarPer100g: unknown;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY_PATTERN = /^(\d{2}):(\d{2})/;

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

export const DECIMAL_INPUT_PATTERN = "[0-9]*[.,]?[0-9]*";

function normalizeDecimalInput(value: string): string {
  return value.trim().replace(",", ".");
}

export function normalizeNumeric(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(normalizeDecimalInput(value));
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
  const normalized = normalizeDecimalInput(value);
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
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

export function planMacroTotals(slots: PlanTotalSlot[]): MacroTotals {
  return slots.reduce((total, slot) => {
    if (!slot.meal) {
      return total;
    }
    return addMacroTotals(total, mealMacroTotals(slot.meal.mealIngredients));
  }, EMPTY_MACRO_TOTALS);
}

export function loggedEntryMacroTotals(entry: LoggedSnapshotEntry): MacroTotals {
  return macrosForGrams(
    {
      kcalPer100g: entry.snapshotKcalPer100g,
      fatPer100g: entry.snapshotFatPer100g,
      carbsPer100g: entry.snapshotCarbsPer100g,
      proteinPer100g: entry.snapshotProteinPer100g,
      fiberPer100g: entry.snapshotFiberPer100g,
      sugarPer100g: entry.snapshotSugarPer100g,
    },
    entry.grams,
  );
}

export function loggedMacroTotals(entries: LoggedSnapshotEntry[]): MacroTotals {
  return entries.reduce(
    (total, entry) => addMacroTotals(total, loggedEntryMacroTotals(entry)),
    EMPTY_MACRO_TOTALS,
  );
}

export function formatLocalDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentTimeInputValue(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function localDateToDate(value: string): Date | null {
  if (!isValidLocalDate(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function addLocalDateDays(value: string, days: number): string {
  const date = localDateToDate(value) ?? new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function formatLocalDateLabel(value: string): string {
  const date = localDateToDate(value);
  if (!date) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function timeToInputValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const match = TIME_OF_DAY_PATTERN.exec(value);
  if (!match) {
    return "";
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return "";
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return "";
  }
  return `${match[1]}:${match[2]}`;
}

export function formatTimeOfDay(value: unknown): string {
  const inputValue = timeToInputValue(value);
  if (!inputValue) {
    return "—";
  }
  const [hours = "0", minutes = "0"] = inputValue.split(":");
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
