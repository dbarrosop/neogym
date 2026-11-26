import { useMemo } from "react";
import { TrendChart } from "@/components/charts/trend-chart";
import {
  OverviewCard,
  OverviewDateRange,
  OverviewHeadline,
  OverviewMessage,
  OverviewQueryState,
} from "@/components/progress/overview-card";
import { useStrengthProgress } from "@/components/progress/progress-queries";
import { formatChartDate, formatWeekOf, metricFormat } from "@/lib/metric-format";
import { buildWeeklyStrength, type WeeklyVolume, weeklyVolumeLabel } from "@/lib/strength-progress";

/** "This week so far 20.5k, dashed" (the chart's dashed last segment). */
export function thisWeekCaption(week: WeeklyVolume | null): string {
  if (!week || week.volume <= 0) {
    return "No sets this week yet";
  }
  return `This week so far ${metricFormat.weeklyVolume(week.volume)}, dashed`;
}

/**
 * Overview › Strength: the best week and this week's volume so far over the
 * weekly volume line (Strength's default-period query).
 */
export function OverviewStrengthCard() {
  const { query, today } = useStrengthProgress();
  const weekly = useMemo(
    () => (query.data ? buildWeeklyStrength(query.data.strengthProgress, { today }) : null),
    [query.data, today],
  );
  const first = weekly?.weeks[0];
  const best = weekly?.bestWeek;
  return (
    <OverviewCard title="Strength" to="/progress/strength">
      <OverviewQueryState query={query} errorTitle="Couldn't load strength progress" />
      {weekly && !first ? (
        <OverviewMessage>No strength sets in the last 8 weeks.</OverviewMessage>
      ) : null}
      {weekly && first && best ? (
        <>
          <OverviewHeadline
            value={metricFormat.weeklyVolume(best.volume)}
            unit={`kg · best week, ${formatChartDate(best.weekStart)}`}
            caption={thisWeekCaption(weekly.thisWeek)}
          />
          <TrendChart
            title="Weekly strength volume"
            period="week"
            height={120}
            yAxis="baseline"
            xTicks="none"
            legend={false}
            series={[
              {
                id: "volume",
                name: "Volume",
                color: "chart-1",
                points: weekly.points,
                format: weeklyVolumeLabel,
              },
            ]}
          />
          <OverviewDateRange
            start={formatWeekOf(first.weekStart)}
            end={weekly.thisWeek ? "This week" : null}
          />
        </>
      ) : null}
    </OverviewCard>
  );
}
