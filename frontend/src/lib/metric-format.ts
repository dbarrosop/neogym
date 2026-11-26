// One formatter per metric, shared by chart tooltips, callouts, stat tiles
// and spoken summaries so a value reads the same everywhere. Axis labels use
// the same notation through `chart-axis-scale.ts`. Negative numbers use the
// minus sign U+2212, approximations read "≈ 2,312", and every formatter takes
// an optional locale (default: the browser's, like the rest of the app).

import { formatSecondsAsDuration } from "@/lib/cardio-schema";
import { localDateToDate } from "@/lib/nutrition";

/** U+2212, used for every negative number and delta. */
export const MINUS = "−";
/** "≈ " prefix for estimates. */
export const APPROX = "≈ ";

export interface NumberFormatOptions {
  /** Most fraction digits (default 0). */
  maxDecimals?: number;
  /** Fewest fraction digits (default 0). */
  minDecimals?: number;
  /** Group thousands (default true). */
  grouping?: boolean;
  /** Prefix "+" on positive values, as for deltas and net values. */
  signed?: boolean;
  locale?: string | undefined;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string | undefined, min: number, max: number, grouping: boolean) {
  const key = `${locale ?? ""}|${min}|${max}|${grouping}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: grouping,
    });
    numberFormats.set(key, format);
  }
  return format;
}

/**
 * A grouped number with U+2212 for negatives. A value that rounds to zero
 * prints unsigned ("0", "0.0"), never "−0" or "+0".
 */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const { maxDecimals = 0, grouping = true, signed = false, locale } = options;
  const minDecimals = Math.min(options.minDecimals ?? 0, maxDecimals);
  if (!Number.isFinite(value)) {
    return "—";
  }
  const rounded = Number(value.toFixed(maxDecimals));
  const digits = numberFormat(locale, minDecimals, maxDecimals, grouping).format(Math.abs(rounded));
  if (rounded < 0) {
    return `${MINUS}${digits}`;
  }
  return signed && rounded > 0 ? `+${digits}` : digits;
}

interface LocaleOption {
  locale?: string | undefined;
}

/** Kilograms: "70.85 kg" (at most `decimals` fraction digits, default 2). */
export function formatKg(
  value: number,
  {
    decimals = 2,
    minDecimals = 0,
    locale,
  }: LocaleOption & { decimals?: number; minDecimals?: number } = {},
): string {
  return `${formatNumber(value, { maxDecimals: decimals, minDecimals, locale })} kg`;
}

/** Percent with a space, as on the boards: "12.6 %" (fixed `decimals`, default 1). */
export function formatPercent(
  value: number,
  { decimals = 1, locale }: LocaleOption & { decimals?: number } = {},
): string {
  return `${formatNumber(value, { maxDecimals: decimals, minDecimals: decimals, locale })} %`;
}

/** Whole kilocalories without the unit: "2,370". */
export function formatKcalNumber(value: number, { locale }: LocaleOption = {}): string {
  return formatNumber(value, { locale });
}

/** Whole kilocalories: "2,370 kcal". */
export function formatKcal(value: number, { locale }: LocaleOption = {}): string {
  return `${formatKcalNumber(value, { locale })} kcal`;
}

/** Net or balance kilocalories with an explicit sign: "−371 kcal", "+251 kcal", "0 kcal". */
export function formatSignedKcal(value: number, { locale }: LocaleOption = {}): string {
  return `${formatNumber(value, { signed: true, locale })} kcal`;
}

/**
 * Compact volume, as on axes and weekly totals: "48.6k" from 10,000 up
 * (one decimal at most, no grouping), grouped whole numbers below ("3,500").
 */
export function formatCompact(value: number, { locale }: LocaleOption = {}): string {
  if (Math.abs(value) >= 10_000) {
    return `${formatNumber(value / 1000, { maxDecimals: 1, grouping: false, locale })}k`;
  }
  return formatNumber(value, { locale });
}

/** Weighted sets, where a secondary muscle counts half: "11.5", "12". */
export function formatSets(value: number, { locale }: LocaleOption = {}): string {
  return formatNumber(value, { maxDecimals: 1, locale });
}

/**
 * A signed change with fixed decimals: "−1.0", "+0.4", and "0.0" (unsigned)
 * when it rounds to zero. Callers add the unit or context ("vs prior 7 days").
 */
export function formatSignedDelta(
  value: number,
  { decimals = 1, locale }: LocaleOption & { decimals?: number } = {},
): string {
  return formatNumber(value, {
    maxDecimals: decimals,
    minDecimals: decimals,
    signed: true,
    locale,
  });
}

/** An estimate: "≈ 2,312 kcal" from an already formatted value. */
export function formatApprox(formatted: string): string {
  return `${APPROX}${formatted}`;
}

/** Seconds as m:ss, or h:mm:ss from an hour: "35:00", "1:02:03". */
export function formatDuration(seconds: number): string {
  return formatSecondsAsDuration(seconds);
}

/** A formatter that turns a metric's value into display text with its unit. */
export type MetricFormatter = (value: number) => string;

/**
 * The formatter for each charted metric. Weight readings keep two decimals
 * (scales report 70.85); weight and body-fat averages and changes keep one.
 */
export const metricFormat = {
  /** A weight reading: "70.85 kg". */
  weight: (value: number) => formatKg(value, { decimals: 2 }),
  /** A 7-day average weight: "70.7 kg". */
  weightAverage: (value: number) => formatKg(value, { decimals: 1, minDecimals: 1 }),
  /** Body fat, reading or average: "12.6 %". */
  bodyFat: (value: number) => formatPercent(value),
  /** Energy or intake: "2,370 kcal". */
  kcal: (value: number) => formatKcal(value),
  /** Net calories (consumed − burned): "−371 kcal". */
  netKcal: (value: number) => formatSignedKcal(value),
  /** A session's strength volume: "3,500 kg". */
  volume: (value: number) => `${formatNumber(value)} kg`,
  /** Weekly strength volume, compact: "48.6k". */
  weeklyVolume: (value: number) => formatCompact(value),
  /** Estimated one-rep max: "166.7 kg". */
  estimatedOneRepMax: (value: number) => formatKg(value, { decimals: 1 }),
  /** Weighted sets: "11.5". */
  sets: (value: number) => formatSets(value),
  /** Cardio duration: "35:00". */
  duration: (value: number) => formatDuration(value),
} satisfies Record<string, MetricFormatter>;

// ---------------------------------------------------------------------------
// Dates

export interface DateFormatOptions extends LocaleOption {
  /** Include the weekday: "Thu 12 Nov". */
  weekday?: boolean;
  /** Include the year: "12 Nov 2026". */
  year?: boolean;
  /** Month style (default "short"). */
  month?: "short" | "long";
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const RANGE_DASH = /[\u2013\u2014-]/;
const RANGE_SEPARATOR = /\s*[\u2013\u2014-]\s*/;

function dateFormat(options: DateFormatOptions) {
  const key = `${options.locale ?? ""}|${options.weekday}|${options.year}|${options.month}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(options.locale, {
      day: "numeric",
      month: options.month ?? "short",
      ...(options.weekday ? { weekday: "short" } : {}),
      ...(options.year ? { year: "numeric" } : {}),
    });
    dateFormats.set(key, format);
  }
  return format;
}

