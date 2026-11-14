/**
 * One formatter for strength sets across Train: collapsed session cards,
 * the session Recent panel, exercise history and a workout's "last top set".
 * Mirrors iOS `SessionLogging.setsSummary` / `StrengthSetFormatting`.
 *
 * - "full" (default) carries the unit: "140 kg × 6 · 7 · 6".
 * - "compact" drops it: "95 × 12 · 11 · 10" (Recent panel, "last …" captions,
 *   history tables).
 *
 * Consecutive sets at the same weight share one weight label; a weight change
 * starts a new group after a comma: "100 kg × 8 · 8, 95 kg × 10".
 */
export interface SummarySet {
  reps: number;
  /** Numeric columns can arrive as strings from GraphQL. */
  weight: unknown;
  /** Sorted by this when present; otherwise the given order is kept. */
  setNumber?: number | null;
}

export type SetSummaryStyle = "full" | "compact";

/** How a 0 kg (bodyweight) set reads: "BW" in tables, "bodyweight" in prose. */
export type BodyweightLabel = "BW" | "bodyweight";

export interface SetSummaryOptions {
  style?: SetSummaryStyle;
  /**
   * Double-weight exercises log the weight of one dumbbell/side. Appends
   * " per side" when at least one set is weighted.
   */
  perSide?: boolean;
  bodyweightLabel?: BodyweightLabel;
}

const WEIGHT_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function toWeight(value: unknown): number {
  const weight = typeof value === "number" ? value : Number(value);
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

function ordered<TSet extends SummarySet>(sets: readonly TSet[]): TSet[] {
  if (!sets.some((set) => typeof set.setNumber === "number")) {
    return [...sets];
  }
  return [...sets].sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
}

/** "140 kg", "140" (compact), "92.5 kg", or "BW"/"bodyweight" for 0 kg. */
export function formatSetWeight(
  weight: unknown,
  { style = "full", bodyweightLabel = "BW" }: Omit<SetSummaryOptions, "perSide"> = {},
): string {
  const value = toWeight(weight);
  if (value === 0) {
    return bodyweightLabel;
  }
  const number = WEIGHT_FORMAT.format(value);
  return style === "full" ? `${number} kg` : number;
}

/** One set: "140 kg × 6" ("140 × 6" compact). */
export function formatSet(set: SummarySet, options: SetSummaryOptions = {}): string {
  const label = `${formatSetWeight(set.weight, options)} × ${set.reps}`;
  return options.perSide && toWeight(set.weight) > 0 ? `${label} per side` : label;
}

/**
 * All sets of one exercise in one session: "140 kg × 6 · 7 · 6". Returns
 * `null` for no sets so callers can fall back ("No sets yet", "—").
 */
export function formatSetsSummary(
  sets: readonly SummarySet[],
  options: SetSummaryOptions = {},
): string | null {
  const groups: { weight: number; reps: number[] }[] = [];
  for (const set of ordered(sets)) {
    const weight = toWeight(set.weight);
    const last = groups.at(-1);
    if (last && last.weight === weight) {
      last.reps.push(set.reps);
    } else {
      groups.push({ weight, reps: [set.reps] });
    }
  }
  if (groups.length === 0) {
    return null;
  }
  const summary = groups
    .map((group) => `${formatSetWeight(group.weight, options)} × ${group.reps.join(" · ")}`)
    .join(", ");
  const weighted = groups.some((group) => group.weight > 0);
  return options.perSide && weighted ? `${summary} per side` : summary;
}

/** The heaviest set, most reps breaking ties; `null` without sets. */
export function topSet<TSet extends SummarySet>(sets: readonly TSet[]): TSet | null {
  let best: TSet | null = null;
  for (const set of sets) {
    if (!best) {
      best = set;
      continue;
    }
    const weight = toWeight(set.weight);
    const bestWeight = toWeight(best.weight);
    if (weight > bestWeight || (weight === bestWeight && set.reps > best.reps)) {
      best = set;
    }
  }
  return best;
}

/** Workout "Last top set" column: "140 kg × 7", "BW × 20"; `null` without sets. */
export function formatTopSet(
  sets: readonly SummarySet[],
  options: SetSummaryOptions = {},
): string | null {
  const best = topSet(sets);
  return best ? formatSet(best, options) : null;
}

/**
 * The trailing caption on a collapsed session card, from last time's sets:
 * "last 135 × 10 · 9 · 8" beside this session's logged summary, or
 * "Last time 180 kg × 11 · 11 · 10" (bodyweight spelled out) when nothing is
 * logged yet. `null` when there is no last time.
 */
export function formatLastTimeCaption(
  lastTimeSets: readonly SummarySet[] | null | undefined,
  { hasLoggedSets, perSide = false }: { hasLoggedSets: boolean; perSide?: boolean },
): string | null {
  if (!lastTimeSets || lastTimeSets.length === 0) {
    return null;
  }
  if (hasLoggedSets) {
    return `last ${formatSetsSummary(lastTimeSets, { style: "compact", perSide })}`;
  }
  return `Last time ${formatSetsSummary(lastTimeSets, { bodyweightLabel: "bodyweight", perSide })}`;
}
