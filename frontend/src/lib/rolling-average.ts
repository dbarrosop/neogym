// Shared trend helpers for charts: dated values on local calendar dates
// (YYYY-MM-DD), chart windows with rolling-average warm-up days, and the
// trailing 7-day mean the charts draw over daily readings.

import { addLocalDateDays, isValidLocalDate } from "@/lib/nutrition";

/** One value on a local calendar date (YYYY-MM-DD). */
export interface DatedValue {
  date: string;
  value: number;
}

/**
 * A plotted reading. `partial` marks the current, unfinished period (today or
 * this week): charts draw it as an open dot after a dashed segment, and it
 * stays out of averages and spoken statistics. Only a series' last point can
 * be partial.
 */
export interface TrendPoint extends DatedValue {
  partial?: boolean;
}

/** Days in a rolling average. */
export const ROLLING_WINDOW_DAYS = 7;
/** Days fetched before a chart window so its first 7-day averages are full. */
export const WARM_UP_DAYS = ROLLING_WINDOW_DAYS - 1;

/** An inclusive chart window and the earlier date to fetch from for its rolling averages. */
export interface ChartWindow {
  /** First plotted date. */
  start: string;
  /** Last plotted date (usually today). */
  end: string;
  /** `start` minus the six warm-up days. */
  fetchFrom: string;
}

/** The last `days` local dates ending on `end` (30 → 14 Oct to 12 Nov), plus warm-up. */
export function chartWindow(days: number, end: string): ChartWindow {
  const start = addLocalDateDays(end, -Math.max(Math.floor(days) - 1, 0));
  return { start, end, fetchFrom: addLocalDateDays(start, -WARM_UP_DAYS) };
}

/** A window from an explicit first date (an "All" period), plus warm-up. */
export function chartWindowFrom(start: string, end: string): ChartWindow {
  return { start, end, fetchFrom: addLocalDateDays(start, -WARM_UP_DAYS) };
}

const MS_PER_DAY = 86_400_000;

/**
 * Days since 1970-01-01 for a local date, independent of time zone and DST,
 * so date arithmetic and chart x positions stay whole numbers. NaN when invalid.
 */
export function dayNumber(date: string): number {
  if (!isValidLocalDate(date)) {
    return Number.NaN;
  }
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / MS_PER_DAY;
}

/** The local date for a `dayNumber`. */
export function dateFromDayNumber(value: number): string {
  return new Date(Math.round(value) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The mean of `values`, or null when there are none. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** A finite number from a GraphQL numeric (number or string), or null when missing. */
export function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().replace(",", ".");
    if (trimmed === "") {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * At each point, the mean of the points dated within the `days` local dates
 * ending on it (a trailing 7-day average by default). Output is sorted by
 * date with one value per input point; days without a point are not zero.
 */
export function rollingAverage(points: readonly DatedValue[], days = ROLLING_WINDOW_DAYS) {
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(dayNumber(point.date)))
    .sort((left, right) => left.date.localeCompare(right.date));
  const averages: DatedValue[] = [];
  let windowStart = 0;
  let sum = 0;
  for (const [index, point] of sorted.entries()) {
    sum += point.value;
    const first = dayNumber(point.date) - (days - 1);
    while (dayNumber(sorted[windowStart]?.date ?? point.date) < first) {
      sum -= sorted[windowStart]?.value ?? 0;
      windowStart += 1;
    }
    averages.push({ date: point.date, value: sum / (index - windowStart + 1) });
  }
  return averages;
}

/** The points dated within `start`..`end` inclusive. */
export function withinWindow<T extends { date: string }>(
  points: readonly T[],
  start: string,
  end: string,
): T[] {
  return points.filter((point) => point.date >= start && point.date <= end);
}

/** Complete points followed by the current period's partial value, if any. */
export function withPartial(
  complete: readonly DatedValue[],
  partial: DatedValue | null | undefined,
): TrendPoint[] {
  return partial ? [...complete, { ...partial, partial: true }] : [...complete];
}
