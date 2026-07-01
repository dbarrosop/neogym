export interface MacroFields {
  kcalPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
  proteinPer100g: unknown;
  fiberPer100g: unknown;
  sugarPer100g: unknown;
}

export interface NormalizedMacros {
  kcalPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
}

export interface MacroTotals {
  kcal: number;
  fat: number;
  carbs: number;
  protein: number;
  fiber: number;
  sugar: number;
}

export interface MealTotalIngredient {
  grams: unknown;
  food?: MacroFields | null;
}

export interface IntakeDraftMacroItem {
  grams: unknown;
  food?: MacroFields | null;
}

export interface PlanMealSummary {
  id?: string;
  name?: string | null;
  description?: string | null;
  mealIngredients: MealTotalIngredient[];
}

export interface PlanFoodSummary extends MacroFields {
  id?: string;
  name?: string | null;
  userId?: string | null;
  isPublic?: boolean;
}

export interface PlanTotalSlot {
  meal?: PlanMealSummary | null;
}

export interface PlanMealEntry {
  id: string;
  mealId?: string;
  slotTime?: string | null;
  label?: string | null;
  position: number;
  meal?: PlanMealSummary | null;
}

export interface PlanFoodEntry {
  id: string;
  foodId?: string;
  slotTime?: string | null;
  label?: string | null;
  position: number;
  grams: unknown;
  food?: PlanFoodSummary | null;
}

export type PlanEntry = (PlanMealEntry & { kind: "meal" }) | (PlanFoodEntry & { kind: "food" });

export interface LoggedSnapshotEntry {
  grams: unknown;
  snapshotKcalPer100g: unknown;
  snapshotFatPer100g: unknown;
  snapshotCarbsPer100g: unknown;
  snapshotProteinPer100g: unknown;
  snapshotFiberPer100g: unknown;
  snapshotSugarPer100g: unknown;
}

export interface IntakeEntry extends LoggedSnapshotEntry {
  id: string;
  position: number;
  slotTime?: string | null;
  nutritionLogMealId?: string | null;
  snapshotFoodName: string;
}

export interface IntakeLoggedMealGroup<TEntry extends IntakeEntry = IntakeEntry> {
  id: string;
  mealId?: string | null;
  nutritionPlanMealId?: string | null;
  name: string;
  slotTime?: string | null;
  position: number;
  nutritionLogEntries: TEntry[];
}

export interface IntakeSlotMealGroup {
  id: string;
  mealId?: string | null;
  nutritionPlanMealId?: string | null;
  name: string;
  slotTime?: string | null;
  position: number;
  entryCount: number;
}

export interface IntakeSlotEntry<TEntry extends IntakeEntry = IntakeEntry> {
  kind: "meal" | "standalone";
  entry: TEntry;
  /** Logged meal group id/name for provenance; null for standalone entries. */
  mealId: string | null;
  mealName: string | null;
}

