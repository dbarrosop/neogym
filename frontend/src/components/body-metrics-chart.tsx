import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { describeTrend } from "@/lib/chart-trend";

export interface BodyMetricsPoint {
  /** ms since epoch — recharts time-scale axis */
  date: number;
  weightKg: number | null;
  bodyFatPct: number | null;
}

interface BodyMetricsChartProps {
  points: BodyMetricsPoint[];
}

const WEIGHT_COLOR = "var(--color-chart-1)";
// Series 2 orange is fill-only. Body fat is a line with its own axis labels, so it
// uses the neutral series, which meets text and graphics contrast in both themes.
const FAT_COLOR = "var(--color-chart-3)";

export function BodyMetricsChart({ points }: BodyMetricsChartProps) {
  const label = [
    describeTrend(
      points.map((point) => ({ date: point.date, value: point.weightKg })),
      { label: "Weight", unit: "kg" },
    ),
    describeTrend(
      points.map((point) => ({ date: point.date, value: point.bodyFatPct })),
      { label: "Body fat", unit: "%" },
    ),
  ].join(" ");
  const formatTick = (value: number) =>
    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart
          data={points}
          aria-label={label}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTick}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            interval="preserveStartEnd"
            height={20}
          />
          <YAxis
            yAxisId="weight"
            orientation="left"
            domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: WEIGHT_COLOR }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <YAxis
            yAxisId="fat"
            orientation="right"
            domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: FAT_COLOR }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{
              stroke: "var(--color-muted-foreground)",
              strokeOpacity: 0.4,
              strokeDasharray: "3 3",
            }}
            content={<MetricsTooltip />}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="plainline" />
          <Line
            yAxisId="weight"
            name="Weight (kg)"
            type="monotone"
            dataKey="weightKg"
            stroke={WEIGHT_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 3.5,
              fill: WEIGHT_COLOR,
              stroke: "var(--color-background)",
              strokeWidth: 2,
            }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="fat"
            name="Body fat (%)"
            type="monotone"
            dataKey="bodyFatPct"
            stroke={FAT_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 3.5,
              fill: FAT_COLOR,
              stroke: "var(--color-background)",
              strokeWidth: 2,
            }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricsTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload as BodyMetricsPoint | undefined;
  if (!point) {
    return null;
  }
  const date = new Date(point.date);
  return (
    <div className="space-y-0.5 rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">
        {date.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
      {point.weightKg === null ? null : (
        <p className="font-medium text-popover-foreground tabular-nums">
          <span className="text-muted-foreground">Weight: </span>
          {point.weightKg.toFixed(2)} kg
        </p>
      )}
      {point.bodyFatPct === null ? null : (
        <p className="font-medium text-popover-foreground tabular-nums">
          <span className="text-muted-foreground">Body fat: </span>
          {point.bodyFatPct.toFixed(1)} %
        </p>
      )}
    </div>
  );
}
