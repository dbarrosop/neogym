import { Check } from "lucide-react";
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

/**
 * Logged cardio entries as the session's set table: one column per metric in
 * schema order, each row one native button that opens the entry to edit.
 */
export function CardioEntriesList({ entries, schema, onSelect }: CardioEntriesListProps) {
  if (entries.length === 0) {
    return <p className="px-4 pb-1 text-[13px] text-muted-foreground">No entries logged yet.</p>;
  }
  const specs = iterateMetrics(schema);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-[12px] text-muted-foreground">
            <th scope="col" className="w-14 py-2 pl-4 font-semibold">
              Entry
            </th>
            {specs.map((spec) => (
              <th key={spec.key} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                {spec.label}
              </th>
            ))}
            <th scope="col" className="w-14 pr-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="relative h-11 border-b border-border/70 focus-within:bg-surface-inset hover:bg-surface-inset"
            >
              <td className="pl-4 font-semibold text-muted-foreground">{entry.entryNumber}</td>
              {specs.map((spec) => (
                <td key={spec.key} className="px-3 font-semibold whitespace-nowrap">
                  {formatMetricValue(entry.metrics[spec.key], spec)}
                </td>
              ))}
              <td className="w-14">
                {/* One native button spans the row without replacing its table semantics. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-0 size-full justify-end rounded-none px-4 text-positive hover:bg-transparent hover:text-positive dark:hover:bg-transparent"
                  aria-label={`Edit entry ${entry.entryNumber}`}
                  onClick={() => onSelect(entry)}
                >
                  <Check strokeWidth={2.6} aria-hidden="true" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