export interface IntakeTimeSlot<TEntry extends IntakeEntry = IntakeEntry> {
  key: string;
  label: string;
  sortKey: string;
  entries: IntakeSlotEntry<TEntry>[];
  mealGroups: IntakeSlotMealGroup[];
  totals: MacroTotals;
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY_PATTERN = /^(\d{2}):(\d{2})/;
const NO_TIME_SLOT_KEY = "no-time";
const NO_TIME_SORT_KEY = "99:99";

const PLAN_ENTRY_KIND_ORDER = {
  food: 0,
  meal: 1,
} satisfies Record<PlanEntry["kind"], number>;

const MACRO_LABELS: Record<keyof NormalizedMacros, string> = {
  kcalPer100g: "kcal",
  fatPer100g: "fat",
  carbsPer100g: "carbs",
  proteinPer100g: "protein",
  fiberPer100g: "fiber",
  sugarPer100g: "sugar",
};

export const EMPTY_MACRO_TOTALS: MacroTotals = {
  kcal: 0,
  fat: 0,
  carbs: 0,
  protein: 0,
  fiber: 0,
  sugar: 0,
};

export const DECIMAL_INPUT_PATTERN = "[0-9]*[.,]?[0-9]*";

function normalizeDecimalInput(value: string): string {
  return value.trim().replace(",", ".");
}

export function normalizeNumeric(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(normalizeDecimalInput(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeMacros(input: MacroFields): NormalizedMacros {
  return {
    kcalPer100g: normalizeNumeric(input.kcalPer100g),
    fatPer100g: normalizeNumeric(input.fatPer100g),
    carbsPer100g: normalizeNumeric(input.carbsPer100g),
    proteinPer100g: normalizeNumeric(input.proteinPer100g),
    fiberPer100g: normalizeNumeric(input.fiberPer100g),
    sugarPer100g: normalizeNumeric(input.sugarPer100g),
  };
}

export function parseMacroInput(value: string): number | null {
  const normalized = normalizeDecimalInput(value);
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function formatMacro(value: unknown, unit: "g" | "kcal"): string {
  const normalized = normalizeNumeric(value);
  const precision = Number.isInteger(normalized) ? 0 : 1;
  return `${normalized.toLocaleString(undefined, {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  })} ${unit}`;
}

export function macrosForGrams(input: MacroFields, grams: unknown): MacroTotals {
  const macros = normalizeMacros(input);
  const multiplier = normalizeNumeric(grams) / 100;
  return {
    kcal: macros.kcalPer100g * multiplier,
    fat: macros.fatPer100g * multiplier,
    carbs: macros.carbsPer100g * multiplier,
    protein: macros.proteinPer100g * multiplier,
    fiber: macros.fiberPer100g * multiplier,
    sugar: macros.sugarPer100g * multiplier,
  };
}

export function addMacroTotals(left: MacroTotals, right: MacroTotals): MacroTotals {
  return {
    kcal: left.kcal + right.kcal,
    fat: left.fat + right.fat,
    carbs: left.carbs + right.carbs,
    protein: left.protein + right.protein,
    fiber: left.fiber + right.fiber,
    sugar: left.sugar + right.sugar,
  };
}

export function mealMacroTotals(ingredients: MealTotalIngredient[]): MacroTotals {
  return ingredients.reduce((total, ingredient) => {
    if (!ingredient.food) {
      return total;
    }
    return addMacroTotals(total, macrosForGrams(ingredient.food, ingredient.grams));
  }, EMPTY_MACRO_TOTALS);
}

export function intakeDraftMacroTotals(items: IntakeDraftMacroItem[]): MacroTotals {
  return items.reduce((total, item) => {
    if (!item.food) {
      return total;
    }
    return addMacroTotals(total, macrosForGrams(item.food, item.grams));
  }, EMPTY_MACRO_TOTALS);
}

export function planMacroTotals(slots: PlanTotalSlot[]): MacroTotals {
  return slots.reduce((total, slot) => {
    if (!slot.meal) {
      return total;
    }
    return addMacroTotals(total, mealMacroTotals(slot.meal.mealIngredients));
  }, EMPTY_MACRO_TOTALS);
}

export function planEntryMacroTotals(entry: PlanEntry): MacroTotals {
  if (entry.kind === "food") {
    return entry.food ? macrosForGrams(entry.food, entry.grams) : EMPTY_MACRO_TOTALS;
  }
  return entry.meal ? mealMacroTotals(entry.meal.mealIngredients) : EMPTY_MACRO_TOTALS;
}

export function planEntriesMacroTotals(entries: PlanEntry[]): MacroTotals {
  return entries.reduce(
    (total, entry) => addMacroTotals(total, planEntryMacroTotals(entry)),
    EMPTY_MACRO_TOTALS,
  );
}

/**
 * Merge the sibling plan-entry tables into the display/editor order.
 * Editors must write `position` as a global value within each plan/time slot
 * across both tables; `kind` and `id` are deterministic fallbacks for legacy
 * or imported collisions where two entries share the same time and position.
 */
export function mergePlanEntriesByTime(
  mealEntries: PlanMealEntry[],
  foodEntries: PlanFoodEntry[],
): PlanEntry[] {
  return [
    ...mealEntries.map((entry) => ({ ...entry, kind: "meal" as const })),
    ...foodEntries.map((entry) => ({ ...entry, kind: "food" as const })),
  ].toSorted(comparePlanEntries);
}

/**
 * Sort draft plan entries by time while preserving current draft order within
 * the same time, then assign global positions per time slot across both entry
 * tables. These positions are what Hasura stores in `nutrition_plan_meals` and
 * `nutrition_plan_foods` for deterministic mixed display.
 */
export function sortAndRenumberPlanEntriesByTime<TEntry extends { slotTime?: string | null }>(
  entries: TEntry[],
): Array<TEntry & { position: number }> {
  const nextPositionByTime = new Map<string, number>();

  return entries
    .map((entry, index) => ({ entry, index }))
    .toSorted(
      (left, right) =>
        comparePlanSlotTime(left.entry.slotTime, right.entry.slotTime) || left.index - right.index,
    )
    .map(({ entry }) => {
      const timeKey = normalizePlanSlotTime(entry.slotTime);
      const position = nextPositionByTime.get(timeKey) ?? 0;
      nextPositionByTime.set(timeKey, position + 1);
      return { ...entry, position };
    });
}

export function loggedEntryMacroTotals(entry: LoggedSnapshotEntry): MacroTotals {
  return macrosForGrams(
    {
      kcalPer100g: entry.snapshotKcalPer100g,
      fatPer100g: entry.snapshotFatPer100g,
      carbsPer100g: entry.snapshotCarbsPer100g,
      proteinPer100g: entry.snapshotProteinPer100g,
      fiberPer100g: entry.snapshotFiberPer100g,
      sugarPer100g: entry.snapshotSugarPer100g,
    },
    entry.grams,
  );
}

export function loggedMacroTotals(entries: LoggedSnapshotEntry[]): MacroTotals {
  return entries.reduce(
    (total, entry) => addMacroTotals(total, loggedEntryMacroTotals(entry)),
    EMPTY_MACRO_TOTALS,
  );
}

type IntakeSourceUnit<TEntry extends IntakeEntry> =
  | {
      kind: "meal";
      id: string;
      position: number;
      meal: IntakeSlotMealGroup;
      entries: TEntry[];
    }
  | {
      kind: "standalone";
      id: string;
      position: number;
      entry: TEntry;
    };

type MutableIntakeTimeSlot<TEntry extends IntakeEntry> = Omit<
  IntakeTimeSlot<TEntry>,
  "entries" | "mealGroups" | "totals"
> & {
  sourceUnits: IntakeSourceUnit<TEntry>[];
};

export function groupIntakeByTimeSlot<TEntry extends IntakeEntry>(
  mealGroups: IntakeLoggedMealGroup<TEntry>[],
  standaloneEntries: TEntry[],
): IntakeTimeSlot<TEntry>[] {
  const slots = new Map<string, MutableIntakeTimeSlot<TEntry>>();

  function ensureSlot(slotTime: unknown): MutableIntakeTimeSlot<TEntry> {
    const inputValue = timeToInputValue(slotTime);
    const key = inputValue || NO_TIME_SLOT_KEY;
    const existing = slots.get(key);
    if (existing) {
      return existing;
    }
    const slot: MutableIntakeTimeSlot<TEntry> = {
      key,
      label: inputValue ? formatTimeOfDay(inputValue) : "No time",
      sortKey: inputValue || NO_TIME_SORT_KEY,
      sourceUnits: [],
    };
    slots.set(key, slot);
    return slot;
  }

  for (const meal of mealGroups) {
    const slot = ensureSlot(meal.slotTime);
    const mealMetadata: IntakeSlotMealGroup = {
      id: meal.id,
      mealId: meal.mealId ?? null,
      nutritionPlanMealId: meal.nutritionPlanMealId ?? null,
      name: meal.name,
      slotTime: meal.slotTime ?? null,
      position: meal.position,
      entryCount: meal.nutritionLogEntries.length,
    };
    slot.sourceUnits.push({
      kind: "meal",
      id: meal.id,
      position: meal.position,
      meal: mealMetadata,
      entries: meal.nutritionLogEntries,
    });
  }

  for (const entry of standaloneEntries) {
    ensureSlot(entry.slotTime).sourceUnits.push({
      kind: "standalone",
      id: entry.id,
      position: entry.position,
      entry,
    });
  }

  return Array.from(slots.values())
    .map((slot) => {
      const sourceUnits = slot.sourceUnits.toSorted(compareIntakeSourceUnits);
      const entries = sourceUnits.flatMap((sourceUnit): IntakeSlotEntry<TEntry>[] => {
        if (sourceUnit.kind === "standalone") {
          return [
            {
              kind: "standalone",
              entry: sourceUnit.entry,
              mealId: null,
              mealName: null,
            },
          ];
        }

        return sourceUnit.entries.toSorted(compareIntakeEntries).map((entry) => ({
          kind: "meal",
          entry,
          mealId: sourceUnit.meal.id,
          mealName: sourceUnit.meal.name,
        }));
      });
      const mealGroupsForSlot = sourceUnits
        .filter(
          (sourceUnit): sourceUnit is Extract<IntakeSourceUnit<TEntry>, { kind: "meal" }> =>
            sourceUnit.kind === "meal",
        )
        .map((sourceUnit) => sourceUnit.meal);

      return {
        key: slot.key,
        label: slot.label,
        sortKey: slot.sortKey,
        entries,
        mealGroups: mealGroupsForSlot,
        totals: loggedMacroTotals(entries.map((slotEntry) => slotEntry.entry)),
      };
    })
    .toSorted((left, right) => left.sortKey.localeCompare(right.sortKey));
}

function compareIntakeSourceUnits<TEntry extends IntakeEntry>(
  left: IntakeSourceUnit<TEntry>,
  right: IntakeSourceUnit<TEntry>,
): number {
  return (
    compareSortPosition(left.position, right.position) ||
    compareSourceKind(left.kind, right.kind) ||
    left.id.localeCompare(right.id)
  );
}

function comparePlanEntries(left: PlanEntry, right: PlanEntry): number {
  return (
    comparePlanSlotTime(left.slotTime, right.slotTime) ||
    compareSortPosition(left.position, right.position) ||
    comparePlanEntryKind(left.kind, right.kind) ||
    left.id.localeCompare(right.id)
  );
}

function compareIntakeEntries(left: IntakeEntry, right: IntakeEntry): number {
  return compareSortPosition(left.position, right.position) || left.id.localeCompare(right.id);
}

function compareSourceKind(
  left: IntakeSourceUnit<IntakeEntry>["kind"],
  right: IntakeSourceUnit<IntakeEntry>["kind"],
): number {
  const sourceKindOrder = { meal: 0, standalone: 1 } satisfies Record<
    IntakeSourceUnit<IntakeEntry>["kind"],
    number
  >;
  return sourceKindOrder[left] - sourceKindOrder[right];
}

function comparePlanEntryKind(left: PlanEntry["kind"], right: PlanEntry["kind"]): number {
  return PLAN_ENTRY_KIND_ORDER[left] - PLAN_ENTRY_KIND_ORDER[right];
}

function comparePlanSlotTime(left: unknown, right: unknown): number {
  return normalizePlanSlotTime(left).localeCompare(normalizePlanSlotTime(right));
}

function normalizePlanSlotTime(value: unknown): string {
  return timeToInputValue(value) || NO_TIME_SORT_KEY;
}

function compareSortPosition(left: number, right: number): number {
  return normalizeSortPosition(left) - normalizeSortPosition(right);
}

function normalizeSortPosition(value: number): number {
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function formatLocalDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentTimeInputValue(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function localDateToDate(value: string): Date | null {
  if (!isValidLocalDate(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function addLocalDateDays(value: string, days: number): string {
  const date = localDateToDate(value) ?? new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function formatLocalDateLabel(value: string): string {
  const date = localDateToDate(value);
  if (!date) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function timeToInputValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const match = TIME_OF_DAY_PATTERN.exec(value);
  if (!match) {
    return "";
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return "";
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return "";
  }
  return `${match[1]}:${match[2]}`;
}

export function formatTimeOfDay(value: unknown): string {
  const inputValue = timeToInputValue(value);
  if (!inputValue) {
    return "—";
  }
  const [hours = "0", minutes = "0"] = inputValue.split(":");
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function macroTotalsSummary(totals: MacroTotals): string {
  return [
    formatMacro(totals.kcal, "kcal"),
    `${formatMacro(totals.fat, "g")} fat`,
    `${formatMacro(totals.carbs, "g")} carbs`,
    `${formatMacro(totals.protein, "g")} protein`,
    `${formatMacro(totals.fiber, "g")} fiber`,
    `${formatMacro(totals.sugar, "g")} sugar`,
  ].join(" · ");
}

export function macroSummary(input: MacroFields): string {
  const macros = normalizeMacros(input);
  return (Object.entries(macros) as [keyof NormalizedMacros, number][])
    .map(([key, value]) => {
      if (key === "kcalPer100g") {
        return formatMacro(value, "kcal");
      }
      return `${formatMacro(value, "g")} ${MACRO_LABELS[key]}`;
    })
    .join(" · ");
}

export function isFoodInUseError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("foreign key") ||
    message.includes("meal_ingredients") ||
    message.includes("nutrition_plan_foods") ||
    message.includes("nutrition_log_entries") ||
    message.includes("violates constraint")
  );
}

export function isMealInUseByPlanError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("foreign key") ||
    message.includes("nutrition_plan_meals") ||
    message.includes("violates constraint")
  );
}
