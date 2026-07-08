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

export interface DailyEnergyPoint {
  /** ms since epoch — recharts time-scale axis */
  date: number;
  activeKcal: number | null;
  restingKcal: number | null;
}

interface DailyEnergyChartProps {
  points: DailyEnergyPoint[];
}

const ACTIVE_COLOR = "var(--color-chart-1)";
const RESTING_COLOR = "var(--color-chart-2)";

export function DailyEnergyChart({ points }: DailyEnergyChartProps) {
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
            domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{
              stroke: "var(--color-muted-foreground)",
              strokeOpacity: 0.4,
              strokeDasharray: "3 3",
            }}
            content={<EnergyTooltip />}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="plainline" />
          <Line
            name="Active (kcal)"
            type="monotone"
            dataKey="activeKcal"
            stroke={ACTIVE_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 3.5,
              fill: ACTIVE_COLOR,
              stroke: "var(--color-background)",
              strokeWidth: 2,
            }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            name="Resting (kcal)"
            type="monotone"
            dataKey="restingKcal"
            stroke={RESTING_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 3.5,
              fill: RESTING_COLOR,
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

function EnergyTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload as DailyEnergyPoint | undefined;
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
      {point.activeKcal === null ? null : (
        <p className="font-medium tabular-nums" style={{ color: ACTIVE_COLOR }}>
          <span className="text-muted-foreground">Active: </span>
          {point.activeKcal.toFixed(0)} kcal
        </p>
      )}
      {point.restingKcal === null ? null : (
        <p className="font-medium tabular-nums" style={{ color: RESTING_COLOR }}>
          <span className="text-muted-foreground">Resting: </span>
          {point.restingKcal.toFixed(0)} kcal
        </p>
      )}
    </div>
  );
}
