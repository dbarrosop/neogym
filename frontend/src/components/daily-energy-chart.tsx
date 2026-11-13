import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { describeTrend } from "@/lib/chart-trend";

export interface DailyEnergyPoint {
  /** ms since epoch — recharts time-scale axis */
  date: number;
  activeKcal: number | null;
  restingKcal: number | null;
}

interface DailyEnergyChartProps {
  points: DailyEnergyPoint[];
}

const ACTIVE_COLOR = "var(--color-chart-2)";
const RESTING_COLOR = "var(--color-chart-1)";

export function DailyEnergyChart({ points }: DailyEnergyChartProps) {
  const label = [
    describeTrend(
      points.map((point) => ({ date: point.date, value: point.activeKcal })),
      { label: "Active energy", unit: "kcal" },
    ),
    describeTrend(
      points.map((point) => ({ date: point.date, value: point.restingKcal })),
      { label: "Resting energy", unit: "kcal" },
    ),
  ].join(" ");
  const formatTick = (value: number) =>
    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <ComposedChart
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
            domain={[0, "auto"]}
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
          <Legend content={<EnergyLegend />} />
          <Area
            name="Active (kcal)"
            type="monotone"
            dataKey="activeKcal"
            fill={ACTIVE_COLOR}
            fillOpacity={0.25}
            // Orange is fill-only: a neutral outline keeps the trend legible in light mode.
            stroke="var(--color-muted-foreground)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 3.5,
              fill: ACTIVE_COLOR,
              stroke: "var(--color-muted-foreground)",
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
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function EnergyLegend() {
  return (
    <ul className="flex justify-center gap-3 pt-1 text-[11px] text-foreground">
      <li className="inline-flex items-center gap-1">
        <span
          aria-hidden="true"
          className="h-2.5 w-3.5 border border-muted-foreground"
          style={{ backgroundColor: ACTIVE_COLOR }}
        />
        Active (kcal)
      </li>
      <li className="inline-flex items-center gap-1">
        <span
          aria-hidden="true"
          className="w-3.5 border-t-2"
          style={{ borderColor: RESTING_COLOR }}
        />
        Resting (kcal)
      </li>
    </ul>
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
    <div className="space-y-0.5 rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">
        {date.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
      {point.activeKcal === null ? null : (
        <p className="font-medium text-popover-foreground tabular-nums">
          <span className="text-muted-foreground">Active: </span>
          {point.activeKcal.toFixed(0)} kcal
        </p>
      )}
      {point.restingKcal === null ? null : (
        <p className="font-medium text-popover-foreground tabular-nums">
          <span className="text-muted-foreground">Resting: </span>
          {point.restingKcal.toFixed(0)} kcal
        </p>
      )}
    </div>
  );
}
