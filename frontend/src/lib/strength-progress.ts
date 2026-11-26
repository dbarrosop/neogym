// Progress › Strength and the Overview Strength card, from `strengthProgress`
// rows (one server-aggregated point per session and exercise, never raw
// sets): weekly volume in Monday weeks with this week partial, and volume and
// estimated one-rep max per exercise logged in the last ten local dates.
// Mirrors NeoGymKit `StrengthProgressBuilder` / `StrengthWeeklyOverview`.

import { metricFormat } from "@/lib/metric-format";
import { addLocalDateDays, formatLocalDate } from "@/lib/nutrition";
import {
  dateFromDayNumber,
  dayNumber,
  numericOrNull,
  type TrendPoint,
} from "@/lib/rolling-average";

/** A `strengthProgress` row as the GraphQL query returns it. */
export interface StrengthProgressRow {
  exerciseId: string;
  sessionId: string;
  startedAt: string;
  volume?: unknown;
  estimatedOneRepMax?: unknown;
  exercise?: { id: string; name: string } | null;
}

/** Exercises logged on today or the nine local dates before it get their own card. */
export const RECENT_EXERCISE_DAYS = 10;

/** The Monday that starts the week of a local date (YYYY-MM-DD). */
export function weekStartOf(date: string): string {
  const day = dayNumber(date);
  if (!Number.isFinite(day)) {
    return date;
  }
  // Day 0 (1 Jan 1970) was a Thursday, three days after a Monday.
  return dateFromDayNumber(day - ((((day + 3) % 7) + 7) % 7));
}

/**
 * The first date of a `weeks`-week period ending with the current week: the
 * Monday `weeks − 1` weeks before this week's, so every week is complete
 * except the current one.
 */
export function strengthPeriodStart(today: string, weeks: number): string {
  return addLocalDateDays(weekStartOf(today), -7 * Math.max(Math.floor(weeks) - 1, 0));
}

/** The local date a session started on. */
export function sessionDay(startedAt: string): string | null {
  const date = new Date(startedAt);
  return Number.isNaN(date.getTime()) ? null : formatLocalDate(date);
}

/** Weekly volume in tooltips and spoken summaries: "48.6k kg". */
export function weeklyVolumeLabel(value: number): string {
  return `${metricFormat.weeklyVolume(value)} kg`;
}

export interface WeeklyVolume {
  /** Monday (YYYY-MM-DD). */
  weekStart: string;
  /** Kilograms lifted (weight × reps, both sides for per-side lifts). */
  volume: number;
}

export interface WeeklyStrength {
  /** Every week from the first with volume through the current one, empty weeks as zero. */
  weeks: WeeklyVolume[];
  /** Weeks before the current one. */
  fullWeeks: WeeklyVolume[];
  /** The current week, still in progress; null without any volume in the period. */
  thisWeek: WeeklyVolume | null;
  /** The week with the most volume (the earliest on a tie), this week included. */
  bestWeek: WeeklyVolume | null;
  /** Full weeks, then this week as the partial point. */
  points: TrendPoint[];
}

/** Weekly volume up to `today` (later rows are ignored). */
export function buildWeeklyStrength(
  rows: readonly StrengthProgressRow[],
  { today }: { today: string },
): WeeklyStrength {
  const current = weekStartOf(today);
  const totals = new Map<string, number>();
  for (const row of rows) {
    const day = sessionDay(row.startedAt);
    if (!day || day > today) {
      continue;
    }
    const week = weekStartOf(day);
    totals.set(week, (totals.get(week) ?? 0) + (numericOrNull(row.volume) ?? 0));
  }
  const first = [...totals.keys()].sort()[0];
  const weeks: WeeklyVolume[] = [];
  for (let week = first; week !== undefined && week <= current; week = addLocalDateDays(week, 7)) {
    weeks.push({ weekStart: week, volume: totals.get(week) ?? 0 });
  }
  const thisWeek = weeks.find((week) => week.weekStart === current) ?? null;
  const fullWeeks = weeks.filter((week) => week.weekStart < current);
  const bestWeek = weeks.reduce<WeeklyVolume | null>(
    (best, week) => (best === null || week.volume > best.volume ? week : best),
    null,
  );
  return {
    weeks,
    fullWeeks,
    thisWeek,
    bestWeek,
    points: [
      ...fullWeeks.map((week) => ({ date: week.weekStart, value: week.volume })),
      ...(thisWeek ? [{ date: thisWeek.weekStart, value: thisWeek.volume, partial: true }] : []),
    ],
  };
}

/** One exercise on one local date: its sessions' volume summed, their best e1RM. */
export interface ExerciseDayPoint {
  date: string;
  volume: number;
  estimatedOneRepMax: number | null;
}

export interface ExerciseStrengthTrend {
  id: string;
  name: string;
  /** Oldest first, one per local date. */
  points: ExerciseDayPoint[];
  /** From the most recent date with an estimate. */
  latestEstimatedOneRepMax: number | null;
  bestEstimatedOneRepMax: number | null;
  latestVolume: number | null;
  bestVolume: number | null;
}

function exerciseTrend(
  id: string,
  name: string,
  rows: StrengthProgressRow[],
): ExerciseStrengthTrend {
  const byDay = new Map<string, ExerciseDayPoint>();
  for (const row of rows) {
    const day = sessionDay(row.startedAt);
    if (!day) {
      continue;
    }
    const estimate = numericOrNull(row.estimatedOneRepMax);
    const point = byDay.get(day) ?? { date: day, volume: 0, estimatedOneRepMax: null };
    point.volume += numericOrNull(row.volume) ?? 0;
    if (estimate !== null && estimate > 0) {
      point.estimatedOneRepMax = Math.max(point.estimatedOneRepMax ?? 0, estimate);
    }
    byDay.set(day, point);
  }
  const points = [...byDay.values()].sort((left, right) => left.date.localeCompare(right.date));
  const estimates = points.flatMap((point) =>
    point.estimatedOneRepMax === null ? [] : [point.estimatedOneRepMax],
  );
  const volumes = points.map((point) => point.volume);
  return {
    id,
    name,
    points,
    latestEstimatedOneRepMax: estimates.at(-1) ?? null,
    bestEstimatedOneRepMax: estimates.length > 0 ? Math.max(...estimates) : null,
    latestVolume: volumes.at(-1) ?? null,
    bestVolume: volumes.length > 0 ? Math.max(...volumes) : null,
  };
}

/**
 * Exercises with a session on `today` or the `days − 1` dates before it, by
 * name, each with every loaded session up to today.
 */
export function recentExerciseTrends(
  rows: readonly StrengthProgressRow[],
  { today, days = RECENT_EXERCISE_DAYS }: { today: string; days?: number },
): ExerciseStrengthTrend[] {
  const recentStart = addLocalDateDays(today, -(days - 1));
  const byExercise = new Map<
    string,
    { name: string; rows: StrengthProgressRow[]; recent: boolean }
  >();
  for (const row of rows) {
    const day = sessionDay(row.startedAt);
    if (!day || day > today) {
      continue;
    }
    const entry = byExercise.get(row.exerciseId) ?? {
      name: row.exercise?.name ?? "Exercise",
      rows: [],
      recent: false,
    };
    entry.rows.push(row);
    entry.recent ||= day >= recentStart;
    byExercise.set(row.exerciseId, entry);
  }
  return [...byExercise.entries()]
    .filter(([, entry]) => entry.recent)
    .map(([id, entry]) => exerciseTrend(id, entry.name, entry.rows))
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}
