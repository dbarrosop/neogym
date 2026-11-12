import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { type ReactNode, type SubmitEvent, useId, useMemo, useState } from "react";
import { FoodPicker, type FoodPickerOption } from "@/components/food-picker";
import { MacroSummary } from "@/components/macro-summary";
import { MealPicker, type MealPickerOption } from "@/components/meal-picker";
import { isEditablePrivateFood, QuickFoodDialog } from "@/components/quick-food-dialog";
import { QuickMealDialog } from "@/components/quick-meal-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  DECIMAL_INPUT_PATTERN,
  EMPTY_MACRO_TOTALS,
  groupPlanDraftEntriesByTimeSlot,
  macroTotalsSummary,
  movePlanDraftEntryWithinSlot,
  type PlanEntry,
  parseMacroInput,
  planEntriesMacroTotals,
  planEntryMacroTotals,
  sortAndRenumberPlanEntriesByTime,
  timeToInputValue,
} from "@/lib/nutrition";

const NutritionPlanFormPickersQuery = graphql(`
  query NutritionPlanFormPickers {
    meals(order_by: [{ name: asc }]) {
      id
      name
      description
      mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
        id
        grams
        position
        food {
          id
          name
          kcalPer100g
          fatPer100g
          carbsPer100g
          proteinPer100g
          fiberPer100g
          sugarPer100g
        }
      }
    }
    foods(order_by: [{ isPublic: asc }, { name: asc }]) {
      id
      name
      userId
      isPublic
      kcalPer100g
      fatPer100g
      carbsPer100g
      proteinPer100g
      fiberPer100g
      sugarPer100g
    }
  }
`);

export type NutritionPlanFormEntryValues =
  | {
      kind: "meal";
      id?: string;
      mealId: string;
      slotTime: string;
      label: string;
      position: number;
    }
  | {
      kind: "food";
      id?: string;
      foodId: string;
      grams: number;
      slotTime: string;
      label: string;
      position: number;
    };

export interface NutritionPlanFormValues {
  name: string;
  description: string;
  entries: NutritionPlanFormEntryValues[];
}

interface NutritionPlanFormProps {
  initialValues: NutritionPlanFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: NutritionPlanFormValues) => void;
  onCancel: () => void;
  extraActions?: ReactNode;
}

type EntryDraft =
  | {
      clientId: string;
      kind: "meal";
      id?: string;
      mealId: string;
      slotTime: string;
      label: string;
    }
  | {
      clientId: string;
      kind: "food";
      id?: string;
      foodId: string;
      grams: string;
      slotTime: string;
      label: string;
    };

type FoodDialogState =
  | { kind: "create"; clientId: string }
  | { kind: "edit"; clientId: string; food: FoodPickerOption };

type MealDialogState =
  | { kind: "create"; clientId: string }
  | { kind: "edit"; clientId: string; meal: MealPickerOption };

let nextEntryId = 0;

function createClientId() {
  nextEntryId += 1;
  return `plan-entry-${Date.now()}-${nextEntryId}`;
}

function sortInitialEntries(entries: NutritionPlanFormEntryValues[]) {
  return sortAndRenumberPlanEntriesByTime(entries);
}

function mergeFoodOptions(baseFoods: FoodPickerOption[], localFoods: FoodPickerOption[]) {
  const byId = new Map<string, FoodPickerOption>();
  for (const food of baseFoods) {
    byId.set(food.id, food);
  }
  for (const food of localFoods) {
    byId.set(food.id, food);
  }
  return Array.from(byId.values()).toSorted(
    (left, right) =>
      Number(left.isPublic) - Number(right.isPublic) || left.name.localeCompare(right.name),
  );
}

function mergeMealOptions(baseMeals: MealPickerOption[], localMeals: MealPickerOption[]) {
  const byId = new Map<string, MealPickerOption>();
  for (const meal of baseMeals) {
    byId.set(meal.id, meal);
  }
  for (const meal of localMeals) {
    byId.set(meal.id, meal);
  }
  return Array.from(byId.values()).toSorted((left, right) => left.name.localeCompare(right.name));
}

