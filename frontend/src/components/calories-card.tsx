import { type ReactNode, useId } from "react";
import { TrendChart, type TrendChartProps } from "@/components/charts/trend-chart";
import { ErrorState } from "@/components/patterns/query-states";
import { Skeleton } from "@/components/ui/skeleton";
import type { CalorieTrend } from "@/lib/calorie-trend";
import { useCalorieHistory } from "@/lib/hooks/use-calorie-history";
import { metricFormat } from "@/lib/metric-format";
import { chartWindow } from "@/lib/rolling-average";
import { useLocalToday } from "@/lib/use-local-today";

function CalorieColumn({
  label,
  value,
  chart,
  empty,
}: {
  label: string;
  value: string;
  chart: TrendChartProps | null;
  empty: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-col tabular-nums">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <strong className="text-2xl leading-tight font-bold">{value}</strong>
      </div>
      {chart ? (
        <TrendChart {...chart} />
      ) : (
        <p className="flex h-[180px] items-center justify-center rounded-lg bg-surface-inset px-3 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  );
}

/** The consumed and net columns for a loaded calorie trend. */
export function CalorieCharts({
  trend,
  domain,
}: {
  trend: CalorieTrend;
  domain: { start: string; end: string };
}) {
  const consumed: TrendChartProps | null = trend.isEmpty
    ? null
    : {
        title: "Calories consumed per day and 7-day average",
        domain,
        series: [
          {
            id: "daily",
            name: "Daily",
            color: "chart-1",
            style: "daily",
            points: trend.consumedPoints,
            format: metricFormat.kcal,
          },
          {
            id: "average",
            name: "7-day avg",
            color: "chart-1",
            style: "average",
            points: trend.consumedAverage,
            format: metricFormat.kcal,
          },
        ],
      };
  const net: TrendChartProps | null =
    trend.net.length === 0
      ? null
      : {
          title: "Net calories, daily and 7-day average",
          domain,
          axes: { left: { includeZero: true } },
          series: [
            {
              id: "daily",
              name: "Daily",
              color: "chart-2",
              style: "daily",
              points: trend.net,
              format: metricFormat.netKcal,
            },
            {
              id: "average",
              name: "7-day avg",
              color: "chart-2",
              style: "average",
              points: trend.netAverage,
              format: metricFormat.netKcal,
            },
          ],
        };
  const average = (value: number | null, format: (value: number) => string) =>
    value === null ? "—" : format(value);
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-7">
      <CalorieColumn
        label="Consumed · 7-day avg"
        value={average(trend.latestConsumedAverage, metricFormat.kcal)}
        chart={consumed}
        empty="No food logged in this period."
      />
      <CalorieColumn
        label="Net (consumed − burned) · 7-day avg"
        value={average(trend.latestNetAverage, metricFormat.netKcal)}
        chart={net}
        empty="No full day with both food and energy logged in this period."
      />
    </div>
  );
}

/**
 * Progress › Energy's Calories card: consumed (Chart 1) and net (Chart 2) per
 * day with their 7-day averages over its own period. Today's intake so far is
 * an open dot; net and both averages use full days only (`buildCalorieTrend`).
 */
export function CaloriesCard({
  days,
  periodControl,
}: {
  /** Chart window in days, ending today. */
  days: number;
  periodControl: ReactNode;
}) {
  const titleId = useId();
  const today = useLocalToday();
  const range = chartWindow(days, today);
  const { query, trend } = useCalorieHistory(range);
  let body: ReactNode;
  if (query.isPending) {
    body = (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-7">
        <Skeleton className="h-[230px] w-full rounded-lg" />
        <Skeleton className="h-[230px] w-full rounded-lg" />
      </div>
    );
  } else if (query.error || !trend) {
    body = (
      <ErrorState
        title="Couldn't load calories"
        message={query.error?.message}
        onRetry={() => query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  } else {
    body = <CalorieCharts trend={trend} domain={range} />;
  }
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
          <h2 id={titleId} className="text-[15px] font-semibold">
            Calories
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Daily values and 7-day averages. Today so far is the open dot after the dashed line;
            averages use full days only.
          </p>
        </div>
        {periodControl}
      </div>
      {body}
    </section>
  );
}
