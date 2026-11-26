// The data behind <TrendChart>: merged rows, per-series line styles, value
// axes (rounded, or start-aligned for two measures), date ticks and the
// spoken summary. Pure so the chart rules can be tested without a DOM.

import {
  type AxisValueFormat,
  axisLabels,
  axisMax,
  axisTicks,
  type ChartAxisScale,
  roundedAxisScale,
  startAlignedAxisScales,
} from "@/lib/chart-axis-scale";
import { type SummaryPeriod, summarizeChart } from "@/lib/chart-summary";
import { formatChartDate } from "@/lib/metric-format";
import { dateFromDayNumber, dayNumber, type TrendPoint } from "@/lib/rolling-average";

/** Chart colours follow the metric: Chart 1 blue (weight, resting, consumed, volume), Chart 2 orange (body fat, active, net, Est. 1RM). */
export type ChartColor = "chart-1" | "chart-2";

/**
 * `line`: a 2.5 px line with a dot on every reading. `daily`: thin, half-opacity
 * daily readings with dots, drawn under their `average`: a solid 2.5 px rolling
 * average without dots.
 */
export type TrendSeriesStyle = "line" | "daily" | "average";

export type TrendAxisSide = "left" | "right";

export interface TrendChartPoint extends TrendPoint {
  /** Optional observation identity for indexed session charts. */
  session?: { id: string; startedAt: number };
}

export interface TrendChartSeries {
  /** Stable key, unique within the chart. */
  id: string;
  /** Name in the tooltip and spoken summary: "Weight", "Daily", "7-day avg", "Resting". */
  name: string;
  /** Legend text when it differs from `name`: "Resting (kcal)". */
  legendLabel?: string;
  color: ChartColor;
  style?: TrendSeriesStyle;
  axis?: TrendAxisSide;
  /** Readings; only the last may be `partial` (today or this week). */
  points: readonly TrendChartPoint[];
  /** The metric formatter (`metricFormat.*`) for tooltips and the summary. */
  format: (value: number) => string;
  /** Leave the series out of the legend. */
  hideInLegend?: boolean;
  /**
   * A rolling average: the summary skips its own average. Defaults to
   * `style === "average"`; set it for a dotted `line` of 7-day averages.
   */
  rollingAverage?: boolean;
}

export interface TrendChartAxisOptions {
  /** Keep zero on the axis (counts, energy, net). Ignored for start-aligned pairs. */
  includeZero?: boolean;
  /** Unit after the top label: "72 kg". */
  unit?: string;
  /** Label notation (default `number`; `duration` for seconds). */
  format?: AxisValueFormat;
}

export interface TrendChartModelOptions {
  /** What the chart shows; opens the spoken summary ("Weight, daily readings and 7-day average"). */
  title: string;
  series: readonly TrendChartSeries[];
  /** Daily readings (default), weekly totals dated by their first day, or one point per session. */
  period?: SummaryPeriod;
  /** Plotted date range (time scale); defaults to the data's first and last dates. */
  domain?: { start: string; end: string };
  /** `time` (default) spaces points by date; `index` spaces them evenly (sessions). */
  xScale?: "time" | "index";
  xTicks?: "first-middle-last" | "first-last" | "none";
  axes?: { left?: TrendChartAxisOptions; right?: TrendChartAxisOptions };
  /** Replaces the generated spoken summary. */
  ariaLabel?: string;
  /** Sentence after the statistics; start-aligned charts get one by default. */
  summaryNote?: string;
  /** Shortest run of missing days the summary names (default 3; 0 turns it off). */
  minGapDays?: number;
  locale?: string;
}

export interface TrendChartEntry {
  seriesIndex: number;
  value: number;
  partial: boolean;
}

export interface TrendChartRow {
  /** Day number (time scale) or position (index scale). */
  x: number;
  date: string;
  sessionTime?: number;
  /** Plotted values by line key; null where the series has no reading. */
  values: Record<string, number | null>;
  /** What the tooltip lists for this observation. */
  entries: TrendChartEntry[];
}

