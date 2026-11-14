import { TrendChart } from "@/components/charts/trend-chart";
import {
  OVERVIEW_WINDOW_DAYS,
  OverviewCard,
  OverviewDateRange,
  OverviewHeadline,
  OverviewMessage,
  OverviewQueryState,
} from "@/components/progress/overview-card";
import { useCalorieHistory } from "@/lib/hooks/use-calorie-history";
import { formatChartDate, formatKcalNumber, formatNumber, metricFormat } from "@/lib/metric-format";
import { addLocalDateDays } from "@/lib/nutrition";
import { chartWindow } from "@/lib/rolling-average";
import { useLocalToday } from "@/lib/use-local-today";

/**
 * Overview › Energy: the latest 7-day average net (consumed − burned) with
 * the consumed and burned per day behind it, over daily net and its 7-day
 * average for the last 30 days. Today is partial, so net ends yesterday.
 * Shares Progress › Energy's 30-day calorie-history query.
 */
export function OverviewEnergyCard() {
  const today = useLocalToday();
  const range = chartWindow(OVERVIEW_WINDOW_DAYS, today);
  const { query, trend } = useCalorieHistory(range);
  const yesterday = addLocalDateDays(today, -1);
  const latest = trend?.latestNetAverage ?? null;
  const perDay = trend?.latestNetWindow ?? null;
  return (
    <OverviewCard title="Energy" to="/progress/energy">
      <OverviewQueryState query={query} errorTitle="Couldn't load calories" />
      {trend && latest === null ? (
        <OverviewMessage>
          No full days with food logged and energy recorded in the last {OVERVIEW_WINDOW_DAYS} days.
        </OverviewMessage>
      ) : null}
      {trend && latest !== null ? (
        <>
          <OverviewHeadline
            value={formatNumber(latest, { signed: true })}
            unit="kcal net · 7-day avg"
            caption={
              perDay
                ? `Consumed ${formatKcalNumber(perDay.consumed)} · burned ${formatKcalNumber(perDay.burned)} per day`
                : null
            }
          />
          <TrendChart
            title="Net calories, daily and 7-day average"
            height={120}
            yAxis="baseline"
            xTicks="none"
            legend={false}
            domain={{ start: range.start, end: yesterday }}
            axes={{ left: { includeZero: true } }}
            series={[
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
            ]}
          />
          <OverviewDateRange
            start={formatChartDate(range.start)}
            end={formatChartDate(yesterday)}
          />
        </>
      ) : null}
    </OverviewCard>
  );
}
