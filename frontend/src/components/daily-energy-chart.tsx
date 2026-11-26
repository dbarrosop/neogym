import type { ReactNode } from "react";
import { TrendChart } from "@/components/charts/trend-chart";
import type { EnergyTrend } from "@/lib/energy-trend";
import { formatKcal, formatKcalNumber, metricFormat } from "@/lib/metric-format";

/** "Average out · 29 full days"; just "Average out" before any full day. */
export function averageOutLabel(fullDayCount: number): string {
  if (fullDayCount === 0) {
    return "Average out";
  }
  return `Average out · ${fullDayCount} full ${fullDayCount === 1 ? "day" : "days"}`;
}

/**
 * Energy out per day (Progress › Energy): active (Chart 2, orange) and resting
 * (Chart 1, blue) lines with a dot per day from zero; today's partial row is a
 * dashed segment to open dots.
 */
export function DailyEnergyChart({
  trend,
  domain,
}: {
  trend: EnergyTrend;
  domain: { start: string; end: string };
}) {
  return (
    <TrendChart
      title="Active and resting energy per day"
      domain={domain}
      height={240}
      axes={{ left: { includeZero: true } }}
      series={[
        {
          id: "active",
          name: "Active",
          legendLabel: "Active (kcal)",
          color: "chart-2",
          points: trend.active,
          format: metricFormat.kcal,
        },
        {
          id: "resting",
          name: "Resting",
          legendLabel: "Resting (kcal)",
          color: "chart-1",
          points: trend.resting,
          format: metricFormat.kcal,
        },
      ]}
    />
  );
}

/**
 * The Energy trend card: "Average out" over the window's full days with its
 * resting and active split (today stays out), the period control, the chart
 * and, when today has a row, the partial-day caption.
 */
export function EnergyTrendSummary({
  trend,
  domain,
  periodControl,
}: {
  trend: EnergyTrend;
  domain: { start: string; end: string };
  periodControl: ReactNode;
}) {
  const kcal = (value: number | null) => (value === null ? "—" : formatKcal(value));
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="m-0 flex flex-wrap gap-x-9 gap-y-3 tabular-nums">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-muted-foreground">
              {averageOutLabel(trend.fullDayCount)}
            </dt>
            <dd className="text-[28px] leading-tight font-semibold">
              {trend.averageOut === null ? "—" : `${formatKcalNumber(trend.averageOut)} kcal`}
              {trend.averageOut === null ? null : (
                <span className="text-sm font-medium text-muted-foreground"> / day</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-muted-foreground">Resting</dt>
            <dd className="text-lg font-semibold">{kcal(trend.averageResting)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-muted-foreground">Active</dt>
            <dd className="text-lg font-semibold">{kcal(trend.averageActive)}</dd>
          </div>
        </dl>
        {periodControl}
      </div>
      {trend.days.length > 0 ? (
        <DailyEnergyChart trend={trend} domain={domain} />
      ) : (
        <p className="flex h-[240px] items-center justify-center rounded-lg bg-surface-inset px-3 text-center text-sm text-muted-foreground">
          No energy recorded in this period.
        </p>
      )}
      {trend.today ? (
        <p className="text-xs text-muted-foreground">
          Today so far is the open dot after the dashed line.
        </p>
      ) : null}
    </>
  );
}
