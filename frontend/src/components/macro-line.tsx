import {
  formatMacroGrams,
  formatWholeGrams,
  type MacroGramsPrecision,
  type MacroTotals,
  macroLineLabel,
} from "@/lib/nutrition";
import { cn } from "@/lib/utils";

/**
 * Fill classes for the macro colour dots shared by slot lines, bars and
 * legends: protein uses the accent fill, carbs the Carbs colour, fat the
 * secondary text colour.
 */
export const MACRO_DOT_CLASS = {
  protein: "bg-primary",
  carbs: "bg-carbs",
  fat: "bg-muted-foreground",
} as const;

const MACROS = [
  { key: "protein", letter: "P" },
  { key: "carbs", letter: "C" },
  { key: "fat", letter: "F" },
] as const;

export interface MacroLineProps {
  totals: Pick<MacroTotals, "protein" | "carbs" | "fat">;
  /** Planned (not yet logged) slots show their values in the softer text colour. */
  dimmed?: boolean;
  /** "whole" (default) for slot and day totals; "tenths" for a single food row. */
  precision?: MacroGramsPrecision;
  className?: string;
}

/**
 * "● P 45 g ● C 106 g ● F 6 g" under a nutrition slot header (Log, Plan
 * detail). Screen readers get "Protein 45 grams, carbs 106 grams, fat 6
 * grams" instead of the letters and dots.
 */
export function MacroLine({
  totals,
  dimmed = false,
  precision = "whole",
  className,
}: MacroLineProps) {
  const format = precision === "whole" ? formatWholeGrams : formatMacroGrams;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground tabular-nums",
        className,
      )}
    >
      <span className="sr-only">{macroLineLabel(totals, precision)}</span>
      {MACROS.map((macro) => (
        <span key={macro.key} aria-hidden="true" className="inline-flex items-center gap-[5px]">
          <MacroDot macro={macro.key} />
          {macro.letter}{" "}
          <b className={cn("font-semibold", dimmed ? "text-soft-foreground" : "text-foreground")}>
            {format(totals[macro.key])}
          </b>{" "}
          g
        </span>
      ))}
    </div>
  );
}

/** A 7 px macro colour dot; decorative, so pair it with a text label. */
export function MacroDot({
  macro,
  className,
}: {
  macro: keyof typeof MACRO_DOT_CLASS;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-[7px] shrink-0 rounded-full", MACRO_DOT_CLASS[macro], className)}
    />
  );
}
