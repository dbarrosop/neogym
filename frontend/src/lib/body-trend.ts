// Weight and body fat for Today, Progress › Overview and Progress › Body:
// each metric's readings in a chart window, the trailing 7-day average at each
// reading (fed by warm-up readings before the window), the latest reading,
// and the average of the last seven local days against the seven before.
// Mirrors NeoGymKit `BodyTrendSummary` / `BodyMetricTrend` (TodaySummary.swift).

import { addLocalDateDays } from "@/lib/nutrition";
import {
  type DatedValue,
  mean,
  numericOrNull,
  rollingAverage,
  withinWindow,
} from "@/lib/rolling-average";

/** A body measurement row as the GraphQL queries return it. */
export interface BodyMeasurementRow {
  measuredOn: string;
  weightKg?: unknown;
  bodyFatPct?: unknown;
}

export interface BodyMetricTrend {
  /** Readings dated within the window, oldest first. */
  readings: DatedValue[];
  /**
   * At each reading in the window, the mean of the readings dated within the
   * seven local days ending on it, warm-up readings before the window included.
   */
  rollingAverage: DatedValue[];
  /** The newest reading on or before the window's end, even before the window. */
  latest: DatedValue | null;
  /** Mean of the readings dated today and the six days before. */
  weekAverage: number | null;
  /** Mean of the readings dated 7 to 13 days before today. */
  priorWeekAverage: number | null;
  /** `weekAverage − priorWeekAverage`; shown neutral (no weight goal). */
  weekChange: number | null;
}

export interface BodyTrend {
  weight: BodyMetricTrend;
  bodyFat: BodyMetricTrend;
  /** No reading of either metric in the window. */
  isEmpty: boolean;
}

export interface BodyTrendOptions {
  /** Today's local date: the 7-day average and its change end here. */
  today: string;
  /** First plotted date. Fetch from six days earlier for full averages. */
  start: string;
  /** Last plotted date (default `today`). */
  end?: string;
}

function metricTrend(readings: DatedValue[], options: BodyTrendOptions): BodyMetricTrend {
  const { today, start } = options;
  const end = options.end ?? today;
  const upToEnd = readings.filter((reading) => reading.date <= end);
  const weekStart = addLocalDateDays(today, -6);
  const priorStart = addLocalDateDays(today, -13);
  const weekAverage = mean(
    withinWindow(readings, weekStart, today).map((reading) => reading.value),
  );
  const priorWeekAverage = mean(
    readings
      .filter((reading) => reading.date >= priorStart && reading.date < weekStart)
      .map((reading) => reading.value),
  );
  return {
    readings: withinWindow(upToEnd, start, end),
    rollingAverage: withinWindow(rollingAverage(upToEnd), start, end),
    latest: upToEnd.at(-1) ?? null,
    weekAverage,
    priorWeekAverage,
    weekChange:
      weekAverage === null || priorWeekAverage === null ? null : weekAverage - priorWeekAverage,
  };
}

function readingsOf(
  rows: readonly BodyMeasurementRow[],
  pick: (row: BodyMeasurementRow) => unknown,
) {
  return rows
    .flatMap((row) => {
      const value = numericOrNull(pick(row));
      return value === null ? [] : [{ date: row.measuredOn, value }];
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Both body metrics from measurement rows (any order). The metrics are
 * independent, so a body-fat-only reading still shows.
 */
export function buildBodyTrend(
  rows: readonly BodyMeasurementRow[],
  options: BodyTrendOptions,
): BodyTrend {
  const weight = metricTrend(
    readingsOf(rows, (row) => row.weightKg),
    options,
  );
  const bodyFat = metricTrend(
    readingsOf(rows, (row) => row.bodyFatPct),
    options,
  );
  return {
    weight,
    bodyFat,
    isEmpty: weight.readings.length === 0 && bodyFat.readings.length === 0,
  };
}
