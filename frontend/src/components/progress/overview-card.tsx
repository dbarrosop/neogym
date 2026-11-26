import { Link } from "@tanstack/react-router";
import { type ReactNode, useId } from "react";
import { ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Skeleton } from "@/components/ui/skeleton";

/** Body and Energy cover the same 30 days as their sections' default charts. */
export const OVERVIEW_WINDOW_DAYS = 30;

type SectionPath =
  | "/progress/muscles"
  | "/progress/strength"
  | "/progress/body"
  | "/progress/energy";

/** A Progress › Overview card: the section title with "See all", then its summary. */
export function OverviewCard({
  title,
  to,
  children,
}: {
  title: string;
  to: SectionPath;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-[15px] font-semibold">
          {title}
        </h2>
        <Link
          to={to}
          className="-my-2 inline-flex min-h-11 items-center text-sm font-medium text-link underline-offset-4 hover:underline"
        >
          See all<span className="sr-only"> {title.toLowerCase()}</span>
        </Link>
      </div>
      {children}
    </section>
  );
}

/** The card's headline figure with its unit, and a secondary line under it. */
export function OverviewHeadline({
  value,
  unit,
  caption,
}: {
  value: string;
  unit: string;
  caption?: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="tabular-nums">
        <strong className="text-[26px] leading-tight font-bold">{value}</strong>{" "}
        <span className="text-sm font-medium text-muted-foreground">{unit}</span>
      </p>
      {caption ? (
        <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">{caption}</p>
      ) : null}
    </div>
  );
}

/** First and last dates under an axis-less chart. */
export function OverviewDateRange({ start, end }: { start: string; end?: string | null }) {
  return (
    <p className="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
      <span>{start}</span>
      {end ? <span>{end}</span> : null}
    </p>
  );
}

/** Nothing to summarise yet. */
export function OverviewMessage({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

interface OverviewQuery {
  data?: unknown;
  error: Error | null;
  isFetching: boolean;
  refetch: () => unknown;
}

/**
 * A card's loading and error states: a skeleton before the first load, and
 * the error with Retry (cached content, if any, stays below it).
 */
export function OverviewQueryState({
  query,
  errorTitle,
}: {
  query: OverviewQuery;
  errorTitle: string;
}) {
  if (query.error) {
    return (
      <ErrorState
        title={errorTitle}
        message={query.error.message}
        onRetry={() => query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }
  if (query.data === undefined) {
    return (
      <SkeletonState className="flex flex-col gap-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </SkeletonState>
    );
  }
  return null;
}
