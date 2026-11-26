import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { Fragment, type ReactElement } from "react";
import { SkeletonState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIngredientKcal } from "@/lib/meal-template";
import { formatKcalNumber, formatNumber } from "@/lib/metric-format";
import {
  formatMacro,
  type MacroFields,
  type MacroTotals,
  macroLineLabel,
  mealMacroTotals,
  normalizeNumeric,
} from "@/lib/nutrition";
import { cn } from "@/lib/utils";

/**
 * Shared pieces of the Foods and Meals sections (Web-Foods, Web-Meals): the
 * search field, the first-load skeleton, and the selected-item summaries the
 * detail pages reuse. `panel` sits in the 320 px aside beside the table with
 * Details and Edit; `page` is the detail page's card, titled by the page
 * heading, with Edit only.
 */
export type LibrarySummaryVariant = "panel" | "page";

const CAPTION = "text-[13px] text-muted-foreground";

/** Per-100 g food values keep one decimal ("1.6", "20.2"). */
export function formatPer100(value: unknown): string {
  return formatNumber(normalizeNumeric(value), { maxDecimals: 1 });
}

export const FOOD_SNAPSHOT_NOTE =
  "Editing a food never changes days already logged; they keep their snapshot.";
export const PUBLIC_FOOD_NOTE =
  "Public foods are read-only. Create a private food to change values.";

export interface SummaryFood extends MacroFields {
  id: string;
  name: string;
  isPublic: boolean;
}

const FOOD_ROWS = [
  ["Protein", "proteinPer100g"],
  ["Carbs", "carbsPer100g"],
  ["Fat", "fatPer100g"],
  ["Fiber", "fiberPer100g"],
  ["Sugar", "sugarPer100g"],
] as const;

export function FoodSummary({
  food,
  variant,
  canEdit,
}: {
  food: SummaryFood;
  variant: LibrarySummaryVariant;
  /** Private foods the viewer owns; public foods are read-only. */
  canEdit: boolean;
}) {
  return (
    <>
      <SummaryHeading
        variant={variant}
        caption={`${food.isPublic ? "Public" : "Mine"} · per 100 g`}
        title={food.name}
      />
      <KcalHero value={formatPer100(food.kcalPer100g)} />
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm tabular-nums">
        {FOOD_ROWS.map(([label, key]) => (
          <Fragment key={key}>
            <dt className={CAPTION}>{label}</dt>
            <dd className="text-right font-semibold">{formatPer100(food[key])} g</dd>
          </Fragment>
        ))}
      </dl>
      <SummaryActions
        variant={variant}
        details={
          <Link to="/nutrition/foods/$foodId" params={{ foodId: food.id }}>
            Details
          </Link>
        }
        edit={
          canEdit ? (
            <Link to="/nutrition/foods/$foodId/edit" params={{ foodId: food.id }}>
              Edit
            </Link>
          ) : null
        }
      />
      <p className={cn(CAPTION, "leading-normal")}>
        {food.isPublic ? PUBLIC_FOOD_NOTE : FOOD_SNAPSHOT_NOTE}
      </p>
    </>
  );
}

export interface SummaryMeal {
  id: string;
  name: string;
  description?: string | null;
  mealIngredients: Array<{
    id: string;
    grams: unknown;
    food: MacroFields & { id: string; name: string };
  }>;
}

export function summaryMealTotals(meal: SummaryMeal): MacroTotals {
  return mealMacroTotals(
    meal.mealIngredients.map((ingredient) => ({ grams: ingredient.grams, food: ingredient.food })),
  );
}

export function ingredientCountLabel(count: number): string {
  return `${count} ${count === 1 ? "ingredient" : "ingredients"}`;
}

