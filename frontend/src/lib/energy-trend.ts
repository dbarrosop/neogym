// Energy out for Progress › Energy: resting and active energy per day in a
// chart window, with today as the partial period (an open dot after a dashed
// segment), and "Average out" over the window's full days. Today stays out
// of every average. A missing component on an existing row is no reading on
// the chart but counts as zero in the totals, so resting + active = out.
// See docs/developers/energy.md.

import {
  dayNumber,
  mean,
  numericOrNull,
  type TrendPoint,
  withinWindow,
} from "@/lib/rolling-average";

/** A daily_energy row as the GraphQL queries return it. */
export interface DailyEnergyRow {
  energyOn: string;
  activeKcal?: unknown;
  restingKcal?: unknown;
}

export interface EnergyDay {
  date: string;
  resting: number | null;
  active: number | null;
  /** resting + active, a missing component counting as zero. */
  total: number;
}

export interface EnergyTrend {
  /** Resting energy per day in the window; today's point is partial. */
  resting: TrendPoint[];
  /** Active energy per day in the window; today's point is partial. */
  active: TrendPoint[];
  /** Total energy out per day in the window; today's point is partial. */
  total: TrendPoint[];
  /** Mean energy out per full day with a row in the window ("Average out"). */
  averageOut: number | null;
  /** Mean resting energy over the same full days. */
  averageResting: number | null;
  /** Mean active energy over the same full days. */
  averageActive: number | null;
  /** Full days behind the averages ("29 full days"). */
  fullDayCount: number;
  /** Today's row so far, when today is in the window and has a row. */
  today: EnergyDay | null;
  /** Every day with a row in the window, oldest first. */
  days: EnergyDay[];
}

export interface EnergyTrendOptions {
  /** Today's local date: its row is partial. */
  today: string;
  /** First plotted date. */
  start: string;
  /** Last plotted date (default `today`). */
  end?: string;
}

function toDay(row: DailyEnergyRow): EnergyDay | null {
  const resting = numericOrNull(row.restingKcal);
  const active = numericOrNull(row.activeKcal);
  if ((resting === null && active === null) || !Number.isFinite(dayNumber(row.energyOn))) {
    return null;
  }
  return { date: row.energyOn, resting, active, total: (resting ?? 0) + (active ?? 0) };
}

function series(
  days: readonly EnergyDay[],
  today: string,
  pick: (day: EnergyDay) => number | null,
) {
  return days.flatMap((day): TrendPoint[] => {
    const value = pick(day);
    if (value === null) {
      return [];
    }
    return day.date === today
      ? [{ date: day.date, value, partial: true }]
      : [{ date: day.date, value }];
  });
}

/** Energy out for a chart window from daily_energy rows (any order; one per date). */
export function buildEnergyTrend(
  rows: readonly DailyEnergyRow[],
  options: EnergyTrendOptions,
): EnergyTrend {
  const { today, start } = options;
  const end = options.end ?? today;
  const byDate = new Map<string, EnergyDay>();
  for (const row of rows) {
    const day = toDay(row);
    if (day && day.date <= today && !byDate.has(day.date)) {
      byDate.set(day.date, day);
    }
  }
  const days = withinWindow([...byDate.values()], start, end).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const full = days.filter((day) => day.date < today);
  return {
    resting: series(days, today, (day) => day.resting),
    active: series(days, today, (day) => day.active),
    total: series(days, today, (day) => day.total),
    averageOut: mean(full.map((day) => day.total)),
    averageResting: mean(full.map((day) => day.resting ?? 0)),
    averageActive: mean(full.map((day) => day.active ?? 0)),
    fullDayCount: full.length,
    today: days.find((day) => day.date === today) ?? null,
    days,
  };
}
