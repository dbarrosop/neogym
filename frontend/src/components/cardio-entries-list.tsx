import { Check } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  type CardioMetrics,
  type CardioMetricsSchema,
  formatMetricValue,
  iterateMetrics,
} from "@/lib/cardio-schema";

interface CardioEntry {
  id: string;
  entryNumber: number;
  metrics: CardioMetrics;
}

interface CardioEntriesListProps {
  entries: CardioEntry[];
  schema: CardioMetricsSchema;
  onSelect: (entry: CardioEntry) => void;
}

/** Logged cardio entries, visually tabular with one in-flow edit button per row. */
export function CardioEntriesList({ entries, schema, onSelect }: CardioEntriesListProps) {
  const descriptionId = useId();
  if (entries.length === 0) {
    return <p className="px-4 pb-1 text-[13px] text-muted-foreground">No entries logged yet.</p>;
  }
  const specs = iterateMetrics(schema);
  // Identical tracks keep headers and values aligned, even without CSS subgrid.
  // Wide schemas scroll as a single unit; long labels can wrap within a track.
  const tracks = specs.map(() => "minmax(6rem, 1fr)");
  const tickTrack = specs.length > 0 ? "3.5rem" : "minmax(3.5rem, 1fr)";
  const gridStyle = { gridTemplateColumns: ["3.5rem", ...tracks, tickTrack].join(" ") };
  return (
    <div className="overflow-x-auto">
      <div
        className="w-full text-sm tabular-nums"
        style={{ minWidth: `${7 + specs.length * 6}rem` }}
      >
        <div
          aria-hidden="true"
          className="grid items-center border-b py-2 text-left font-semibold text-[12px] text-muted-foreground"
          style={gridStyle}
        >
          <span className="pl-4">Entry</span>
          {specs.map((spec) => (
            <span key={spec.key} className="wrap-anywhere px-3">
              {spec.label}
            </span>
          ))}
        </div>
        {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when the CSS reset removes list markers. */}
        <ol aria-label="Logged entries" role="list">
          {entries.map((entry) => {
            const ids = specs.map((_, index) => `${descriptionId}-${entry.id}-${index}`);
            return (
              <li key={entry.id} className="border-b border-border/70">
                {/* Keep this in flow: Safari can size an absolute button on a tr to the page. */}
                <Button
                  type="button"
                  variant="ghost"
                  className="grid h-auto min-h-11 w-full gap-0 rounded-none px-0 py-0 text-left whitespace-normal hover:bg-surface-inset focus-visible:bg-surface-inset has-[>svg]:px-0"
                  style={gridStyle}
                  aria-label={`Edit entry ${entry.entryNumber}`}
                  aria-describedby={ids.length > 0 ? ids.join(" ") : undefined}
                  onClick={() => onSelect(entry)}
                >
                  <span className="pl-4 text-muted-foreground">{entry.entryNumber}</span>
                  {specs.map((spec, index) => (
                    <span key={spec.key} id={ids[index]} className="wrap-anywhere px-3">
                      <span className="sr-only">{spec.label}: </span>
                      {formatMetricValue(entry.metrics[spec.key], spec)}
                    </span>
                  ))}
                  <Check
                    strokeWidth={2.6}
                    aria-hidden="true"
                    className="mr-4 justify-self-end text-positive"
                  />
                </Button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