export interface TrendLineModel {
  /** Data key of the complete readings. */
  key: string;
  /** Data key of the dashed segment to the partial point, when there is one. */
  partialKey: string | null;
  /** x of the partial point. */
  partialX: number | null;
  seriesIndex: number;
  series: TrendChartSeries;
  /** CSS colour: `var(--color-chart-1)`. */
  color: string;
  style: TrendSeriesStyle;
  axis: TrendAxisSide;
  /** Reading dot radius (0: no dots). */
  dotRadius: number;
  /** Complete readings plotted. */
  count: number;
}

export interface TrendAxisModel {
  side: TrendAxisSide;
  scale: ChartAxisScale;
  domain: [number, number];
  ticks: [number, number, number];
  /** Labels bottom first, the unit after the top one. */
  labels: [string, string, string];
  /** Pixel width for the labels. */
  width: number;
}

export interface TrendChartModel {
  rows: TrendChartRow[];
  lines: TrendLineModel[];
  axes: { left: TrendAxisModel | null; right: TrendAxisModel | null };
  startAligned: boolean;
  xDomain: [number, number];
  xTicks: { value: number; label: string; anchor: "start" | "middle" | "end" }[];
  /** The spoken summary for the chart's aria-label. */
  label: string;
  isEmpty: boolean;
}

/** Past this many readings, dots shrink. */
export const DENSE_POINTS = 31;

const DOT_RADIUS: Record<TrendSeriesStyle, [number, number]> = {
  line: [3, 1.8],
  daily: [2.5, 1.5],
  average: [0, 0],
};

export function chartColor(color: ChartColor): string {
  return `var(--color-${color})`;
}

interface SplitSeries {
  complete: TrendChartPoint[];
  partial: TrendChartPoint | null;
}

type PointKey = (point: TrendChartPoint) => string;

function comparePoints(left: TrendChartPoint, right: TrendChartPoint): number {
  return (
    left.date.localeCompare(right.date) ||
    (left.session?.startedAt ?? 0) - (right.session?.startedAt ?? 0) ||
    (left.session?.id ?? "").localeCompare(right.session?.id ?? "")
  );
}

/** Valid points in date order; only the last one's `partial` flag counts. */
function splitSeries(series: TrendChartSeries): SplitSeries {
  const valid = series.points
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(dayNumber(point.date)))
    .sort(comparePoints);
  const last = valid.at(-1);
  if (last?.partial) {
    return { complete: valid.slice(0, -1), partial: last };
  }
  return { complete: valid, partial: null };
}

function labelWidth(labels: readonly string[]) {
  const longest = Math.max(...labels.map((label) => label.length));
  return Math.max(Math.ceil(longest * 6.6) + 10, 24);
}

function buildAxis(
  side: TrendAxisSide,
  scale: ChartAxisScale,
  options: TrendChartAxisOptions | undefined,
  locale: string | undefined,
): TrendAxisModel {
  const labels = axisLabels(scale, { locale });
  if (options?.unit) {
    labels[2] = `${labels[2]} ${options.unit}`;
  }
  return {
    side,
    scale,
    domain: [scale.min, axisMax(scale)],
    ticks: axisTicks(scale),
    labels,
    width: labelWidth(labels),
  };
}

function axisValues(split: SplitSeries[], lines: readonly TrendChartSeries[], side: TrendAxisSide) {
  return split
    .flatMap((item, index) =>
      (lines[index]?.axis ?? "left") === side
        ? [...item.complete, ...(item.partial ? [item.partial] : [])]
        : [],
    )
    .sort(comparePoints)
    .map((point) => point.value);
}