function createDraftFromInitialEntry(entry: NutritionPlanFormEntryValues): EntryDraft {
  if (entry.kind === "meal") {
    const draft: EntryDraft = {
      clientId: `meal:${entry.id ?? createClientId()}`,
      kind: "meal",
      mealId: entry.mealId,
      slotTime: timeToInputValue(entry.slotTime),
      label: entry.label,
    };
    if (entry.id) {
      draft.id = entry.id;
    }
    return draft;
  }

  const draft: EntryDraft = {
    clientId: `food:${entry.id ?? createClientId()}`,
    kind: "food",
    foodId: entry.foodId,
    grams: String(entry.grams),
    slotTime: timeToInputValue(entry.slotTime),
    label: "",
  };
  if (entry.id) {
    draft.id = entry.id;
  }
  return draft;
}

function draftEntriesToFormValues(
  entries: Array<EntryDraft & { position: number }>,
): NutritionPlanFormEntryValues[] {
  return entries.map((entry) => {
    const common = {
      slotTime: entry.slotTime,
      position: entry.position,
    };

    if (entry.kind === "meal") {
      const values: NutritionPlanFormEntryValues = {
        kind: "meal",
        mealId: entry.mealId,
        label: entry.label.trim(),
        ...common,
      };
      if (entry.id) {
        values.id = entry.id;
      }
      return values;
    }

    const values: NutritionPlanFormEntryValues = {
      kind: "food",
      foodId: entry.foodId,
      grams: parseMacroInput(entry.grams) ?? 0,
      label: "",
      ...common,
    };
    if (entry.id) {
      values.id = entry.id;
    }
    return values;
  });
}

