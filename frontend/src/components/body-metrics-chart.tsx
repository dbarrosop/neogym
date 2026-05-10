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
const FAT_COLOR = "var(--color-chart-2)";

export function BodyMetricsChart({ points }: BodyMetricsChartProps) {
  const formatTick = (value: number) =>
    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
    <div className="space-y-0.5 rounded-md border border-border/60 bg-popover/95 px-2.5 py-1.5 text-xs shadow-md backdrop-blur">
      <p className="text-muted-foreground">
        {date.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
      {point.weightKg === null ? null : (
        <p className="font-medium tabular-nums" style={{ color: WEIGHT_COLOR }}>
          <span className="text-muted-foreground">Weight: </span>
          {point.weightKg.toFixed(2)} kg
        </p>
      )}
      {point.bodyFatPct === null ? null : (
        <p className="font-medium tabular-nums" style={{ color: FAT_COLOR }}>
          <span className="text-muted-foreground">Body fat: </span>
          {point.bodyFatPct.toFixed(1)} %
        </p>
      )}
    </div>
  );
}
