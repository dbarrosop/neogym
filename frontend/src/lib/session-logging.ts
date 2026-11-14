/**
 * Pure helpers for the session logging page (Web · Session): exercise status,
 * the collapsed card's trailing caption for cardio, and dialog copy. Strength
 * set summaries live in `lib/set-summary.ts`.
 */
import { type CardioMetricsSchema, formatMetricValue, iterateMetrics } from "@/lib/cardio-schema";

/** Done once the count reaches last time's; started after the first set or entry. */
export type ExerciseStatus = "done" | "started" | "todo";

/**
 * `count` is this session's logged sets (or entries); `referenceCount` comes
 * from the "last time" occurrence. Without a nonempty reference an exercise is
 * never done, so it stays open for repeated logging.
 */
export function exerciseStatus(count: number, referenceCount = 0): ExerciseStatus {
  if (count === 0) {
    return "todo";
  }
  return referenceCount > 0 && count >= referenceCount ? "done" : "started";
}

export interface CardioEntryMetrics {
  metrics: Record<string, unknown>;
}

/**
 * One session's cardio entries by the first metric (schema order) that any of
 * them recorded: "21:00 · 10:00", "2 km · 1.5 km". Optional metrics left
 * blank are skipped rather than shown as "—"; without any reading it counts
 * the entries. `null` without entries.
 */
export function summarizeCardioEntries(
  entries: readonly CardioEntryMetrics[],
  schema: CardioMetricsSchema,
): string | null {
  if (entries.length === 0) {
    return null;
  }
  const spec = iterateMetrics(schema).find((metric) =>
    entries.some((entry) => typeof entry.metrics[metric.key] === "number"),
  );
  if (!spec) {
    return `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  }
  return entries
    .map((entry) => {
      const value = entry.metrics[spec.key];
      return formatMetricValue(typeof value === "number" ? value : null, spec);
    })
    .join(" · ");
}

/**
 * The trailing caption on a collapsed cardio card, mirroring the strength
 * caption: "last 21:00 · 10:00" beside this session's entries, or
 * "Last time 21:00" when nothing is logged yet; `null` without history.
 */
export function cardioLastTimeCaption(
  lastTimeEntries: readonly CardioEntryMetrics[] | null | undefined,
  schema: CardioMetricsSchema,
  { hasLoggedEntries }: { hasLoggedEntries: boolean },
): string | null {
  const summary = lastTimeEntries ? summarizeCardioEntries(lastTimeEntries, schema) : null;
  if (!summary) {
    return null;
  }
  return hasLoggedEntries ? `last ${summary}` : `Last time ${summary}`;
}

export type SessionChildNoun = "set" | "entry";

export function pluralChild(noun: SessionChildNoun, count: number): string {
  if (count === 1) {
    return noun;
  }
  return noun === "entry" ? "entries" : "sets";
}

/**
 * Remove-exercise confirmation body (Web · Dialogs): "Its 3 logged sets are
 * deleted with it. The workout template is not changed." The template
 * sentence only applies to sessions started from a workout.
 */
export function removeExerciseDescription({
  childCount,
  childNoun,
  fromWorkout,
}: {
  childCount: number;
  childNoun: SessionChildNoun;
  fromWorkout: boolean;
}): string {
  const consequence =
    childCount > 0
      ? `Its ${childCount} logged ${pluralChild(childNoun, childCount)} ${childCount === 1 ? "is" : "are"} deleted with it.`
      : "It's removed from this session only.";
  return fromWorkout ? `${consequence} The workout template is not changed.` : consequence;
}

/** Add exercises dialog body; reordering only exists on the workout template. */
export function addExercisesDescription(fromWorkout: boolean): string {
  return fromWorkout
    ? "Added to the end of the session. Reorder on the workout."
    : "Added to the end of the session.";
}
