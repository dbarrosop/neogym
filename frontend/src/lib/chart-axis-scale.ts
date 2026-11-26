// A chart value axis with three labels (bottom, middle, top) on round
// values, as in the unified design: `0 · 6 · 12`, `20k · 40k · 60k`,
// `70 · 71 · 72`. Labels are bare numbers, units living in the chart's title
// and legend, except durations, which use the values' m:ss notation.
// Port of NeoGymKit `ChartAxisScale` (ios/NeoGym/Sources/NeoGymKit/ChartAxisScale.swift).

import { formatSecondsAsDuration } from "@/lib/cardio-schema";
import { MINUS } from "@/lib/metric-format";

/**
 * How a value axis prints its labels: the same notation as the series' values.
 * `number`: grouped numbers (`2,000`, `50k`). `duration`: seconds labelled
 * m:ss (h:mm:ss past an hour) on whole-minute ticks, never raw seconds.
 */
export type AxisValueFormat = "number" | "duration";

export interface ChartAxisScale {
  /** The bottom of the axis. */
  readonly min: number;
  /** The distance between labels; the axis spans two steps. */
  readonly step: number;
  readonly format: AxisValueFormat;
  /**
   * Start-aligned (less round) labels keep a fixed number of decimals so the
   * column reads evenly: 72.0 · 71.2 · 70.4 rather than 72 · 71.2 · 70.4.
   */
  readonly fixedDecimals?: boolean;
}

export function axisScale(
  min: number,
  step: number,
  format: AxisValueFormat = "number",
): ChartAxisScale {
  return { min, step, format };
}

export function axisMid(scale: ChartAxisScale): number {
  return scale.min + scale.step;
}

export function axisMax(scale: ChartAxisScale): number {
  return scale.min + 2 * scale.step;
}

/** The three labelled values, bottom first. */
export function axisTicks(scale: ChartAxisScale): [number, number, number] {
  return [scale.min, axisMid(scale), axisMax(scale)];
}

/** The smallest 1, 2, 2.5 or 5 × 10ⁿ that is at least `value`. */
export function niceStep(value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) {
    return 1;
  }
  const base = 10 ** Math.floor(Math.log10(value));
  const fraction = value / base;
  let nice = 10;
  if (fraction <= 1) {
    nice = 1;
  } else if (fraction <= 2) {
    nice = 2;
  } else if (fraction <= 2.5) {
    nice = 2.5;
  } else if (fraction <= 5) {
    nice = 5;
  }
  return nice * base;
}

const DURATION_MINUTE_STEPS = [1, 2, 5, 10, 15, 20, 30, 60];

/** A whole-minute duration step in seconds of at least `value`; hours beyond that. */
export function niceDurationStep(value: number): number {
  const minutes = DURATION_MINUTE_STEPS.map((minute) => minute * 60).find((step) => step >= value);
  return minutes ?? niceStep(value / 3_600) * 3_600;
}

function niceStepFor(value: number, format: AxisValueFormat): number {
  return format === "duration" ? niceDurationStep(value) : niceStep(value);
}

export interface RoundedAxisOptions {
  /** Keep zero on the axis: counts, energy and net values. */
  includeZero?: boolean;
  format?: AxisValueFormat;
}

/**
 * The smallest rounded axis containing `values` (and zero when
 * `includeZero`), or null when there are no finite values. Durations step in
 * whole minutes (1, 2, 5, 10, 15, 20, 30 or 60) or, past that, hours.
 */
export function roundedAxisScale(
  values: readonly number[],
  { includeZero = false, format = "number" }: RoundedAxisOptions = {},
): ChartAxisScale | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  let low = Math.min(...finite);
  let high = Math.max(...finite);
  if (includeZero) {
    low = Math.min(low, 0);
    high = Math.max(high, 0);
  }
  if (low === high) {
    const padding = Math.max(Math.abs(low) * 0.05, 1);
    if (!(includeZero && low === 0)) {
      low -= padding;
    }
    high += padding;
  }
  let step = niceStepFor((high - low) / 2, format);
  let bottom = Math.floor(low / step) * step;
  while (bottom + 2 * step < high) {
    step = niceStepFor(step * 1.000_1, format);
    bottom = Math.floor(low / step) * step;
  }
  return { min: bottom, step, format };
}

function spread(values: readonly number[], start: number) {
  return { below: start - Math.min(...values), above: Math.max(...values) - start };
}