/** A chart date label for a local date (YYYY-MM-DD): "12 Nov" (en-GB), "Nov 12" (en-US). */
export function formatChartDate(date: string, options: DateFormatOptions = {}): string {
  const parsed = localDateToDate(date);
  return parsed ? dateFormat(options).format(parsed) : date;
}

/** A week by its first date: "Week of 21 Sep". */
export function formatWeekOf(date: string, options: DateFormatOptions = {}): string {
  return `Week of ${formatChartDate(date, options)}`;
}

/**
 * An inclusive date range in words: "2 to 6 November", "30 October to 2
 * November", or one date ("4 November"). Locale-ordered via Intl ranges.
 */
export function formatDateRange(
  start: string,
  end: string,
  options: DateFormatOptions = { month: "long" },
): string {
  const from = localDateToDate(start);
  const to = localDateToDate(end);
  if (!from || !to) {
    return start === end ? start : `${start} to ${end}`;
  }
  const format = dateFormat({ month: "long", ...options });
  if (start === end) {
    return format.format(from);
  }
  let joined = false;
  return format
    .formatRangeToParts(from, to)
    .map((part, index, parts) => {
      const between =
        !joined &&
        part.type === "literal" &&
        parts[index - 1]?.source === "startRange" &&
        parts.slice(index + 1).some((next) => next.source === "endRange");
      if (between && RANGE_DASH.test(part.value)) {
        joined = true;
        return part.value.replace(RANGE_SEPARATOR, " to ");
      }
      return part.value;
    })
    .join("");
}