export function NutritionPlanForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  extraActions,
}: NutritionPlanFormProps) {
  const nameId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [entries, setEntries] = useState<EntryDraft[]>(() =>
    sortInitialEntries(initialValues.entries).map(createDraftFromInitialEntry),
  );
  const [submitted, setSubmitted] = useState(false);
  const [localFoods, setLocalFoods] = useState<FoodPickerOption[]>([]);
  const [localMeals, setLocalMeals] = useState<MealPickerOption[]>([]);
  const [foodDialog, setFoodDialog] = useState<FoodDialogState | null>(null);
  const [mealDialog, setMealDialog] = useState<MealDialogState | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "plan-form", "pickers"],
    queryFn: () => gqlRequest(NutritionPlanFormPickersQuery),
  });

  const meals = useMemo<MealPickerOption[]>(
    () => mergeMealOptions(data?.meals ?? [], localMeals),
    [data, localMeals],
  );
  const foods = useMemo<FoodPickerOption[]>(
    () => mergeFoodOptions(data?.foods ?? [], localFoods),
    [data, localFoods],
  );
  const mealsById = useMemo(() => new Map(meals.map((meal) => [meal.id, meal])), [meals]);
  const foodsById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);

  const sortedEntries = useMemo(() => sortAndRenumberPlanEntriesByTime(entries), [entries]);

  const planEntries = useMemo(
    () =>
      sortedEntries.map((entry) => {
        if (entry.kind === "meal") {
          return {
            kind: "meal" as const,
            id: entry.id ?? entry.clientId,
            slotTime: entry.slotTime,
            label: entry.label,
            position: entry.position,
            meal: mealsById.get(entry.mealId) ?? null,
          };
        }

        return {
          kind: "food" as const,
          id: entry.id ?? entry.clientId,
          slotTime: entry.slotTime,
          label: "",
          position: entry.position,
          grams: parseMacroInput(entry.grams) ?? 0,
          food: foodsById.get(entry.foodId) ?? null,
        };
      }),
    [foodsById, mealsById, sortedEntries],
  );

  const totals = useMemo(() => planEntriesMacroTotals(planEntries), [planEntries]);

  const trimmedName = name.trim();
  const hasMissingMeal = entries.some(
    (entry) => entry.kind === "meal" && (!entry.mealId || !mealsById.has(entry.mealId)),
  );
  const hasMissingFood = entries.some(
    (entry) => entry.kind === "food" && (!entry.foodId || !foodsById.has(entry.foodId)),
  );
  const hasInvalidGrams = entries.some((entry) => {
    if (entry.kind !== "food") {
      return false;
    }
    const grams = parseMacroInput(entry.grams);
    return grams === null || grams <= 0;
  });
  const hasMissingTime = entries.some((entry) => entry.slotTime.trim() === "");
  const nameError = submitted && trimmedName.length === 0 ? "Name is required." : null;
  const entriesError =
    submitted && entries.length === 0 ? "Add at least one meal or food entry to this plan." : null;
  const mealError = submitted && hasMissingMeal ? "Every meal entry needs a selected meal." : null;
  const foodError = submitted && hasMissingFood ? "Every food entry needs a selected food." : null;
  const gramsError =
    submitted && hasInvalidGrams ? "Every food entry needs grams greater than zero." : null;
  const timeError = submitted && hasMissingTime ? "Every entry needs a time of day." : null;
  const formError =
    nameError ?? entriesError ?? mealError ?? foodError ?? gramsError ?? timeError ?? null;
  const canSubmit = !isSubmitting && !isLoading;

  function addMealEntry() {
    setEntries((current) => [
      ...current,
      {
        clientId: createClientId(),
        kind: "meal",
        mealId: "",
        slotTime: "12:00",
        label: "",
      },
    ]);
  }

  function addFoodEntry() {
    setEntries((current) => [
      ...current,
      {
        clientId: createClientId(),
        kind: "food",
        foodId: "",
        grams: "100",
        slotTime: "12:00",
        label: "",
      },
    ]);
  }

  function updateEntry(clientId: string, patch: Partial<EntryDraft>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.clientId === clientId ? ({ ...entry, ...patch } as EntryDraft) : entry,
      ),
    );
  }

  function removeEntry(clientId: string) {
    setEntries((current) => current.filter((entry) => entry.clientId !== clientId));
  }

  function moveEntry(clientId: string, direction: -1 | 1) {
    setEntries((current) =>
      movePlanDraftEntryWithinSlot(current, clientId, direction, (entry) => entry.clientId),
    );
  }

  function rememberFood(food: FoodPickerOption) {
    setLocalFoods((current) => mergeFoodOptions(current, [food]));
  }

  function rememberMeal(meal: MealPickerOption) {
    setLocalMeals((current) => mergeMealOptions(current, [meal]));
  }

  function handleQuickFoodSaved(food: FoodPickerOption) {
    rememberFood(food);
    if (foodDialog?.kind === "create") {
      updateEntry(foodDialog.clientId, { foodId: food.id });
    }
  }

  function handleQuickMealSaved(meal: MealPickerOption) {
    rememberMeal(meal);
    if (mealDialog?.kind === "create") {
      updateEntry(mealDialog.clientId, { mealId: meal.id });
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit || trimmedName.length === 0 || entries.length === 0) {
      return;
    }
    if (hasMissingMeal || hasMissingFood || hasInvalidGrams || hasMissingTime) {
      return;
    }

    onSubmit({
      name: trimmedName,
      description: description.trim(),
      entries: draftEntriesToFormValues(sortedEntries),
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <NutritionPlanDetailsFields
          description={description}
          descriptionId={descriptionId}
          errorId={errorId}
          formError={formError}
          name={name}
          nameError={nameError}
          nameId={nameId}
          onDescriptionChange={setDescription}
          onNameChange={setName}
        />

        <MacroSummary
          totals={totals}
          title="Daily planned totals"
          description="Computed from each selected meal and direct food's current nutrition values."
        />

        <NutritionPlanEntriesSection
          entries={entries}
          error={error}
          errorId={errorId}
          foods={foods}
          formError={formError}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          meals={meals}
          planEntries={planEntries}
          onAddFood={addFoodEntry}
          onAddMeal={addMealEntry}
          onMove={moveEntry}
          onRemove={removeEntry}
          onUpdate={updateEntry}
          onCreateFood={(clientId) => setFoodDialog({ kind: "create", clientId })}
          onEditFood={(clientId, food) => setFoodDialog({ kind: "edit", clientId, food })}
          onCreateMeal={(clientId) => setMealDialog({ kind: "create", clientId })}
          onEditMeal={(clientId, meal) => setMealDialog({ kind: "edit", clientId, meal })}
        />

        <div className="flex flex-col-reverse gap-2 border-border border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>{extraActions}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
          </div>
        </div>
      </form>
      <NutritionPlanInlineDialogs
        foodDialog={foodDialog}
        mealDialog={mealDialog}
        onFoodSaved={handleQuickFoodSaved}
        onMealSaved={handleQuickMealSaved}
        onCloseFood={() => setFoodDialog(null)}
        onCloseMeal={() => setMealDialog(null)}
      />
    </>
  );
}

function NutritionPlanDetailsFields({
  description,
  descriptionId,
  errorId,
  formError,
  name,
  nameError,
  nameId,
  onDescriptionChange,
  onNameChange,
}: {
  description: string;
  descriptionId: string;
  errorId: string;
  formError: string | null;
  name: string;
  nameError: string | null;
  nameId: string;
  onDescriptionChange: (description: string) => void;
  onNameChange: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={nameId} className="text-sm font-medium">
          Plan name
        </label>
        <Input
          id={nameId}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g. Training day"
          maxLength={160}
          aria-invalid={Boolean(nameError)}
          aria-describedby={formError ? errorId : undefined}
          autoFocus
          required
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={descriptionId} className="text-sm font-medium">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id={descriptionId}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="When you use this one-day template or any prep notes."
          maxLength={1000}
          rows={3}
        />
      </div>
    </div>
  );
}

function NutritionPlanInlineDialogs({
  foodDialog,
  mealDialog,
  onCloseFood,
  onCloseMeal,
  onFoodSaved,
  onMealSaved,
}: {
  foodDialog: FoodDialogState | null;
  mealDialog: MealDialogState | null;
  onCloseFood: () => void;
  onCloseMeal: () => void;
  onFoodSaved: (food: FoodPickerOption) => void;
  onMealSaved: (meal: MealPickerOption) => void;
}) {
  return (
    <>
      {foodDialog ? (
        <QuickFoodDialog
          open={true}
          mode={
            foodDialog.kind === "create"
              ? { kind: "create" }
              : { kind: "edit", food: foodDialog.food }
          }
          onOpenChange={(open) => {
            if (!open) {
              onCloseFood();
            }
          }}
          onSaved={onFoodSaved}
        />
      ) : null}
      {mealDialog ? (
        <QuickMealDialog
          open={true}
          mode={
            mealDialog.kind === "create"
              ? { kind: "create" }
              : { kind: "edit", meal: mealDialog.meal }
          }
          onOpenChange={(open) => {
            if (!open) {
              onCloseMeal();
            }
          }}
          onSaved={onMealSaved}
        />
      ) : null}
    </>
  );
}

function NutritionPlanEntriesSection({
  entries,
  error,
  errorId,
  foods,
  formError,
  isLoading,
  isSubmitting,
  meals,
  planEntries,
  onAddFood,
  onAddMeal,
  onMove,
  onRemove,
  onUpdate,
  onCreateFood,
  onEditFood,
  onCreateMeal,
  onEditMeal,
}: {
  entries: EntryDraft[];
  error: Error | null;
  errorId: string;
  foods: FoodPickerOption[];
  formError: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  meals: MealPickerOption[];
  planEntries: PlanEntry[];
  onAddFood: () => void;
  onAddMeal: () => void;
  onMove: (clientId: string, direction: -1 | 1) => void;
  onRemove: (clientId: string) => void;
  onUpdate: (clientId: string, patch: Partial<EntryDraft>) => void;
  onCreateFood: (clientId: string) => void;
  onEditFood: (clientId: string, food: FoodPickerOption) => void;
  onCreateMeal: (clientId: string) => void;
  onEditMeal: (clientId: string, meal: MealPickerOption) => void;
}) {
  const planEntriesById = useMemo(
    () => new Map(planEntries.map((entry) => [entry.id, entry])),
    [planEntries],
  );
  const slotGroups = useMemo(
    () =>
      groupPlanDraftEntriesByTimeSlot(entries, {
        getEntryTotals: (entry) => {
          const matchingPlanEntry = planEntriesById.get(entry.id ?? entry.clientId);
          return matchingPlanEntry ? planEntryMacroTotals(matchingPlanEntry) : EMPTY_MACRO_TOTALS;
        },
      }),
    [entries, planEntriesById],
  );

  return (
    <section className="space-y-3" aria-describedby={formError ? errorId : undefined}>
      <div>
        <h2 className="text-sm font-medium">Plan entries</h2>
        <p className="text-[13px] text-muted-foreground">
          Add meals or foods at a time of day. Entries with the same time form one slot.
        </p>
      </div>

      {isLoading ? <NutritionPlanFormSkeleton /> : null}
      {error ? (
        <p className="text-sm text-destructive">Failed to load meals and foods: {error.message}</p>
      ) : null}

      {!isLoading && entries.length === 0 ? (
        <Card className="border-border border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Add at least one timed meal or food entry to define this reusable daily template.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {slotGroups.map((slot) => (
          <Card key={slot.key} className="gap-0 py-0">
            <CardContent className="p-4 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pb-2">
                <h3 className="text-[15px] font-semibold tabular-nums">{slot.label}</h3>
                <p className="text-[13px] text-muted-foreground tabular-nums">
                  {Math.round(slot.totals.kcal).toLocaleString()} kcal · P{" "}
                  {Math.round(slot.totals.protein)} · C {Math.round(slot.totals.carbs)} · F{" "}
                  {Math.round(slot.totals.fat)}
                </p>
              </div>
              <div>
                {slot.entries.map((entry, index) => {
                  const matchingPlanEntry = planEntriesById.get(entry.id ?? entry.clientId);
                  return (
                    <NutritionPlanEntryCard
                      key={entry.clientId}
                      entry={entry}
                      index={index}
                      entryCount={slot.entries.length}
                      meals={meals}
                      foods={foods}
                      isSubmitting={isSubmitting}
                      entryTotals={
                        matchingPlanEntry ? planEntryMacroTotals(matchingPlanEntry) : null
                      }
                      onMove={onMove}
                      onRemove={onRemove}
                      onUpdate={onUpdate}
                      onCreateFood={onCreateFood}
                      onEditFood={onEditFood}
                      onCreateMeal={onCreateMeal}
                      onEditMeal={onEditMeal}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onAddMeal} disabled={isLoading}>
          <Plus className="h-4 w-4" />
          Add meal entry
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onAddFood} disabled={isLoading}>
          <Plus className="h-4 w-4" />
          Add food entry
        </Button>
      </div>

      {formError ? (
        <p id={errorId} className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
    </section>
  );
}

function NutritionPlanEntryCard({
  entry,
  index,
  entryCount,
  meals,
  foods,
  isSubmitting,
  entryTotals,
  onMove,
  onRemove,
  onUpdate,
  onCreateFood,
  onEditFood,
  onCreateMeal,
  onEditMeal,
}: {
  entry: EntryDraft;
  index: number;
  entryCount: number;
  meals: MealPickerOption[];
  foods: FoodPickerOption[];
  isSubmitting: boolean;
  entryTotals: ReturnType<typeof planEntryMacroTotals> | null;
  onMove: (clientId: string, direction: -1 | 1) => void;
  onRemove: (clientId: string) => void;
  onUpdate: (clientId: string, patch: Partial<EntryDraft>) => void;
  onCreateFood: (clientId: string) => void;
  onEditFood: (clientId: string, food: FoodPickerOption) => void;
  onCreateMeal: (clientId: string) => void;
  onEditMeal: (clientId: string, meal: MealPickerOption) => void;
}) {
  const timeId = `${entry.clientId}-time`;
  const labelId = entry.kind === "meal" ? `${entry.clientId}-label` : undefined;
  const gramsId = `${entry.clientId}-grams`;
  const selectedMeal =
    entry.kind === "meal" ? (meals.find((meal) => meal.id === entry.mealId) ?? null) : null;
  const selectedFood =
    entry.kind === "food" ? (foods.find((food) => food.id === entry.foodId) ?? null) : null;
  const canEditFood = isEditablePrivateFood(selectedFood);

  return (
    <div className="flex flex-col gap-1.5 border-t py-3">
      <div className="grid items-center gap-2 sm:grid-cols-[8.75rem_minmax(0,1fr)_7rem_auto]">
        <div>
          <label htmlFor={timeId} className="sr-only">
            Time of day
          </label>
          <Input
            id={timeId}
            type="time"
            value={entry.slotTime}
            onChange={(event) => onUpdate(entry.clientId, { slotTime: event.target.value })}
            disabled={isSubmitting}
            required
            className="h-9 tabular-nums"
          />
        </div>
        <div className="min-w-0">
          {entry.kind === "meal" ? (
            <MealPicker
              meals={meals}
              value={entry.mealId}
              onChange={(mealId) => onUpdate(entry.clientId, { mealId })}
              disabled={isSubmitting}
            />
          ) : (
            <FoodPicker
              foods={foods}
              value={entry.foodId}
              onChange={(foodId) => onUpdate(entry.clientId, { foodId })}
              disabled={isSubmitting}
            />
          )}
        </div>
        {entry.kind === "meal" ? (
          <div>
            <label htmlFor={labelId} className="sr-only">
              Label (optional)
            </label>
            <Input
              id={labelId}
              value={entry.label}
              onChange={(event) => onUpdate(entry.clientId, { label: event.target.value })}
              placeholder="Label"
              maxLength={160}
              disabled={isSubmitting}
              className="h-9"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <label htmlFor={gramsId} className="sr-only">
              Grams
            </label>
            <Input
              id={gramsId}
              type="text"
              inputMode="decimal"
              pattern={DECIMAL_INPUT_PATTERN}
              value={entry.grams}
              onChange={(event) => onUpdate(entry.clientId, { grams: event.target.value })}
              placeholder="100"
              disabled={isSubmitting}
              className="h-9 text-right tabular-nums"
            />
            <span className="text-[13px] text-muted-foreground">g</span>
          </div>
        )}
        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground"
            onClick={() => onMove(entry.clientId, -1)}
            disabled={index === 0 || isSubmitting}
            aria-label="Move entry up"
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground"
            onClick={() => onMove(entry.clientId, 1)}
            disabled={index === entryCount - 1 || isSubmitting}
            aria-label="Move entry down"
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(entry.clientId)}
            disabled={isSubmitting}
            aria-label="Remove entry"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
        <span
          className={
            entry.kind === "meal"
              ? "rounded bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent-soft-foreground"
              : "rounded bg-muted px-1.5 py-px text-[11px] font-semibold text-foreground/80"
          }
        >
          {entry.kind === "meal" ? "MEAL" : "FOOD"}
        </span>
        {entryTotals ? (
          <span className="tabular-nums">{macroTotalsSummary(entryTotals)}</span>
        ) : null}
        <span className="flex-1" />
        {entry.kind === "meal" ? (
          <>
            {selectedMeal ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-link hover:underline disabled:opacity-50"
                onClick={() => onEditMeal(entry.clientId, selectedMeal)}
                disabled={isSubmitting}
              >
                <Pencil className="size-3" />
                Edit meal
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-link hover:underline disabled:opacity-50"
              onClick={() => onCreateMeal(entry.clientId)}
              disabled={isSubmitting}
            >
              <Plus className="size-3" />
              New meal
            </button>
          </>
        ) : (
          <>
            {selectedFood?.isPublic ? <span>Public food · read-only</span> : null}
            {canEditFood && selectedFood ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-link hover:underline disabled:opacity-50"
                onClick={() => onEditFood(entry.clientId, selectedFood)}
                disabled={isSubmitting}
              >
                <Pencil className="size-3" />
                Edit food
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-link hover:underline disabled:opacity-50"
              onClick={() => onCreateFood(entry.clientId)}
              disabled={isSubmitting}
            >
              <Plus className="size-3" />
              New private food
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NutritionPlanFormSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-28 w-full" />
      </CardContent>
    </Card>
  );
}
