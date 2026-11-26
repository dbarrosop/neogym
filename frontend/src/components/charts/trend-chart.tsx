import {
  CartesianGrid,
  type DotItemDotProps,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  type XAxisTickContentProps,
  YAxis,
  type YAxisTickContentProps,
} from "recharts";
import { ChartLegend, ChartSwatch } from "@/components/charts/chart-legend";
import {
  buildTrendChartModel,
  type TrendAxisModel,
  type TrendChartModel,
  type TrendChartModelOptions,
  type TrendChartRow,
  type TrendLineModel,
} from "@/components/charts/trend-chart-model";
import { formatChartDate, formatWeekOf } from "@/lib/metric-format";
import { cn } from "@/lib/utils";

export interface TrendChartProps extends TrendChartModelOptions {
  /** Chart height in px, excluding the legend (default 180). */
  height?: number;
  /** `labels`: three value labels per axis with grid lines; `baseline`: one baseline, no labels. */
  yAxis?: "labels" | "baseline";
  /** Show the legend under the chart (default true). */
  legend?: boolean;
  /** Fill of the open partial dot: the surface the chart sits on (default the card). */
  surface?: string;
  className?: string;
}

const TICK_STYLE = { fontSize: 11, fill: "var(--color-tertiary-foreground)" } as const;

function axisLabelFor(axis: TrendAxisModel, value: number) {
  let nearest = 0;
  for (const [index, tick] of axis.ticks.entries()) {
    if (Math.abs(tick - value) < Math.abs((axis.ticks[nearest] ?? 0) - value)) {
      nearest = index;
    }
  }
  return axis.labels[nearest] ?? "";
}

type TooltipPayload = TooltipContentProps<number, string>["payload"];

function rowOf(payload: TooltipPayload | undefined) {
  return payload?.find((item) => item?.payload)?.payload as TrendChartRow | undefined;
}

function TrendTooltip({
  model,
  period,
  locale,
  active,
  payload,
}: {
  model: TrendChartModel;
  period: TrendChartProps["period"];
  locale: string | undefined;
  active: boolean | undefined;
  payload: TooltipPayload | undefined;
}) {
  const row = active ? rowOf(payload) : undefined;
  if (!row || row.entries.length === 0) {
    return null;
  }
  const partial = row.entries.some((entry) => entry.partial);
  const date =
    period === "week"
      ? formatWeekOf(row.date, { locale })
      : formatChartDate(row.date, { weekday: true, locale });
  const time =
    row.sessionTime === undefined
      ? null
      : new Date(row.sessionTime).toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        });
  return (
    <div className="space-y-0.5 rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">
        {date}
        {time ? ` · ${time}` : ""}
        {partial ? " · so far" : ""}
      </p>
      {row.entries.map((entry) => {
        const line = model.lines[entry.seriesIndex];
        if (!line) {
          return null;
        }
        return (
          <p
            key={`${line.key}-${entry.partial}`}
            className="flex items-center gap-1.5 font-medium text-popover-foreground tabular-nums"
          >
            <ChartSwatch color={line.series.color} style={line.style} />
            <span className="text-muted-foreground">{line.series.name}</span>
            {line.series.format(entry.value)}
          </p>
        );
      })}
    </div>
  );
}

function OpenDot({
  line,
  surface,
  ...props
}: DotItemDotProps & { line: TrendLineModel; surface: string }) {
  const row = props.payload as TrendChartRow | undefined;
  if (row?.x !== line.partialX || props.cx === undefined || props.cy === undefined) {
    return null;
  }
  return (
    <circle
      className="trend-chart-open-dot"
      cx={props.cx}
      cy={props.cy}
      r={3}
      fill={surface}
      stroke={line.color}
      strokeWidth={1.5}
    />
  );
}

function renderLine(line: TrendLineModel) {
  const daily = line.style === "daily";
  return (
    <Line
      key={line.key}
      className={`trend-chart-line trend-chart-line-${line.style}`}
      yAxisId={line.axis}
      name={line.series.name}
      dataKey={(row: TrendChartRow) => row.values[line.key] ?? null}
      type="linear"
      stroke={line.color}
      strokeWidth={daily ? 1.5 : 2.5}
      strokeOpacity={daily ? 0.5 : 1}
      strokeLinecap="round"
      strokeLinejoin="round"
      dot={
        line.dotRadius > 0
          ? {
              className: `trend-chart-dot trend-chart-dot-${line.style}`,
              r: line.dotRadius,
              fill: line.color,
              fillOpacity: daily ? 0.85 : 1,
              stroke: "none",
              strokeWidth: 0,
            }
          : false
      }
      activeDot={{ r: 4, fill: line.color, stroke: "var(--color-card)", strokeWidth: 2 }}
      connectNulls
      isAnimationActive={false}
    />
  );
}

