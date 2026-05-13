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

export function CardioEntriesList({ entries, schema, onSelect }: CardioEntriesListProps) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground px-1 text-xs italic">No entries logged yet.</p>;
  }
  const specs = iterateMetrics(schema);
  return (
    <ul className="divide-border/40 divide-y">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            onClick={() => onSelect(entry)}
            className="hover:bg-accent/50 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors"
          >
            <span className="bg-muted text-muted-foreground grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums">
              {entry.entryNumber}
            </span>
            <span className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm tabular-nums">
              {specs.map((spec) => {
                const v = entry.metrics[spec.key];
                if (v === undefined || v === null) {
                  return null;
                }
                return (
                  <span key={spec.key} className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                      {spec.label}
                    </span>
                    <span className="font-medium">{formatMetricValue(v, spec)}</span>
                  </span>
                );
              })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
