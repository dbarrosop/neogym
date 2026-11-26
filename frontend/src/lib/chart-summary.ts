// Spoken chart summaries (the chart's aria-label), as in the design's chart
// rules: lowest, highest, average and latest cover complete periods only. A
// partial current period (today, or this week) is left out of them and named
// last ("Today so far: 1,461 kcal.", naming series only when several are
// partial). A rolling-average series reports no average of its own: an
// average of averages adds nothing. Interior runs of days without readings
// are named, since the line joins straight across them.
// Port of NeoGymKit `ChartAccessibilitySummary`, framed with the chart's title
// like the web boards ("Weight, daily readings and 7-day average, 14 Oct to
// 12 Nov: …").

import { formatChartDate, formatDateRange } from "@/lib/metric-format";
import { dateFromDayNumber, dayNumber, type TrendPoint } from "@/lib/rolling-average";

/**
 * What one point stands for. `day`: daily readings, whose interior gaps are
 * named and whose partial point is today. `week`: weeks dated by their first
 * day, partial "this week". `session`: one point per workout session, read
 * like days but without gaps.
 */
export type SummaryPeriod = "day" | "week" | "session";

export interface SummarySeries {
  /** "Weight", "Daily", "7-day avg", "Resting". */
  name: string;
  /** Points in any order; nulls and non-finite values are skipped. */
  points: readonly TrendPoint[];
  /** The metric's formatter: "70.85 kg". */
  format: (value: number) => string;
  /** A 7-day (or other rolling) average: its summary leaves out "average". */
  rollingAverage?: boolean;
}

export interface ChartSummaryOptions {
  /** What the chart shows: "Weight, daily readings and 7-day average". */
  title: string;
  series: readonly SummarySeries[];
  /** Daily points (default), weekly points dated by their first day, or sessions. */
  period?: SummaryPeriod;
  /** A sentence placed after the statistics ("Both lines start at the same height."). */
  note?: string;
  /** Name runs of at least this many days without readings (default 3; 0 turns it off). */
  minGapDays?: number;
  /** Gaps named before "and N more" (default 3). */
  maxGaps?: number;
  locale?: string | undefined;
}

function completePoints(series: SummarySeries) {
  return series.points
    .filter((point) => !point.partial && Number.isFinite(point.value))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function seriesStats(
  series: SummarySeries,
  period: SummaryPeriod,
  formatDate: (date: string) => string,
): string | null {
  const values = completePoints(series);
  const latest = values.at(-1);
  if (!latest) {
    return null;
  }
  const latestDate =
    period === "week"
      ? `in the week of ${formatDate(latest.date)}`
      : `on ${formatDate(latest.date)}`;
  const latestText = `latest ${series.format(latest.value)} ${latestDate}`;
  if (values.length === 1) {
    return latestText;
  }
  const numbers = values.map((point) => point.value);
  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  const averageText = series.rollingAverage ? "" : `average ${series.format(average)}, `;
  return `lowest ${series.format(Math.min(...numbers))}, highest ${series.format(
    Math.max(...numbers),
  )}, ${averageText}${latestText}`;
}

function rangeText(
  first: string,
  last: string,
  period: SummaryPeriod,
  formatDate: (date: string) => string,
) {
  const start = formatDate(first);
  const end = formatDate(last);
  if (period === "week") {
    return start === end ? `week of ${start}` : `weeks of ${start} to ${end}`;
  }
  return start === end ? `on ${start}` : `${start} to ${end}`;
}

/** Interior runs of at least `minDays` dates with no reading in any of `series`. */
export function readingGaps(
  series: readonly SummarySeries[],
  minDays = 3,
): { start: string; end: string; days: number }[] {
  if (minDays <= 0) {
    return [];
  }
  const readings = series.some((item) => !item.rollingAverage)
    ? series.filter((item) => !item.rollingAverage)
    : series;
  const days = [
    ...new Set(readings.flatMap((item) => completePoints(item).map((p) => dayNumber(p.date)))),
  ]
    .filter((day) => Number.isFinite(day))
    .sort((left, right) => left - right);
  const gaps: { start: string; end: string; days: number }[] = [];
  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1] ?? 0;
    const missing = (days[index] ?? 0) - previous - 1;
    if (missing >= minDays) {
      gaps.push({
        start: dateFromDayNumber(previous + 1),
        end: dateFromDayNumber(previous + missing),
        days: missing,
      });
    }
  }
  return gaps;
}

