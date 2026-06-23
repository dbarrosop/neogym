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

const MACRO_LABELS: Record<keyof NormalizedMacros, string> = {
  kcalPer100g: "kcal",
  fatPer100g: "fat",
  carbsPer100g: "carbs",
  proteinPer100g: "protein",
  fiberPer100g: "fiber",
  sugarPer100g: "sugar",
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
