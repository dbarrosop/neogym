import type { MacroTotals } from "@/lib/nutrition";
import { formatRowKcal, macroCells } from "@/lib/nutrition-rows";
import { cn } from "@/lib/utils";

/**
 * Day log food rows (Web-NutritionDay `.it`): name | grams | P | C | F | kcal |
 * delete. Below 760 px: name | grams | kcal | delete. Planned rows keep the
 * last column empty so their numbers line up with logged rows.
 */
export const LOG_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_56px_64px_44px] items-center gap-2 min-[760px]:grid-cols-[minmax(0,1fr)_64px_52px_52px_52px_76px_44px]";

/**
 * Plan detail rows (Web-PlanDetail `.pli`): KIND | name | grams | P | C | F |
 * kcal. Below 760 px: KIND | name | grams | kcal.
 */
export const PLAN_ROW_GRID =
  "grid grid-cols-[52px_minmax(0,1fr)_56px_72px] items-center gap-2.5 min-[760px]:grid-cols-[52px_minmax(0,1fr)_64px_46px_46px_46px_76px]";

/**
 * The P, C and F cells of a row ("P 9.9"), hidden below 760 px where the
 * slot's macro line carries the totals. Screen readers hear "protein 9.9 grams".
 */
export function MacroCells({
  totals,
  className,
}: {
  totals: Pick<MacroTotals, "protein" | "carbs" | "fat">;
  className?: string;
}) {
  return macroCells(totals).map((cell) => (
    <span
      key={cell.letter}
      className={cn("hidden text-right text-muted-foreground min-[760px]:block", className)}
    >
      <span aria-hidden="true">
        {cell.letter} {cell.value}
      </span>
      <span className="sr-only">
        {cell.name} {cell.value} grams
      </span>
    </span>
  ));
}

/** "176 kcal": the number in the row's colour, the unit in secondary text. */
export function KcalCell({
  kcal,
  strong = false,
  className,
}: {
  kcal: number;
  /** Plan detail draws the whole value bold. */
  strong?: boolean;
  className?: string;
}) {
  if (strong) {
    return <strong className={cn("text-right", className)}>{formatRowKcal(kcal)} kcal</strong>;
  }
  return (
    <span className={cn("text-right", className)}>
      {formatRowKcal(kcal)} <span className="text-muted-foreground">kcal</span>
    </span>
  );
}
