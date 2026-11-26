import type { ReactNode } from "react";
import { SkeletonState } from "@/components/patterns/query-states";
import { Skeleton } from "@/components/ui/skeleton";

export interface EntryDetailStat {
  label: string;
  value: string;
}

/**
 * Read-only body of a measurement or energy-day detail page: the editor's
 * fields as labelled values, then the notes.
 */
export function EntryDetailCard({
  stats,
  notes,
  children,
}: {
  stats: EntryDetailStat[];
  notes: string;
  /** Extra content after the values, e.g. today's estimate. */
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-[10px] border bg-surface-inset px-4 py-3"
          >
            <dt className="text-[13px] text-muted-foreground">{stat.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {children}
      {notes ? (
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[13px] font-semibold text-soft-foreground">Notes</h2>
          <p className="whitespace-pre-wrap text-[15px]">{notes}</p>
        </div>
      ) : null}
    </section>
  );
}

export function EntryDetailSkeleton() {
  return (
    <SkeletonState className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-[74px] w-full" />
          <Skeleton className="h-[74px] w-full" />
        </div>
        <Skeleton className="h-4 w-2/3" />
      </div>
    </SkeletonState>
  );
}