function gapSentence(options: ChartSummaryOptions): string | null {
  if ((options.period ?? "day") !== "day") {
    return null;
  }
  const gaps = readingGaps(options.series, options.minGapDays ?? 3);
  if (gaps.length === 0) {
    return null;
  }
  const maxGaps = Math.max(options.maxGaps ?? 3, 1);
  const named = gaps
    .slice(0, maxGaps)
    .map((gap) => formatDateRange(gap.start, gap.end, { month: "long", locale: options.locale }));
  const more = gaps.length - named.length;
  const list =
    more > 0
      ? `${named.join(", ")} and ${more} more ${more === 1 ? "gap" : "gaps"}`
      : `${named.slice(0, -1).join(", ")}${named.length > 1 ? " and " : ""}${named.at(-1)}`;
  const lines = options.series.length > 1 ? "the lines join" : "the line joins";
  return `No readings ${list}; ${lines} across ${gaps.length === 1 ? "the gap" : "the gaps"}.`;
}

/**
 * One closing sentence for the partial period: "Today so far: 1,461 kcal."
 * A lone partial series goes unnamed; several are named ("Today so far:
 * Resting 679 kcal, Active 531 kcal.").
 */
function partialSentence(series: readonly SummarySeries[], period: SummaryPeriod) {
  const partials = series.flatMap((item) => {
    const partial = item.points.findLast((point) => point.partial && Number.isFinite(point.value));
    return partial ? [{ name: item.name, value: item.format(partial.value) }] : [];
  });
  const first = partials[0];
  if (!first) {
    return null;
  }
  const title = period === "week" ? "This week so far" : "Today so far";
  if (partials.length === 1) {
    return `${title}: ${first.value}.`;
  }
  return `${title}: ${partials.map((item) => `${item.name} ${item.value}`).join(", ")}.`;
}

/**
 * The chart's spoken summary. One series reads inline ("Consumed per day, 14
 * Oct to 11 Nov: lowest 2,140 kcal, highest 2,584 kcal, average 2,370 kcal,
 * latest 2,386 kcal on 11 Nov. Today so far: 1,461 kcal."); several are
 * named in turn ("…, 14 Oct to 11 Nov. Resting: lowest …. Active: …").
 */
export function summarizeChart(options: ChartSummaryOptions): string {
  const period = options.period ?? "day";
  const formatDate = (date: string) => formatChartDate(date, { locale: options.locale });
  const complete = options.series
    .flatMap((series) => completePoints(series))
    .sort((left, right) => left.date.localeCompare(right.date));
  const first = complete[0];
  const last = complete.at(-1);
  const sentences: string[] = [];
  if (first && last) {
    const range = rangeText(first.date, last.date, period, formatDate);
    const stats = options.series.map((series) => ({
      name: series.name,
      text: seriesStats(series, period, formatDate),
    }));
    const only = stats[0];
    if (options.series.length === 1 && only?.text) {
      sentences.push(`${options.title}, ${range}: ${only.text}.`);
    } else {
      sentences.push(`${options.title}, ${range}.`);
      for (const item of stats) {
        if (item.text) {
          sentences.push(`${item.name}: ${item.text}.`);
        }
      }
    }
    if (options.note) {
      sentences.push(options.note);
    }
    const gaps = gapSentence(options);
    if (gaps) {
      sentences.push(gaps);
    }
  } else {
    sentences.push(`${options.title}.`);
  }
  const partial = partialSentence(options.series, period);
  if (partial) {
    sentences.push(partial);
  } else if (!(first && last)) {
    sentences.push("No readings in this period.");
  }
  return sentences.join(" ");
}
