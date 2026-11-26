import { useMemo } from "react";
import { ChartSwatch } from "@/components/charts/chart-legend";
import { TrendChart } from "@/components/charts/trend-chart";
import type { ChartColor } from "@/components/charts/trend-chart-model";
import {
  OVERVIEW_WINDOW_DAYS,
  OverviewCard,
  OverviewMessage,
  OverviewQueryState,
} from "@/components/progress/overview-card";
import { type BodyMetricTrend, buildBodyTrend } from "@/lib/body-trend";
import { useBodyMeasurements } from "@/lib/hooks/use-body-measurements";
import { formatNumber, formatSignedDelta, metricFormat } from "@/lib/metric-format";
import { chartWindow } from "@/lib/rolling-average";
import { useLocalToday } from "@/lib/use-local-today";

function BodyColumn({
  label,
  color,
  unit,
  metric,
}: {
  label: string;
  color: ChartColor;
  unit: string;
  metric: BodyMetricTrend;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <ChartSwatch color={color} />
        {label} · 7-day avg
      </span>
      <p className="tabular-nums">
        <strong className="text-[22px] leading-tight font-bold">
          {metric.weekAverage === null
            ? "—"
            : formatNumber(metric.weekAverage, { maxDecimals: 1, minDecimals: 1 })}
        </strong>{" "}
        <span className="text-sm font-medium text-muted-foreground">{unit}</span>
      </p>
      <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">
        {metric.weekChange === null
          ? "No prior week to compare"
          : `${formatSignedDelta(metric.weekChange)} vs prior 7 days`}
      </p>
    </div>
  );
}

/**
 * Overview › Body: weight and body fat 7-day averages with their neutral
 * change against the prior seven days, over one chart pairing the averages
 * on start-aligned left and right axes for the last 30 days.
 */
export function OverviewBodyCard() {
  const today = useLocalToday();
  const range = chartWindow(OVERVIEW_WINDOW_DAYS, today);
  // Progress › Body's measurement list, so the card and the section share a cache.
  const query = useBodyMeasurements();
  const body = useMemo(
    () =>
      query.data
        ? buildBodyTrend(query.data.bodyMeasurements, { today, start: range.start })
        : null,
    [query.data, today, range.start],
  );
  return (
    <OverviewCard title="Body" to="/progress/body">
      <OverviewQueryState query={query} errorTitle="Couldn't load body measurements" />
      {body?.isEmpty ? (
        <OverviewMessage>No measurements in the last {OVERVIEW_WINDOW_DAYS} days.</OverviewMessage>
      ) : null}
      {body && !body.isEmpty ? (
        <>
          <div className="grid grid-cols-2 gap-6">
            <BodyColumn label="Weight" color="chart-1" unit="kg" metric={body.weight} />
            <BodyColumn label="Body fat" color="chart-2" unit="%" metric={body.bodyFat} />
          </div>
          <TrendChart
            title="Weight and body fat 7-day averages"
            height={150}
            xTicks="first-last"
            legend={false}
            domain={range}
            series={[
              {
                id: "weight",
                name: "Weight",
                color: "chart-1",
                style: "line",
                rollingAverage: true,
                points: body.weight.rollingAverage,
                format: metricFormat.weightAverage,
              },
              {
                id: "body-fat",
                name: "Body fat",
                color: "chart-2",
                style: "line",
                rollingAverage: true,
                axis: "right",
                points: body.bodyFat.rollingAverage,
                format: metricFormat.bodyFat,
              },
            ]}
          />
        </>
      ) : null}
    </OverviewCard>
  );
}
