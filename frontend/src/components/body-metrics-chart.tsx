import { TrendChart } from "@/components/charts/trend-chart";
import type { ChartColor } from "@/components/charts/trend-chart-model";
import type { BodyMetricTrend } from "@/lib/body-trend";
import {
  formatChartDate,
  formatSignedDelta,
  type MetricFormatter,
  metricFormat,
} from "@/lib/metric-format";

export type BodyMetricKind = "weight" | "bodyFat";

const METRICS: Record<
  BodyMetricKind,
  {
    title: string;
    color: ChartColor;
    unit: string;
    reading: MetricFormatter;
    average: MetricFormatter;
    empty: string;
  }
> = {
  weight: {
    title: "Weight",
    color: "chart-1",
    unit: "kg",
    reading: metricFormat.weight,
    average: metricFormat.weightAverage,
    empty: "No weight readings in this period.",
  },
  bodyFat: {
    title: "Body fat",
    color: "chart-2",
    unit: "%",
    reading: metricFormat.bodyFat,
    average: metricFormat.bodyFat,
    empty: "No body fat readings in this period.",
  },
};

/** "−1.0 vs prior 7 days" (always neutral: NeoGym has no weight goal). */
export function bodyWeekChangeCaption(metric: BodyMetricTrend): string | null {
  if (metric.weekChange !== null) {
    return `${formatSignedDelta(metric.weekChange)} vs prior 7 days`;
  }
  return metric.weekAverage === null ? "No readings in the last 7 days" : null;
}

/**
 * One body metric on Progress › Body: its 7-day average, the neutral change
 * against the prior seven days and the latest reading, above its own chart of
 * daily readings (faint, with dots) and the 7-day average line. Weight is
 * Chart 1 (blue), body fat Chart 2 (orange).
 */
export function BodyMetricTrendColumn({
  kind,
  metric,
  domain,
}: {
  kind: BodyMetricKind;
  metric: BodyMetricTrend;
  domain: { start: string; end: string };
}) {
  const config = METRICS[kind];
  const change = bodyWeekChangeCaption(metric);
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="flex flex-col tabular-nums">
          <span className="text-[13px] text-muted-foreground">{config.title} · 7-day avg</span>
          <strong className="text-[26px] leading-tight font-bold">
            {metric.weekAverage === null ? "—" : config.average(metric.weekAverage)}
          </strong>
          {change ? (
            <span className="text-[13px] font-semibold text-muted-foreground">{change}</span>
          ) : null}
        </div>
        {metric.latest ? (
          <span className="text-[13px] text-muted-foreground tabular-nums">
            Latest {config.reading(metric.latest.value)} · {formatChartDate(metric.latest.date)}
          </span>
        ) : null}
      </div>
      {metric.readings.length > 0 ? (
        <TrendChart
          title={`${config.title}, daily readings and 7-day average`}
          domain={domain}
          axes={{ left: { unit: config.unit } }}
          series={[
            {
              id: "daily",
              name: "Daily",
              color: config.color,
              style: "daily",
              points: metric.readings,
              format: config.reading,
            },
            {
              id: "average",
              name: "7-day avg",
              color: config.color,
              style: "average",
              points: metric.rollingAverage,
              format: config.average,
            },
          ]}
        />
      ) : (
        <p className="flex h-[180px] items-center justify-center rounded-lg bg-surface-inset px-3 text-center text-sm text-muted-foreground">
          {config.empty}
        </p>
      )}
    </div>
  );
}
