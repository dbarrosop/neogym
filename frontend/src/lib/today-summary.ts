// Today's card summaries. Mirrors NeoGymKit TodaySummary.swift:
// - Balance (`TodayBalanceSummary`): food logged so far against the energy
//   recorded so far today, stamped with the time today's `daily_energy` row was
//   last written. The end-of-day estimate is `calculateDailyEnergyProjection`
//   (rendered by TodayEnergyEstimate).
// - Body: each metric's 7-day average and its change against the prior week
//   (`lib/body-trend.ts`), shown neutral because NeoGym has no weight goal.

import type { BodyMetricTrend } from "@/lib/body-trend";
import type { DailyEnergyNumericValue } from "@/lib/daily-energy";
import { formatKcalNumber, formatNumber, formatSignedDelta } from "@/lib/metric-format";

/** Today's `daily_energy` row as the overview query selects it. */
export interface TodayEnergyRow {
  activeKcal?: DailyEnergyNumericValue;
  restingKcal?: DailyEnergyNumericValue;
  /** When the row was last written (watch sync or manual edit). */
  updatedAt?: string | null;
}

export interface TodayBalance {
  /** Snapshot kcal logged today. */
  caloriesIn: number;
  /** Active + resting recorded so far; null until today's energy row exists. */
  caloriesOut: number | null;
  /** In − out so far; null until today's energy row exists. */
  net: number | null;
  /** Recorded components; a missing component on an existing row counts zero. */
  restingKcal: number;
  activeKcal: number;
  /** When today's energy row was last written, or null. */
  energyUpdatedAt: Date | null;
}

/** A recorded component; missing or unreadable counts zero, as in `calculateDailyEnergyBalance`. */
function kcal(value: DailyEnergyNumericValue): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = typeof value === "number" ? value : Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

function timestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The balance so far from today's logged intake and today's energy row (if any). */
export function todayBalanceSoFar({
  caloriesIn,
  energy,
}: {
  caloriesIn: number;
  energy: TodayEnergyRow | null | undefined;
}): TodayBalance {
  const restingKcal = kcal(energy?.restingKcal);
  const activeKcal = kcal(energy?.activeKcal);
  const caloriesOut = energy ? restingKcal + activeKcal : null;
  return {
    caloriesIn,
    caloriesOut,
    net: caloriesOut === null ? null : caloriesIn - caloriesOut,
    restingKcal,
    activeKcal,
    energyUpdatedAt: energy ? timestamp(energy.updatedAt) : null,
  };
}

/** "Today so far · 13:40" (the energy row's last write, local time), or "Today so far". */
export function todayBalanceCaption(
  updatedAt: Date | null,
  { locale }: { locale?: string } = {},
): string {
  if (!updatedAt) {
    return "Today so far";
  }
  const time = updatedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `Today so far · ${time}`;
}

/** Spoken label of the resting/active split bar. */
export function energySplitLabel(
  balance: Pick<TodayBalance, "restingKcal" | "activeKcal">,
  { locale }: { locale?: string } = {},
): string {
  const resting = formatKcalNumber(balance.restingKcal, { locale });
  const active = formatKcalNumber(balance.activeKcal, { locale });
  return `Energy out so far: resting ${resting}, active ${active} kilocalories`;
}

/**
 * "7-day avg 70.7 · −1.0 vs prior week" (one decimal, U+2212, an unsigned
 * "0.0" for no change); just the average without a prior week; null without
 * readings in the last seven days.
 */
export function bodyWeekSummary(
  metric: Pick<BodyMetricTrend, "weekAverage" | "weekChange">,
  { locale }: { locale?: string } = {},
): string | null {
  if (metric.weekAverage === null) {
    return null;
  }
  const average = formatNumber(metric.weekAverage, { maxDecimals: 1, minDecimals: 1, locale });
  return metric.weekChange === null
    ? `7-day avg ${average}`
    : `7-day avg ${average} · ${formatSignedDelta(metric.weekChange, { locale })} vs prior week`;
}
