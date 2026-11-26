import type { MacroTotals } from "@/lib/nutrition";
import { formatMacro, formatMacroGrams, macroTotalsSummary } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

interface MacroSummaryProps {
  totals: MacroTotals;
  title?: string;
  description?: string;
  compact?: boolean;
  targetTotals?: MacroTotals | null;
  /**
   * "tiles" (default): a card of six inset tiles. "aside": the editor side
   * panel (Web-MealEditor "Live meal totals"): caption, large kcal, then one
   * row per nutrient and `description` as the closing note. Ignored when
   * `compact` is set.
   */
  variant?: "tiles" | "aside";
  className?: string;
}

/** Same order as `NUTRIENT_FIELDS`: Energy, then P · C · F, then fiber and sugar. */
const MACRO_TILES = [
  { key: "kcal", label: "Energy", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
] as const;

function formatMacroNumber(value: number): string {
  const precision = Number.isInteger(value) ? 0 : 1;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  });
}

export function MacroSummary({
  totals,
  title,
  description,
  compact = false,
  targetTotals,
  variant = "tiles",
  className,
}: MacroSummaryProps) {
  if (!compact && variant === "aside") {
    return (
      <MacroSummaryAside
        totals={totals}
        title={title}
        description={description}
        className={className}
      />
    );
  }

  if (compact) {
    const summary = macroTotalsSummary(totals);

    if (!title && !description) {
      return <p className="text-xs text-muted-foreground">{summary}</p>;
    }

    return (
      <div className="space-y-1">
        {title ? <p className="text-xs font-medium text-foreground">{title}</p> : null}
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <p className="text-xs text-muted-foreground">{summary}</p>
      </div>
    );
  }

  return (
    <section className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{title ?? "Totals"}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MACRO_TILES.map((tile) => (
          <div key={tile.key} className="rounded-lg bg-surface-inset px-3 py-2">
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="font-medium tabular-nums">
              {targetTotals
                ? `${formatMacroNumber(totals[tile.key])} / ${formatMacroNumber(
                    targetTotals[tile.key],
                  )} ${tile.unit}`
                : formatMacro(totals[tile.key], tile.unit)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MacroSummaryAside({
  totals,
  title = "Totals",
  description,
  className,
}: {
  totals: MacroTotals;
  title?: string | undefined;
  description?: string | undefined;
  className?: string | undefined;
}) {
  const [energy, ...nutrients] = MACRO_TILES;
  return (
    <section
      aria-label={title}
      className={cn("flex flex-col gap-3 rounded-[14px] border bg-card p-5", className)}
    >
      <p className="text-[13px] text-muted-foreground">{title}</p>
      <p className="text-[30px] leading-tight font-bold tabular-nums">
        {formatMacroNumber(Math.round(totals[energy.key]))}{" "}
        <span className="text-sm font-medium text-muted-foreground">{energy.unit}</span>
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm tabular-nums">
        {nutrients.map((tile) => (
          <div key={tile.key} className="contents">
            <dt className="text-[13px] text-muted-foreground">{tile.label}</dt>
            <dd className="text-right font-semibold">{formatMacroGrams(totals[tile.key])} g</dd>
          </div>
        ))}
      </dl>
      {description ? (
        <p className="text-[13px] leading-normal text-muted-foreground">{description}</p>
      ) : null}
    </section>
  );
}
