// Calories consumed and net (consumed − energy out) per day, each with a
// trailing 7-day average, for Progress › Energy and Overview. Today is
// partial: its consumed total is a separate point (an open dot), net leaves it
// out, and neither average counts it. A day with no food logged has no
// reading, so an unlogged day neither shows as zero nor drags an average; net
// also needs that day's daily_energy row. Totals come from logged snapshot
// kcal (grams × snapshotKcalPer100g / 100), never live foods.
// Mirrors NeoGymKit `CalorieTrend` / `NutritionCalorieHistory`.

import type { DailyEnergyRow } from "@/lib/energy-trend";
import { normalizeNumeric } from "@/lib/nutrition";
import {
  type DatedValue,
  dayNumber,
  mean,
  numericOrNull,
  rollingAverage,
  type TrendPoint,
  withinWindow,
  withPartial,
} from "@/lib/rolling-average";

/** The calorie-history query shape: logged snapshot entries and energy rows. */
export interface CalorieHistoryData {
  nutritionDays: readonly {
    logDate: string;
    nutritionLogEntries: readonly { grams?: unknown; snapshotKcalPer100g?: unknown }[];
  }[];
  dailyEnergyEntries: readonly DailyEnergyRow[];
}

export interface CalorieNetWindow {
  /** The last full day with a net value. */
  end: string;
  /** Full days with food logged and energy recorded in the 7 days ending on `end`. */
  days: number;
  consumed: number;
  burned: number;
  /** consumed − burned; equals the latest net 7-day average. */
  net: number;
}

export interface CalorieTrend {
  /** Full days in the window with food logged, oldest first. */
  consumed: DatedValue[];
  /** At each consumed day, the mean of full consumed days in the 7 dates ending on it. */
  consumedAverage: DatedValue[];
  /** Today's intake so far, when today is in the window and has food logged. */
  consumedToday: DatedValue | null;
  /** `consumed` plus today's partial point, ready to plot. */
  consumedPoints: TrendPoint[];
  /** Full days in the window with food logged and an energy row: consumed − (active + resting). */
  net: DatedValue[];
  /** At each net day, the mean of full net days in the 7 dates ending on it. */
  netAverage: DatedValue[];
  latestConsumedAverage: number | null;
  latestNetAverage: number | null;
  /** Consumed, burned and net per day over the days behind the latest net average (they add up). */
  latestNetWindow: CalorieNetWindow | null;
  /** No food logged in the window, today included. */
  isEmpty: boolean;
}

export interface CalorieTrendOptions {
  /** Today's local date: partial, and out of every average. */
  today: string;
  /** First plotted date. Fetch from six days earlier for full averages. */
  start: string;
  /** Last plotted date (default `today`). */
  end?: string;
}

/** Logged kilocalories per date (grams × snapshot kcal per 100 g). */
export function dailyConsumedKcal(data: Pick<CalorieHistoryData, "nutritionDays">) {
  const totals = new Map<string, number>();
  for (const day of data.nutritionDays) {
    const kcal = day.nutritionLogEntries.reduce(
      (sum, entry) =>
        sum + (normalizeNumeric(entry.grams) * normalizeNumeric(entry.snapshotKcalPer100g)) / 100,
      0,
    );
    totals.set(day.logDate, (totals.get(day.logDate) ?? 0) + kcal);
  }
  return totals;
}

function energyOutByDate(rows: readonly DailyEnergyRow[]) {
  const out = new Map<string, number>();
  for (const row of rows) {
    const active = numericOrNull(row.activeKcal);
    const resting = numericOrNull(row.restingKcal);
    if ((active !== null || resting !== null) && !out.has(row.energyOn)) {
      out.set(row.energyOn, (active ?? 0) + (resting ?? 0));
    }
  }
  return out;
}

function last7(points: readonly DatedValue[], end: string) {
  const first = dayNumber(end) - 6;
  return points.filter((point) => point.date <= end && dayNumber(point.date) >= first);
}

/** The calorie trend for a chart window from the calorie-history query. */
export function buildCalorieTrend(
  data: CalorieHistoryData,
  options: CalorieTrendOptions,
): CalorieTrend {
  const { today, start } = options;
  const end = options.end ?? today;
  const out = energyOutByDate(data.dailyEnergyEntries);
  const logged = [...dailyConsumedKcal(data)]
    .filter(([date, kcal]) => kcal > 0 && Number.isFinite(dayNumber(date)))
    .map(([date, value]) => ({ date, value }))
    .sort((left, right) => left.date.localeCompare(right.date));
  // Full days (before today), warm-up days included, feed the averages.
  const fullConsumed = logged.filter((point) => point.date < today && point.date <= end);
  const fullNet = fullConsumed.flatMap((point) => {
    const burned = out.get(point.date);
    return burned === undefined ? [] : [{ date: point.date, value: point.value - burned }];
  });
  const consumed = withinWindow(fullConsumed, start, end);
  const net = withinWindow(fullNet, start, end);
  const consumedAverage = withinWindow(rollingAverage(fullConsumed), start, end);
  const netAverage = withinWindow(rollingAverage(fullNet), start, end);
  const todayPoint =
    today >= start && today <= end ? (logged.find((point) => point.date === today) ?? null) : null;

  let latestNetWindow: CalorieNetWindow | null = null;
  const lastNet = net.at(-1);
  if (lastNet) {
    const days = last7(fullNet, lastNet.date);
    const consumedByDate = new Map(fullConsumed.map((point) => [point.date, point.value]));
    const consumedMean = mean(days.map((day) => consumedByDate.get(day.date) ?? 0)) ?? 0;
    const netMean = mean(days.map((day) => day.value)) ?? 0;
    latestNetWindow = {
      end: lastNet.date,
      days: days.length,
      consumed: consumedMean,
      burned: consumedMean - netMean,
      net: netMean,
    };
  }

  return {
    consumed,
    consumedAverage,
    consumedToday: todayPoint,
    consumedPoints: withPartial(consumed, todayPoint),
    net,
    netAverage,
    latestConsumedAverage: consumedAverage.at(-1)?.value ?? null,
    latestNetAverage: netAverage.at(-1)?.value ?? null,
    latestNetWindow,
    isEmpty: consumed.length === 0 && todayPoint === null,
  };
}
