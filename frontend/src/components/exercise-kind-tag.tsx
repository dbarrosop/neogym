/**
 * Marks cardio exercises in exercise lists. Strength is the default and stays
 * untagged; cardio needs the tag because its primary muscle (often quadriceps)
 * otherwise reads like a leg exercise.
 */
export function CardioTag() {
  return (
    <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[11px] font-bold text-accent-soft-foreground">
      CARDIO
    </span>
  );
}
