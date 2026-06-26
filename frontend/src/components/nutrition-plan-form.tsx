import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type SubmitEvent, useId, useMemo, useState } from "react";
import { MacroSummary } from "@/components/macro-summary";
import { MealPicker, type MealPickerOption } from "@/components/meal-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { planMacroTotals, timeToInputValue } from "@/lib/nutrition";

const NutritionPlanFormMealsQuery = graphql(`
  query NutritionPlanFormMeals {
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
  }
`);

export interface NutritionPlanFormSlotValues {
  id?: string;
  mealId: string;
  slotTime: string;
  label: string;
  position: number;
}

export interface NutritionPlanFormValues {
  name: string;
  description: string;
  slots: NutritionPlanFormSlotValues[];
}

interface NutritionPlanFormProps {
  initialValues: NutritionPlanFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: NutritionPlanFormValues) => void;
  onCancel: () => void;
  extraActions?: React.ReactNode;
}

type SlotDraft = {
  clientId: string;
  id?: string;
  mealId: string;
  slotTime: string;
  label: string;
};

let nextSlotId = 0;

function createClientId() {
  nextSlotId += 1;
  return `plan-slot-${Date.now()}-${nextSlotId}`;
}

function sortInitialSlots(slots: NutritionPlanFormSlotValues[]) {
  return slots.slice().sort((left, right) => {
    const byTime = left.slotTime.localeCompare(right.slotTime);
    if (byTime !== 0) {
      return byTime;
    }
    return left.position - right.position;
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
  const [slots, setSlots] = useState<SlotDraft[]>(() =>
    sortInitialSlots(initialValues.slots).map((slot) => {
      const draft: SlotDraft = {
        clientId: slot.id ?? createClientId(),
        mealId: slot.mealId,
        slotTime: timeToInputValue(slot.slotTime),
        label: slot.label,
      };
      if (slot.id) {
        draft.id = slot.id;
      }
      return draft;
    }),
  );
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "meals", "picker"],
    queryFn: () => gqlRequest(NutritionPlanFormMealsQuery),
  });

  const meals = useMemo<MealPickerOption[]>(() => data?.meals ?? [], [data]);
  const mealsById = useMemo(() => new Map(meals.map((meal) => [meal.id, meal])), [meals]);

  const sortedSlots = useMemo(
    () =>
      slots
        .map((slot, index) => ({ ...slot, position: index }))
        .sort((left, right) => {
          const byTime = left.slotTime.localeCompare(right.slotTime);
          if (byTime !== 0) {
            return byTime;
          }
          return left.position - right.position;
        }),
    [slots],
  );

  const totals = useMemo(
    () =>
      planMacroTotals(
        sortedSlots.map((slot) => ({
          meal: mealsById.get(slot.mealId) ?? null,
        })),
      ),
    [mealsById, sortedSlots],
  );

  const trimmedName = name.trim();
  const hasMissingMeal = slots.some((slot) => !slot.mealId || !mealsById.has(slot.mealId));
  const hasMissingTime = slots.some((slot) => slot.slotTime.trim() === "");
  const nameError = submitted && trimmedName.length === 0 ? "Name is required." : null;
  const slotsError =
    submitted && slots.length === 0 ? "Add at least one meal slot to this plan." : null;
  const mealError = submitted && hasMissingMeal ? "Every slot needs a selected meal." : null;
  const timeError = submitted && hasMissingTime ? "Every slot needs a time of day." : null;
  const formError = nameError ?? slotsError ?? mealError ?? timeError ?? null;
  const canSubmit = !isSubmitting && !isLoading;

  function addSlot() {
    setSlots((current) => [
      ...current,
      {
        clientId: createClientId(),
        mealId: "",
        slotTime: "12:00",
        label: "",
      },
    ]);
  }

  function updateSlot(clientId: string, patch: Partial<SlotDraft>) {
    setSlots((current) =>
      current.map((slot) => (slot.clientId === clientId ? { ...slot, ...patch } : slot)),
    );
  }

  function removeSlot(clientId: string) {
    setSlots((current) => current.filter((slot) => slot.clientId !== clientId));
  }

  function moveSlot(clientId: string, direction: -1 | 1) {
    setSlots((current) => {
      const index = current.findIndex((slot) => slot.clientId === clientId);
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
    if (!canSubmit || trimmedName.length === 0 || slots.length === 0) {
      return;
    }
    if (hasMissingMeal || hasMissingTime) {
      return;
    }
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      slots: sortedSlots.map((slot, position) => {
        const values: NutritionPlanFormSlotValues = {
          mealId: slot.mealId,
          slotTime: slot.slotTime,
          label: slot.label.trim(),
          position,
        };
        if (slot.id) {
          values.id = slot.id;
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
        description="Computed from each selected meal's current food nutrition values."
      />

      <section className="space-y-3" aria-describedby={formError ? errorId : undefined}>
        <div>
          <h2 className="text-sm font-medium">Meal slots</h2>
          <p className="text-xs text-muted-foreground">
            Add required local times of day. Slots sort by time, then stable position.
          </p>
        </div>

        {isLoading ? <NutritionPlanFormSkeleton /> : null}
        {error ? (
          <p className="text-sm text-destructive">Failed to load meals: {error.message}</p>
        ) : null}

        {!isLoading && slots.length === 0 ? (
          <Card className="border-border/60 border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Add at least one timed meal slot to define this reusable daily template.
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-3">
          {slots.map((slot, index) => {
            const timeId = `${slot.clientId}-time`;
            const labelId = `${slot.clientId}-label`;
            return (
              <Card key={slot.clientId} className="border-border/60 bg-muted/20">
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Slot {index + 1}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => moveSlot(slot.clientId, -1)}
                        disabled={index === 0 || isSubmitting}
                        aria-label="Move slot up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => moveSlot(slot.clientId, 1)}
                        disabled={index === slots.length - 1 || isSubmitting}
                        aria-label="Move slot down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeSlot(slot.clientId)}
                        disabled={isSubmitting}
                        aria-label="Remove slot"
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
                        value={slot.slotTime}
                        onChange={(event) =>
                          updateSlot(slot.clientId, { slotTime: event.target.value })
                        }
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
                        value={slot.label}
                        onChange={(event) =>
                          updateSlot(slot.clientId, { label: event.target.value })
                        }
                        placeholder="e.g. Post-workout"
                        maxLength={160}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <MealPicker
                    meals={meals}
                    value={slot.mealId}
                    onChange={(mealId) => updateSlot(slot.clientId, { mealId })}
                    disabled={isSubmitting}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" onClick={addSlot} disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Add slot
          </Button>
        </div>

        {formError ? (
          <p id={errorId} className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
      </section>

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
