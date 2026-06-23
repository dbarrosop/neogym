import type { MacroTotals } from "@/lib/nutrition";
import { formatMacro, macroTotalsSummary } from "@/lib/nutrition";

interface MacroSummaryProps {
  totals: MacroTotals;
  title?: string;
  description?: string;
  compact?: boolean;
}

const MACRO_TILES = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
] as const;

export function MacroSummary({
  totals,
  title = "Totals",
  description,
  compact = false,
}: MacroSummaryProps) {
  if (compact) {
    return <p className="text-xs text-muted-foreground">{macroTotalsSummary(totals)}</p>;
  }

  return (
    <section className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MACRO_TILES.map((tile) => (
          <div
            key={tile.key}
            className="rounded-md border border-border/60 bg-background/70 px-3 py-2"
          >
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="font-medium tabular-nums">{formatMacro(totals[tile.key], tile.unit)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
