import { useQuery } from "@tanstack/react-query";
import { Apple, ArrowDown, ArrowUp, ChefHat, Plus, Trash2 } from "lucide-react";
import { type ReactNode, type SubmitEvent, useId, useMemo, useState } from "react";
import { FoodPicker, type FoodPickerOption } from "@/components/food-picker";
import { MacroSummary } from "@/components/macro-summary";
import { MealPicker, type MealPickerOption } from "@/components/meal-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  DECIMAL_INPUT_PATTERN,
  macroTotalsSummary,
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

let nextEntryId = 0;

function createClientId() {
  nextEntryId += 1;
  return `plan-entry-${Date.now()}-${nextEntryId}`;
}

function sortInitialEntries(entries: NutritionPlanFormEntryValues[]) {
  return sortAndRenumberPlanEntriesByTime(entries);
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
    label: entry.label,
  };
  if (entry.id) {
    draft.id = entry.id;
  }
  return draft;
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "plan-form", "pickers"],
    queryFn: () => gqlRequest(NutritionPlanFormPickersQuery),
  });

  const meals = useMemo<MealPickerOption[]>(() => data?.meals ?? [], [data]);
  const foods = useMemo<FoodPickerOption[]>(() => data?.foods ?? [], [data]);
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
          label: entry.label,
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
    setEntries((current) => {
      const index = current.findIndex((entry) => entry.clientId === clientId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = current.slice();
      const [item] = next.splice(index, 1);
      if (!item) {
        return current;
      }
      next.splice(targetIndex, 0, item);
      return next;
    });
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
      entries: sortedEntries.map((entry) => {
        const common = {
          slotTime: entry.slotTime,
          label: entry.label.trim(),
          position: entry.position,
        };
        if (entry.kind === "meal") {
          const values: NutritionPlanFormEntryValues = {
            kind: "meal",
            mealId: entry.mealId,
            ...common,
          };
          if (entry.id) {
            values.id = entry.id;
          }
          return values;
        }

        const grams = parseMacroInput(entry.grams);
        const values: NutritionPlanFormEntryValues = {
          kind: "food",
          foodId: entry.foodId,
          grams: grams ?? 0,
          ...common,
        };
        if (entry.id) {
          values.id = entry.id;
        }
        return values;
      }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            Plan name
          </label>
          <Input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
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
            onChange={(event) => setDescription(event.target.value)}
            placeholder="When you use this one-day template or any prep notes."
            maxLength={1000}
            rows={3}
          />
        </div>
      </div>

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
      />

      <div className="flex flex-col-reverse gap-2 border-border/60 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
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
}) {
  return (
    <section className="space-y-3" aria-describedby={formError ? errorId : undefined}>
      <div>
        <h2 className="text-sm font-medium">Plan entries</h2>
        <p className="text-xs text-muted-foreground">
          Add meal templates or direct foods. Entries sort by time; positions are shared across
          meals and foods within each time slot.
        </p>
      </div>

      {isLoading ? <NutritionPlanFormSkeleton /> : null}
      {error ? (
        <p className="text-sm text-destructive">Failed to load meals and foods: {error.message}</p>
      ) : null}

      {!isLoading && entries.length === 0 ? (
        <Card className="border-border/60 border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Add at least one timed meal or food entry to define this reusable daily template.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {entries.map((entry, index) => {
          const matchingPlanEntry = planEntries.find(
            (planEntry) => planEntry.id === (entry.id ?? entry.clientId),
          );
          return (
            <NutritionPlanEntryCard
              key={entry.clientId}
              entry={entry}
              index={index}
              entryCount={entries.length}
              meals={meals}
              foods={foods}
              isSubmitting={isSubmitting}
              entryTotals={matchingPlanEntry ? planEntryMacroTotals(matchingPlanEntry) : null}
              onMove={onMove}
              onRemove={onRemove}
              onUpdate={onUpdate}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
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
}) {
  const timeId = `${entry.clientId}-time`;
  const labelId = `${entry.clientId}-label`;
  const gramsId = `${entry.clientId}-grams`;

  return (
    <Card className="border-border/60 bg-muted/20">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant={entry.kind === "meal" ? "primary" : "success"}>
              {entry.kind === "meal" ? (
                <ChefHat className="h-3 w-3" />
              ) : (
                <Apple className="h-3 w-3" />
              )}
              {entry.kind === "meal" ? "Meal" : "Food"}
            </Badge>
            <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Entry {index + 1}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onMove(entry.clientId, -1)}
              disabled={index === 0 || isSubmitting}
              aria-label="Move entry up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onMove(entry.clientId, 1)}
              disabled={index === entryCount - 1 || isSubmitting}
              aria-label="Move entry down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onRemove(entry.clientId)}
              disabled={isSubmitting}
              aria-label="Remove entry"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_1fr]">
          <div className="space-y-1.5">
            <label htmlFor={timeId} className="text-sm font-medium">
              Time of day
            </label>
            <Input
              id={timeId}
              type="time"
              value={entry.slotTime}
              onChange={(event) => onUpdate(entry.clientId, { slotTime: event.target.value })}
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={labelId} className="text-sm font-medium">
              Label <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id={labelId}
              value={entry.label}
              onChange={(event) => onUpdate(entry.clientId, { label: event.target.value })}
              placeholder="e.g. Post-workout"
              maxLength={160}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {entry.kind === "meal" ? (
          <MealPicker
            meals={meals}
            value={entry.mealId}
            onChange={(mealId) => onUpdate(entry.clientId, { mealId })}
            disabled={isSubmitting}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,10rem)]">
            <FoodPicker
              foods={foods}
              value={entry.foodId}
              onChange={(foodId) => onUpdate(entry.clientId, { foodId })}
              disabled={isSubmitting}
            />
            <div className="space-y-1.5">
              <label htmlFor={gramsId} className="text-sm font-medium">
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
              />
            </div>
          </div>
        )}

        {entryTotals ? (
          <p className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            {macroTotalsSummary(entryTotals)}
          </p>
        ) : null}
      </CardContent>
    </Card>
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
