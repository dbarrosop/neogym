import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { TrendChart, type TrendChartProps } from "@/components/charts/trend-chart";
import { formatNumber, metricFormat } from "@/lib/metric-format";
import type { ExerciseStrengthTrend } from "@/lib/strength-progress";

/** "e1RM 172.7 kg · best 180", or the volume when no set gives an estimate. */
export function exerciseStrengthCaption(trend: ExerciseStrengthTrend): string {
  if (trend.latestEstimatedOneRepMax !== null && trend.bestEstimatedOneRepMax !== null) {
    return `e1RM ${metricFormat.estimatedOneRepMax(trend.latestEstimatedOneRepMax)} · best ${formatNumber(trend.bestEstimatedOneRepMax, { maxDecimals: 1 })}`;
  }
  if (trend.latestVolume !== null && trend.bestVolume !== null) {
    return `Volume ${metricFormat.volume(trend.latestVolume)} · best ${formatNumber(trend.bestVolume)}`;
  }
  return "No sets in this period";
}

function seriesFor(trend: ExerciseStrengthTrend): TrendChartProps["series"] {
  const volume = {
    id: "volume",
    name: "Volume",
    legendLabel: "Volume (kg)",
    color: "chart-1",
    points: trend.points.map((point) => ({ date: point.date, value: point.volume })),
    format: metricFormat.volume,
  } as const;
  const estimates = trend.points.flatMap((point) =>
    point.estimatedOneRepMax === null
      ? []
      : [{ date: point.date, value: point.estimatedOneRepMax }],
  );
  if (estimates.length === 0) {
    return [volume];
  }
  return [
    volume,
    {
      id: "e1rm",
      name: "Est. 1RM",
      legendLabel: "Est. 1RM (kg)",
      color: "chart-2",
      axis: "right",
      points: estimates,
      format: metricFormat.estimatedOneRepMax,
    },
  ];
}

/**
 * Progress › Strength: an exercise logged in the last ten days. The header
 * opens the exercise; the chart pairs each session date's volume (Chart 1,
 * left) with its best estimated one-rep max (Chart 2, right), start-aligned.
 */
export function ExerciseStrengthCard({ trend }: { trend: ExerciseStrengthTrend }) {
  const series = seriesFor(trend);
  const title =
    series.length > 1 ? `${trend.name} volume and estimated one-rep max` : `${trend.name} volume`;
  return (
    <article className="flex h-full min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-4">
      <Link
        to="/train/exercises/$exerciseId"
        params={{ exerciseId: trend.id }}
        className="-m-1 flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-surface-inset"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="text-[15px] font-semibold">{trend.name}</strong>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {exerciseStrengthCaption(trend)}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      <TrendChart title={title} period="session" xScale="index" height={220} series={series} />
    </article>
  );
}