function buildAxes(
  options: TrendChartModelOptions,
  split: SplitSeries[],
): { left: TrendAxisModel | null; right: TrendAxisModel | null; startAligned: boolean } {
  const left = axisValues(split, options.series, "left");
  const right = axisValues(split, options.series, "right");
  const { locale } = options;
  const aligned = startAlignedAxisScales(left, right);
  if (aligned) {
    return {
      left: buildAxis("left", aligned[0], options.axes?.left, locale),
      right: buildAxis("right", aligned[1], options.axes?.right, locale),
      startAligned: true,
    };
  }
  const scaleFor = (values: number[], axis: TrendChartAxisOptions | undefined) =>
    roundedAxisScale(values, {
      includeZero: axis?.includeZero ?? false,
      format: axis?.format ?? "number",
    });
  const leftScale = scaleFor(left, options.axes?.left);
  const rightScale = scaleFor(right, options.axes?.right);
  return {
    left: leftScale ? buildAxis("left", leftScale, options.axes?.left, locale) : null,
    right: rightScale ? buildAxis("right", rightScale, options.axes?.right, locale) : null,
    startAligned: false,
  };
}

function middleTick(start: number, end: number, options: TrendChartModelOptions) {
  const span = end - start;
  if ((options.xScale ?? "time") === "index") {
    return start + Math.floor(span / 2);
  }
  if (options.period === "week") {
    return start + Math.round(span / 14) * 7;
  }
  return start + Math.floor(span / 2);
}

function buildTicks(
  options: TrendChartModelOptions,
  xDomain: [number, number],
  dateAt: (x: number) => string,
): TrendChartModel["xTicks"] {
  const mode = options.xTicks ?? "first-middle-last";
  if (mode === "none") {
    return [];
  }
  const [start, end] = xDomain;
  const values = [start];
  const middle = middleTick(start, end, options);
  if (mode === "first-middle-last" && middle > start && middle < end) {
    values.push(middle);
  }
  if (end > start) {
    values.push(end);
  }
  return values.map((value, index) => {
    let anchor: "start" | "middle" | "end" = "middle";
    if (values.length > 1 && index === 0) {
      anchor = "start";
    } else if (values.length > 1 && index === values.length - 1) {
      anchor = "end";
    }
    return { value, label: formatChartDate(dateAt(value), { locale: options.locale }), anchor };
  });
}

function summaryNote(options: TrendChartModelOptions, startAligned: boolean): string | undefined {
  if (options.summaryNote !== undefined || !startAligned) {
    return options.summaryNote;
  }
  const names = (side: TrendAxisSide) =>
    options.series
      .filter((series) => (series.axis ?? "left") === side)
      .map((series) => series.name)
      .join(" and ");
  return `${names("left")} on the left axis, ${names("right")} on the right; both lines start at the same height.`;
}

interface XLayout {
  xDomain: [number, number];
  dateAt: (x: number) => string;
  rows: Map<string, TrendChartRow>;
}

function layoutX(options: TrendChartModelOptions, split: SplitSeries[], keyFor: PointKey): XLayout {
  const points = split
    .flatMap(({ complete, partial }) => (partial ? [...complete, partial] : complete))
    .sort(comparePoints);
  const positions = [...new Map(points.map((point) => [keyFor(point), point])).entries()];
  const rows = new Map<string, TrendChartRow>();
  if (options.xScale === "index") {
    positions.forEach(([key, { date, session }], index) => {
      rows.set(key, {
        x: index,
        date,
        ...(session ? { sessionTime: session.startedAt } : {}),
        values: {},
        entries: [],
      });
    });
    return {
      xDomain: [0, Math.max(positions.length - 1, 0)],
      dateAt: (x) => positions[Math.round(x)]?.[1].date ?? "",
      rows,
    };
  }
  const first = dayNumber(options.domain?.start ?? positions[0]?.[1].date ?? "");
  const last = dayNumber(options.domain?.end ?? positions.at(-1)?.[1].date ?? "");
  const xDomain: [number, number] = [
    Number.isFinite(first) ? first : 0,
    Number.isFinite(last) ? last : 0,
  ];
  for (const [key, { date }] of positions) {
    const x = dayNumber(date);
    if (x >= xDomain[0] && x <= xDomain[1]) {
      rows.set(key, { x, date, values: {}, entries: [] });
    }
  }
  return { xDomain, dateAt: dateFromDayNumber, rows };
}

