import { type SubmitEvent, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DECIMAL_INPUT_PATTERN, parseMacroInput } from "@/lib/nutrition";

export interface FoodFormValues {
  name: string;
  kcalPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
}

interface FoodFormProps {
  initialValues: FoodFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: FoodFormValues) => void;
  onCancel: () => void;
  extraActions?: React.ReactNode;
}

type NutrientKey = Exclude<keyof FoodFormValues, "name">;

const NUTRIENT_FIELDS: { key: NutrientKey; label: string; suffix: string }[] = [
  { key: "kcalPer100g", label: "Calories", suffix: "kcal" },
  { key: "fatPer100g", label: "Fat", suffix: "g" },
  { key: "carbsPer100g", label: "Carbs", suffix: "g" },
  { key: "proteinPer100g", label: "Protein", suffix: "g" },
  { key: "fiberPer100g", label: "Fiber", suffix: "g" },
  { key: "sugarPer100g", label: "Sugar", suffix: "g" },
];

function numberToInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

export function FoodForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  extraActions,
}: FoodFormProps) {
  const nameId = useId();
  const nameErrorId = useId();
  const baseNutrientId = useId();
  const [name, setName] = useState(initialValues.name);
  const [nutrients, setNutrients] = useState<Record<NutrientKey, string>>(() => ({
    kcalPer100g: numberToInput(initialValues.kcalPer100g),
    fatPer100g: numberToInput(initialValues.fatPer100g),
    carbsPer100g: numberToInput(initialValues.carbsPer100g),
    proteinPer100g: numberToInput(initialValues.proteinPer100g),
    fiberPer100g: numberToInput(initialValues.fiberPer100g),
    sugarPer100g: numberToInput(initialValues.sugarPer100g),
  }));
  const [submitted, setSubmitted] = useState(false);

  const trimmedName = name.trim();
  const parsedNutrients = useMemo(() => {
    const next = {} as Record<NutrientKey, number | null>;
    for (const field of NUTRIENT_FIELDS) {
      next[field.key] = parseMacroInput(nutrients[field.key]);
    }
    return next;
  }, [nutrients]);

  const nameError = submitted && trimmedName.length === 0 ? "Name is required." : null;
  const fieldErrors = useMemo(() => {
    const next = {} as Record<NutrientKey, string | null>;
    for (const field of NUTRIENT_FIELDS) {
      next[field.key] =
        submitted && parsedNutrients[field.key] === null
          ? `${field.label} must be zero or greater.`
          : null;
    }
    return next;
  }, [parsedNutrients, submitted]);

  const canSubmit = !isSubmitting;

  function handleNutrientChange(key: NutrientKey, value: string) {
    setNutrients((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit || trimmedName.length === 0) {
      return;
    }
    for (const field of NUTRIENT_FIELDS) {
      if (parsedNutrients[field.key] === null) {
        return;
      }
    }
    onSubmit({
      name: trimmedName,
      kcalPer100g: parsedNutrients.kcalPer100g ?? 0,
      fatPer100g: parsedNutrients.fatPer100g ?? 0,
      carbsPer100g: parsedNutrients.carbsPer100g ?? 0,
      proteinPer100g: parsedNutrients.proteinPer100g ?? 0,
      fiberPer100g: parsedNutrients.fiberPer100g ?? 0,
      sugarPer100g: parsedNutrients.sugarPer100g ?? 0,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            Food name
          </label>
          <Input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Greek yogurt"
            maxLength={160}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? nameErrorId : undefined}
            autoFocus
            required
          />
          {nameError ? (
            <p id={nameErrorId} className="text-xs text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium">Nutrition per 100 g</h2>
            <p className="text-xs text-muted-foreground">
              Store nutrients using the canonical per-100g values from the package label.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {NUTRIENT_FIELDS.map((field) => {
              const id = `${baseNutrientId}-${field.key}`;
              const errorId = `${id}-error`;
              const error = fieldErrors[field.key];
              return (
                <div key={field.key} className="space-y-1.5">
                  <label htmlFor={id} className="text-sm font-medium">
                    {field.label}
                  </label>
                  <div className="relative">
                    <Input
                      id={id}
                      type="text"
                      inputMode="decimal"
                      pattern={DECIMAL_INPUT_PATTERN}
                      value={nutrients[field.key]}
                      onChange={(event) => handleNutrientChange(field.key, event.target.value)}
                      className="pr-12"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      required
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                      {field.suffix}
                    </span>
                  </div>
                  {error ? (
                    <p id={errorId} className="text-xs text-destructive">
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