/**
 * Scales for two measures sharing a chart on left and right axes (exercise
 * volume and Est. 1RM, weight and body fat): each fits its own data, and both
 * first values sit at the same height so their movement can be compared.
 * Values are in date order; the labels come out less round than
 * `roundedAxisScale` (4,770 · 3,660 · 2,560). Null unless both have a value.
 */
export function startAlignedAxisScales(
  first: readonly number[],
  second: readonly number[],
): [ChartAxisScale, ChartAxisScale] | null {
  const firstValues = first.filter((value) => Number.isFinite(value));
  const secondValues = second.filter((value) => Number.isFinite(value));
  const firstStart = firstValues[0];
  const secondStart = secondValues[0];
  if (firstStart === undefined || secondStart === undefined) {
    return null;
  }
  const firstSpread = spread(firstValues, firstStart);
  const secondSpread = spread(secondValues, secondStart);
  // Where each start falls within its own data, averaged, keeps both lines
  // using most of the height.
  const natural = [firstSpread, secondSpread].flatMap(({ below, above }) =>
    below + above > 0 ? [below / (below + above)] : [],
  );
  const average =
    natural.length === 0 ? 0.5 : natural.reduce((sum, value) => sum + value, 0) / natural.length;
  const fraction = Math.min(Math.max(average, 0.1), 0.9);
  const scale = (start: number, { below, above }: { below: number; above: number }) => {
    let range = Math.max(below / fraction, above / (1 - fraction));
    if (range <= 0) {
      range = Math.max(Math.abs(start) * 0.1, 1);
    }
    return { ...axisScale(start - fraction * range, range / 2), fixedDecimals: true };
  };
  return [scale(firstStart, firstSpread), scale(secondStart, secondSpread)];
}

const labelFormats = new Map<string, Intl.NumberFormat>();

function labelFormat(
  locale: string | undefined,
  decimals: number,
  grouping: boolean,
  fixed = false,
) {
  const key = `${locale ?? ""}|${decimals}|${grouping}|${fixed}`;
  let format = labelFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fixed ? decimals : 0,
      maximumFractionDigits: decimals,
      useGrouping: grouping,
    });
    labelFormats.set(key, format);
  }
  return format;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * An axis label: grouped digits (`2,000`), thousands as `k` for large
 * ticks when the step can be distinguished, and an explicit sign when the axis crosses zero (`+400`,
 * `−1,200`). Durations read `35:00`, and every label reads h:mm:ss once the
 * axis reaches an hour (`0:00:00 · 2:00:00 · 4:00:00`).
 */
export function axisLabel(
  scale: ChartAxisScale,
  value: number,
  { locale }: { locale?: string | undefined } = {},
): string {
  const max = axisMax(scale);
  if (scale.format === "duration") {
    const seconds = Math.max(Math.round(value), 0);
    if (max >= 3_600 && seconds < 3_600) {
      return `0:${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`;
    }
    return formatSecondsAsDuration(seconds);
  }
  const magnitude = Math.max(Math.abs(scale.min), Math.abs(max));
  const snapped = Math.abs(value) < scale.step * 1e-6 ? 0 : value;
  let digits: string;
  if (magnitude >= 10_000 && scale.step >= 100) {
    digits = `${labelFormat(locale, 1, false).format(Math.abs(snapped) / 1000)}k`;
  } else {
    // Start-aligned steps are not round: whole numbers from a step of 5.
    let decimals = 2;
    if (scale.step >= 5 || (scale.step >= 1 && Number.isInteger(scale.step))) {
      decimals = 0;
    } else if (scale.step >= 0.1) {
      decimals = 1;
    }
    // Compact steps smaller than 0.1k use full values. For very close
    // readings, keep enough decimal places to distinguish adjacent ticks.
    const precision = Math.min(20, Math.max(decimals, Math.ceil(-Math.log10(scale.step))));
    digits = labelFormat(locale, precision, true, scale.fixedDecimals).format(Math.abs(snapped));
  }
  if (snapped < 0 && digits !== "0") {
    return `${MINUS}${digits}`;
  }
  if (snapped > 0 && scale.min < 0) {
    return `+${digits}`;
  }
  return digits;
}

/** The three labels, bottom first. */
export function axisLabels(
  scale: ChartAxisScale,
  options: { locale?: string | undefined } = {},
): [string, string, string] {
  const [bottom, middle, top] = axisTicks(scale);
  return [
    axisLabel(scale, bottom, options),
    axisLabel(scale, middle, options),
    axisLabel(scale, top, options),
  ];
}
