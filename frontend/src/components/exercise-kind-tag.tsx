import { KindTag } from "@/components/patterns/tag";

/**
 * Marks cardio exercises in exercise lists. Strength is the default and stays
 * untagged; cardio needs the tag because its primary muscle (often quadriceps)
 * otherwise reads like a leg exercise. The accent-soft kind pill, as the
 * boards' `.kind.km` (Web-Dialogs, Add exercises); "CARDIO" is uppercase
 * visually only.
 */
export function CardioTag({ className }: { className?: string }) {
  return <KindTag kind="cardio" {...(className ? { className } : {})} />;
}
