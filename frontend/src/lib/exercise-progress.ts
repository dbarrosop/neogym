/**
 * Per-session progress for the exercise detail page (Web · ExerciseDetail):
 * volume and estimated one-rep max per logged session, the chart period
 * filter and the stat tiles' change against the previous session. Mirrors iOS
 * `StrengthProgressSummary` / `CardioProgressSummary`.
 */
import { aggregationForFormat, type CardioMetricSpec } from "@/lib/cardio-schema";
import { formatSignedDelta } from "@/lib/metric-format";
import { addLocalDateDays, formatLocalDate } from "@/lib/nutrition";
import { estimateOneRepMax } from "@/lib/strength-metrics";

/** Chart periods in local days, as on the board: 30 d · 90 d · 1 y (default 90 d, like iOS). */
export const EXERCISE_PROGRESS_PERIODS = [
  { value: 30, label: "30 d" },
  { value: 90, label: "90 d" },
  { value: 365, label: "1 y" },
] as const;

export type ExerciseProgressPeriod = (typeof EXERCISE_PROGRESS_PERIODS)[number]["value"];

export const DEFAULT_EXERCISE_PROGRESS_PERIOD: ExerciseProgressPeriod = 90;

export interface ProgressSession {
  /** Session start, ISO timestamp. */
  startedAt: string;
}

export interface StrengthProgressPoint {
  sessionId: string;
  /** Local calendar date of the session ("2026-11-12"). */
  date: string;
  time: number;
  volume: number;
  oneRm: number;
}

export interface CardioProgressPoint {
  sessionId: string;
  date: string;
  time: number;
  value: number;
}

interface HistoryEntry {
  workoutSession: { id: string; startedAt: string };
  workoutSessionStrengthSets: readonly { reps: number; weight: unknown }[];
  workoutSessionCardioEntries?: readonly { metrics?: unknown }[] | null;
}

/** The local calendar date ("YYYY-MM-DD") of an ISO timestamp. */
export function localDateOf(iso: string): string {
  return formatLocalDate(new Date(iso));
}

/**
 * One point per session with logged sets, oldest first. Volume sums weight ×
 * reps (doubled for per-side exercises); the estimated 1RM is the session's
 * best set: recorded weight for a single, Epley for 2+ reps, never doubled.
 */
export function buildStrengthProgress(
  entries: readonly HistoryEntry[],
  doubleWeight: boolean,
): StrengthProgressPoint[] {
  const points: StrengthProgressPoint[] = [];
  for (const entry of entries) {
    if (entry.workoutSessionStrengthSets.length === 0) {
      continue;
    }
    let volume = 0;
    let oneRm = 0;
    for (const set of entry.workoutSessionStrengthSets) {
      if (set.reps <= 0) {
        continue;
      }
      const weight = Number(set.weight);
      volume += weight * set.reps;
      oneRm = Math.max(oneRm, estimateOneRepMax(weight, set.reps));
    }
    points.push({
      sessionId: entry.workoutSession.id,
      date: localDateOf(entry.workoutSession.startedAt),
      time: new Date(entry.workoutSession.startedAt).getTime(),
      volume: doubleWeight ? volume * 2 : volume,
      oneRm,
    });
  }
  return points.sort((a, b) => a.time - b.time);
}

/**
 * One point per session with a numeric primary metric, oldest first: summed
 * across entries, or averaged for "average" metrics (heart rate).
 */
export function buildCardioProgress(
  entries: readonly HistoryEntry[],
  primary: CardioMetricSpec,
): CardioProgressPoint[] {
  const average = aggregationForFormat(primary.format) === "average";
  const points: CardioProgressPoint[] = [];
  for (const entry of entries) {
    let total = 0;
    let seen = 0;
    for (const cardioEntry of entry.workoutSessionCardioEntries ?? []) {
      const value = (cardioEntry.metrics as Record<string, unknown> | null | undefined)?.[
        primary.key
      ];
      if (typeof value === "number" && Number.isFinite(value)) {
        total += value;
        seen += 1;
      }
    }
    if (seen === 0) {
      continue;
    }
    points.push({
      sessionId: entry.workoutSession.id,
      date: localDateOf(entry.workoutSession.startedAt),
      time: new Date(entry.workoutSession.startedAt).getTime(),
      value: average ? total / seen : total,
    });
  }
  return points.sort((a, b) => a.time - b.time);
}

/** Points from the last `days` local dates, today included. */
export function pointsInPeriod<T extends { date: string }>(
  points: readonly T[],
  days: number,
  today: string,
): T[] {
  const start = addLocalDateDays(today, -(days - 1));
  return points.filter((point) => point.date >= start && point.date <= today);
}

/** Latest against the previous point, in percent; `null` without two points or from zero. */
export function changeFromPrevious<T>(points: readonly T[], value: (point: T) => number) {
  const latest = points.at(-1);
  const previous = points.at(-2);
  if (latest === undefined || previous === undefined) {
    return null;
  }
  const before = value(previous);
  return before === 0 ? null : ((value(latest) - before) / before) * 100;
}

/** "+4.1%", "−27.0%", "0.0%". */
export function formatPercentChange(percent: number): string {
  return `${formatSignedDelta(percent)}%`;
}