function renderPartialLine(line: TrendLineModel, surface: string) {
  const key = line.partialKey;
  if (!key) {
    return null;
  }
  return (
    <Line
      key={key}
      className="trend-chart-partial"
      yAxisId={line.axis}
      name={line.series.name}
      dataKey={(row: TrendChartRow) => row.values[key] ?? null}
      type="linear"
      stroke={line.color}
      strokeWidth={1.5}
      strokeOpacity={0.7}
      strokeDasharray="3 3"
      strokeLinecap="round"
      dot={(props: DotItemDotProps) => (
        <OpenDot key={`${key}-${props.index}`} {...props} line={line} surface={surface} />
      )}
      activeDot={false}
      legendType="none"
      connectNulls
      isAnimationActive={false}
    />
  );
}

function XTick({
  x,
  y,
  payload,
  ticks,
}: XAxisTickContentProps & { ticks: TrendChartModel["xTicks"] }) {
  const tick = ticks.find((item) => item.value === payload.value);
  if (!tick) {
    return null;
  }
  return (
    <text x={x} y={Number(y) + 14} textAnchor={tick.anchor} {...TICK_STYLE}>
      {tick.label}
    </text>
  );
}

/**
 * Plain SVG text: Recharts' default tick word-wraps labels to the axis width,
 * which splits unit labels such as "13.5 %" onto two clipped lines.
 */
function YTick({
  x,
  y,
  payload,
  textAnchor,
  axis,
}: YAxisTickContentProps & { axis: TrendAxisModel }) {
  return (
    <text
      className="recharts-cartesian-axis-tick-value"
      x={x}
      y={y}
      dy="0.355em"
      textAnchor={textAnchor}
      {...TICK_STYLE}
    >
      {axisLabelFor(axis, Number(payload.value))}
    </text>
  );
}

function renderYAxis(axis: TrendAxisModel | null, hidden: boolean) {
  if (!axis) {
    return null;
  }
  return (
    <YAxis
      key={axis.side}
      yAxisId={axis.side}
      orientation={axis.side}
      type="number"
      domain={axis.domain}
      ticks={axis.ticks}
      interval={0}
      hide={hidden}
      width={axis.width}
      tick={(props: YAxisTickContentProps) => <YTick {...props} axis={axis} />}
      tickLine={false}
      axisLine={false}
    />
  );
}

/**
 * The shared trend chart (Patterns › Charts): one or two series coloured by
 * metric, daily readings under their 7-day average or plain lines, a dot on
 * every reading, missing days joined, the partial current period as a dashed
 * segment to an open dot, three value labels per axis (start-aligned when two
 * measures share the chart), first/middle/last dates, a legend below, and a
 * spoken summary on the interactive SVG (Recharts keeps keyboard and tooltip
 * access). Renders nothing without data: callers show their empty state.
 */
export function TrendChart({
  height = 180,
  yAxis = "labels",
  legend = true,
  surface = "var(--color-card)",
  className,
  ...options
}: TrendChartProps) {
  // Cheap (a few hundred points at most), so it is rebuilt with the props.
  const model = buildTrendChartModel(options);
  if (model.isEmpty) {
    return null;
  }
  const baseline = yAxis === "baseline";
  const gridAxis = model.axes.left ?? model.axes.right;
  const [start, end] = model.xDomain;
  const xDomain: [number, number] = start === end ? [start - 1, end + 1] : [start, end];
  const legendItems = model.lines
    .filter((line) => !line.series.hideInLegend)
    .map((line) => ({
      label: line.series.legendLabel ?? line.series.name,
      color: line.series.color,
      style: line.style,
    }));

  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={model.rows}
            aria-label={model.label}
            margin={{
              top: 8,
              right: model.axes.right && !baseline ? 0 : 6,
              // Without date labels, keep the lowest dots clear of the edge.
              bottom: model.xTicks.length === 0 ? 4 : 0,
              left: model.axes.left && !baseline ? 0 : 6,
            }}
          >
            {gridAxis ? (
              <CartesianGrid
                vertical={false}
                yAxisId={gridAxis.side}
                horizontalValues={baseline ? [gridAxis.domain[0]] : gridAxis.ticks}
                stroke="var(--color-chart-grid)"
              />
            ) : null}
            <XAxis
              dataKey="x"
              type="number"
              domain={xDomain}
              ticks={model.xTicks.map((tick) => tick.value)}
              interval={0}
              hide={model.xTicks.length === 0}
              height={24}
              tickSize={0}
              tickMargin={0}
              tick={(props: XAxisTickContentProps) => <XTick {...props} ticks={model.xTicks} />}
              tickLine={false}
              axisLine={false}
            />
            {renderYAxis(model.axes.left, baseline)}
            {renderYAxis(model.axes.right, baseline)}
            <Tooltip
              cursor={{ stroke: "var(--color-border)", strokeDasharray: "3 3" }}
              isAnimationActive={false}
              content={(props) => (
                <TrendTooltip
                  active={props.active}
                  payload={props.payload as TooltipPayload}
                  model={model}
                  period={options.period}
                  locale={options.locale}
                />
              )}
            />
            {model.lines.map(renderLine)}
            {model.lines.map((line) => renderPartialLine(line, surface))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {legend ? <ChartLegend items={legendItems} /> : null}
    </div>
  );
}
