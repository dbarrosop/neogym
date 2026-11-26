// Cell text for one food/meal row on the nutrition day log and plan detail
// (boards Web-NutritionDay, Web-PlanDetail): grams | P | C | F | kcal.

import { formatKcalNumber } from "@/lib/metric-format";
import { formatMacro, formatMacroGrams, type MacroTotals } from "@/lib/nutrition";

export interface MacroCell {
  /** Visible column letter. */
  letter: "P" | "C" | "F";
  /** Spoken name. */
  name: "protein" | "carbs" | "fat";
  /** Grams without the unit: one decimal below 10 g ("6.8", "0.5"), whole above ("45"). */
  value: string;
}

/** P, C and F cells of one row, in the board's column order. */
export function macroCells(totals: Pick<MacroTotals, "protein" | "carbs" | "fat">): MacroCell[] {
  return [
    { letter: "P", name: "protein", value: formatMacroGrams(totals.protein) },
    { letter: "C", name: "carbs", value: formatMacroGrams(totals.carbs) },
    { letter: "F", name: "fat", value: formatMacroGrams(totals.fat) },
  ];
}

/** "45 g", "12.5 g": the grams column. */
export function formatRowGrams(grams: unknown): string {
  return formatMacro(grams, "g");
}

/** "1,176": the kcal column's number (the unit is drawn separately). */
export function formatRowKcal(kcal: number): string {
  return formatKcalNumber(kcal);
}

/**
 * The slot header caption on the plan editor: "619 kcal · P 40" (whole
 * numbers, as on iOS slot headers).
 */
export function slotKcalProteinCaption(totals: Pick<MacroTotals, "kcal" | "protein">): string {
  return `${formatKcalNumber(totals.kcal)} kcal · P ${formatKcalNumber(totals.protein)}`;
}