function buildLine(
  series: TrendChartSeries,
  seriesIndex: number,
  { complete, partial }: SplitSeries,
  rows: Map<string, TrendChartRow>,
  keyFor: PointKey,
): TrendLineModel {
  const key = `s${seriesIndex}`;
  for (const point of complete) {
    const row = rows.get(keyFor(point));
    if (row) {
      row.values[key] = point.value;
      row.entries.push({ seriesIndex, value: point.value, partial: false });
    }
  }
  const partialRow = partial ? rows.get(keyFor(partial)) : undefined;
  let partialKey: string | null = null;
  if (partial && partialRow) {
    partialKey = `${key}p`;
    partialRow.values[partialKey] = partial.value;
    partialRow.entries.push({ seriesIndex, value: partial.value, partial: true });
    // The dashed segment starts at the last complete reading.
    const lastComplete = complete.at(-1);
    const anchorRow = lastComplete ? rows.get(keyFor(lastComplete)) : undefined;
    if (lastComplete && anchorRow) {
      anchorRow.values[partialKey] = lastComplete.value;
    }
  }
  const style = series.style ?? "line";
  const [radius, denseRadius] = DOT_RADIUS[style];
  return {
    key,
    partialKey,
    partialX: partialRow ? partialRow.x : null,
    seriesIndex,
    series,
    color: chartColor(series.color),
    style,
    axis: series.axis ?? "left",
    dotRadius: complete.length > DENSE_POINTS ? denseRadius : radius,
    count: complete.length,
  };
}

function chartLabel(options: TrendChartModelOptions, split: SplitSeries[], startAligned: boolean) {
  if (options.ariaLabel !== undefined) {
    return options.ariaLabel;
  }
  const note = summaryNote(options, startAligned);
  return summarizeChart({
    title: options.title,
    period: options.period ?? "day",
    series: options.series.map((series, index) => {
      const item = split[index];
      return {
        name: series.name,
        points: [...(item?.complete ?? []), ...(item?.partial ? [item.partial] : [])],
        format: series.format,
        rollingAverage: series.rollingAverage ?? (series.style ?? "line") === "average",
      };
    }),
    ...(note === undefined ? {} : { note }),
    ...(options.minGapDays === undefined ? {} : { minGapDays: options.minGapDays }),
    locale: options.locale,
  });
}

/** Everything <TrendChart> draws, from its props. */
export function buildTrendChartModel(options: TrendChartModelOptions): TrendChartModel {
  const keyFor: PointKey = (point) =>
    options.xScale === "index" && point.session ? `session:${point.session.id}` : point.date;
  const observations = options.series.map(splitSeries);
  const layout = layoutX(options, observations, keyFor);
  const { rows } = layout;
  // Only what is plotted feeds the axes and the spoken summary.
  const split = observations.map(({ complete, partial }) => ({
    complete: complete.filter((point) => rows.has(keyFor(point))),
    partial: partial && rows.has(keyFor(partial)) ? partial : null,
  }));
  const lines = options.series.map((series, index) =>
    buildLine(series, index, split[index] ?? { complete: [], partial: null }, rows, keyFor),
  );
  const axes = buildAxes(options, split);
  return {
    rows: [...rows.values()].sort((left, right) => left.x - right.x),
    lines,
    axes: { left: axes.left, right: axes.right },
    startAligned: axes.startAligned,
    xDomain: layout.xDomain,
    xTicks: buildTicks(options, layout.xDomain, layout.dateAt),
    label: chartLabel(options, split, axes.startAligned),
    isEmpty: rows.size === 0,
  };
}
