// Progress › Muscles and the Overview Muscles card, from `muscleSetProgress`
// rows: one row per local date and muscle with trailing seven-day direct,
// secondary and weighted sets (direct plus half of secondary). Mirrors
// NeoGymKit `MuscleSetOverview` / `MuscleSetBar` (ProgressOverview.swift,
// ProgressSummaries.swift).

import { type DatedValue, numericOrNull } from "@/lib/rolling-average";

/** A `muscleSetProgress` row as the GraphQL query returns it. */
export interface MuscleSetRow {
  day: string;
  muscleGroup: string;
  rollingDirectSets: number;
  rollingIndirectSets: number;
  rollingWeightedSets: unknown;
}

/** One muscle's trailing seven-day sets on a date. */
export interface MuscleSets {
  group: string;
  name: string;
  direct: number;
  indirect: number;
  /** Direct plus half of secondary. */
  weighted: number;
}

/** The group that only collects sets without a known delt. */
export const UNSPECIFIED_SHOULDERS = "shoulders";

const UNDERSCORES = /_/g;
const FIRST_LETTER = /^\w/;

/** "front_delts" → "Front delts"; unspecified shoulders say so. */
export function muscleName(group: string): string {
  if (group === UNSPECIFIED_SHOULDERS) {
    return "Shoulders (unspecified)";
  }
  return group.replace(UNDERSCORES, " ").replace(FIRST_LETTER, (c) => c.toUpperCase());
}

function toMuscleSets(row: MuscleSetRow): MuscleSets {
  return {
    group: row.muscleGroup,
    name: muscleName(row.muscleGroup),
    direct: row.rollingDirectSets,
    indirect: row.rollingIndirectSets,
    weighted: numericOrNull(row.rollingWeightedSets) ?? 0,
  };
}

/** Most weighted sets first, then by name. */
function byMostSets(left: MuscleSets, right: MuscleSets) {
  return right.weighted - left.weighted || left.name.localeCompare(right.name);
}

/**
 * Every muscle on the latest date, most weighted sets first (ties by name).
 * Muscles trained earlier in the period stay listed with zero, as on iOS.
 */
export function latestMuscleSets(rows: readonly MuscleSetRow[]): MuscleSets[] {
  let latest = "";
  for (const row of rows) {
    if (row.day > latest) {
      latest = row.day;
    }
  }
  return rows
    .filter((row) => row.day === latest)
    .map(toMuscleSets)
    .sort(byMostSets);
}

/** A muscle's trailing seven-day weighted sets on each date, oldest first. */
export function muscleHistory(rows: readonly MuscleSetRow[], group: string): DatedValue[] {
  return rows
    .filter((row) => row.muscleGroup === group)
    .map((row) => ({ date: row.day, value: numericOrNull(row.rollingWeightedSets) ?? 0 }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * The stacked bar for a muscle: direct sets and half of the secondary sets as
 * fractions of the largest weighted total (the top row fills the track).
 */
export function muscleSetBar(muscle: MuscleSets, maxWeighted: number) {
  const scale = maxWeighted > 0 ? maxWeighted : 1;
  const direct = Math.min(Math.max(muscle.direct / scale, 0), 1);
  const halfIndirect = Math.min(Math.max(muscle.indirect / 2 / scale, 0), 1 - direct);
  return { direct, halfIndirect };
}

export interface MuscleSetOverview {
  /** Weighted sets across every muscle over the last seven days. */
  totalWeightedSets: number;
  /** The most-trained muscles, most first. */
  mostTrained: MuscleSets[];
  /** After those, the least-trained muscles with sets, least first; never unspecified shoulders. */
  leastTrained: MuscleSets[];
}

/**
 * The Overview Muscles card: the latest date's total weighted sets, the
 * `mostCount` most-trained muscles and the `leastCount` least-trained after
 * them. Null when no muscle has sets in the last seven days.
 */
export function muscleSetOverview(
  rows: readonly MuscleSetRow[],
  { mostCount = 6, leastCount = 3 }: { mostCount?: number; leastCount?: number } = {},
): MuscleSetOverview | null {
  const trained = latestMuscleSets(rows).filter((muscle) => muscle.weighted > 0);
  if (trained.length === 0) {
    return null;
  }
  return {
    totalWeightedSets: trained.reduce((sum, muscle) => sum + muscle.weighted, 0),
    mostTrained: trained.slice(0, mostCount),
    leastTrained: trained
      .slice(mostCount)
      .filter((muscle) => muscle.group !== UNSPECIFIED_SHOULDERS)
      .sort((left, right) => left.weighted - right.weighted || left.name.localeCompare(right.name))
      .slice(0, leastCount),
  };
}