export function MealSummary({
  meal,
  variant,
}: {
  meal: SummaryMeal;
  variant: LibrarySummaryVariant;
}) {
  const totals = summaryMealTotals(meal);
  return (
    <>
      <SummaryHeading
        variant={variant}
        caption={`Meal · ${ingredientCountLabel(meal.mealIngredients.length)}`}
        title={meal.name}
        description={meal.description}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2 tabular-nums">
        <KcalHero value={formatKcalNumber(totals.kcal)} />
        <MacroGrams totals={totals} />
      </div>
      {meal.mealIngredients.length > 0 ? (
        <ul className="text-sm tabular-nums">
          {meal.mealIngredients.map((ingredient) => (
            <li key={ingredient.id} className="flex justify-between gap-2.5 border-t py-2">
              <span className="min-w-0 wrap-break-word">{ingredient.food.name}</span>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                {formatMacro(ingredient.grams, "g")} ·{" "}
                {formatIngredientKcal(ingredient.food, normalizeNumeric(ingredient.grams))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={CAPTION}>No ingredients yet.</p>
      )}
      <SummaryActions
        variant={variant}
        details={
          <Link to="/nutrition/meals/$mealId" params={{ mealId: meal.id }}>
            Details
          </Link>
        }
        edit={
          <Link to="/nutrition/meals/$mealId/edit" params={{ mealId: meal.id }}>
            Edit
          </Link>
        }
      />
    </>
  );
}

/** "P 36 · C 35 · F 10" in whole grams; screen readers hear the spelled-out line. */
export function MacroGrams({ totals, className }: { totals: MacroTotals; className?: string }) {
  return (
    <p className={cn("text-[13px] tabular-nums", className)}>
      <span className="sr-only">{macroLineLabel(totals)}</span>
      <span aria-hidden="true">
        P <strong>{formatNumber(totals.protein)}</strong> · C{" "}
        <strong>{formatNumber(totals.carbs)}</strong> · F{" "}
        <strong>{formatNumber(totals.fat)}</strong>
      </span>
    </p>
  );
}

function SummaryHeading({
  variant,
  caption,
  title,
  description,
}: {
  variant: LibrarySummaryVariant;
  caption: string;
  title: string;
  description?: string | null | undefined;
}) {
  const Heading = variant === "page" ? "h1" : "h2";
  return (
    <div className="flex flex-col gap-1">
      <p className={CAPTION}>{caption}</p>
      <Heading
        className={cn(
          "wrap-break-word font-semibold leading-snug",
          variant === "page" ? "text-[22px] tracking-[-0.01em]" : "text-[17px]",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            CAPTION,
            variant === "panel" ? "line-clamp-3" : "whitespace-pre-line leading-normal",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

function KcalHero({ value }: { value: string }) {
  return (
    <p className="text-[26px] leading-tight font-bold tabular-nums">
      {value} <span className="text-sm font-medium text-muted-foreground">kcal</span>
    </p>
  );
}

/** Details (panel only) and Edit as 44 px outline buttons sharing the row. */
function SummaryActions({
  variant,
  details,
  edit,
}: {
  variant: LibrarySummaryVariant;
  details: ReactElement;
  edit: ReactElement | null;
}) {
  if (variant === "page" && !edit) {
    return null;
  }
  return (
    <div className="flex gap-2">
      {variant === "panel" ? (
        <Button asChild variant="outline" className="h-11 flex-1">
          {details}
        </Button>
      ) : null}
      {edit ? (
        <Button asChild variant="outline" className={cn("h-11", variant === "panel" && "flex-1")}>
          {edit}
        </Button>
      ) : null}
    </div>
  );
}

/** The section's 40 px search field; the visible placeholder is not its name. */
export function LibrarySearchField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className="h-10 rounded-[10px] border-border pr-10 pl-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** First-load placeholder shaped like the table (from 768 px) or the row list. */
export function LibrarySkeleton({ rows = 6 }: { rows?: number }) {
  const keys = Array.from({ length: rows }, (_, index) => index);
  return (
    <SkeletonState className="overflow-hidden rounded-xl border bg-card">
      <div className="hidden items-center gap-6 border-b px-4 py-3 md:flex">
        <Skeleton className="h-3 w-16" />
        <span className="flex-1" />
        {[0, 1, 2, 3].map((column) => (
          <Skeleton key={column} className="h-3 w-10" />
        ))}
      </div>
      {keys.map((row) => (
        <div key={row} className="flex items-center gap-6 border-b px-4 py-3.5 last:border-b-0">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-32 md:hidden" />
          </div>
          {[0, 1, 2, 3].map((column) => (
            <Skeleton key={column} className="hidden h-4 w-10 md:block" />
          ))}
          <Skeleton className="h-4 w-10 md:hidden" />
        </div>
      ))}
    </SkeletonState>
  );
}

/** First-load placeholder for a food or meal detail card. */
export function LibraryDetailSkeleton() {
  return (
    <SkeletonState className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-6 w-56 max-w-full" />
      <Skeleton className="h-7 w-24" />
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="flex justify-between">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </SkeletonState>
  );
}
