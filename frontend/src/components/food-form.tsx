import { type ReactNode, type SubmitEvent, useId, useMemo, useState } from "react";
import { FormActions } from "@/components/patterns/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormPageSlots } from "@/lib/form-page-context";
import {
  DECIMAL_INPUT_PATTERN,
  NUTRIENT_FIELDS,
  type NutrientKey,
  parseMacroInput,
} from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export interface FoodFormValues {
  name: string;
  kcalPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  proteinPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
}

/** Caption under the name of a new food (Web-FoodEditor). */
export const NEW_FOOD_CAPTION =
  "New foods are private to you. Public foods are read-only; create a private copy to change values.";
/** Caption under the name of an existing private food. */
export const EDIT_FOOD_CAPTION =
  "Editing a food never changes days already logged; they keep their snapshot.";

interface FoodFormProps {
  initialValues: FoodFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: FoodFormValues) => void;
  onCancel: () => void;
  extraActions?: ReactNode;
  /** Caption under the name; defaults to the new-food privacy note, `null` hides it. */
  nameCaption?: ReactNode;
}

function numberToInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

const CARD = "rounded-xl border bg-card p-5";

/**
 * Food name and per-100 g values. On a form page it lays out the board's two
 * section cards; inside a dialog the same fields sit flat on the dialog.
 */
export function FoodForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  extraActions,
  nameCaption = NEW_FOOD_CAPTION,
}: FoodFormProps) {
  const page = useFormPageSlots();
  const onPage = page !== null;
  const nameId = useId();
  const nameErrorId = useId();
  const captionId = useId();
  const nutritionHeadingId = useId();
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

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (isSubmitting || trimmedName.length === 0) {
      return;
    }
    if (NUTRIENT_FIELDS.some((field) => parsedNutrients[field.key] === null)) {
      return;
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

  const describedBy = [nameError ? nameErrorId : null, nameCaption ? captionId : null]
    .filter(Boolean)
    .join(" ");
  const SectionHeading = onPage ? "h2" : "h3";

  return (
    <form id={page?.formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className={cn("flex flex-col gap-4", onPage && CARD)}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nameId}>Food name</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Greek yogurt"
            maxLength={160}
            aria-invalid={Boolean(nameError)}
            aria-describedby={describedBy || undefined}
            autoFocus
            required
          />
          {nameError ? (
            <p id={nameErrorId} className="text-[13px] text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>
        {nameCaption ? (
          <p id={captionId} className="text-[13px] text-muted-foreground">
            {nameCaption}
          </p>
        ) : null}
      </div>

      <section
        aria-labelledby={nutritionHeadingId}
        className={cn("flex flex-col gap-3.5", onPage && CARD)}
      >
        <div className="flex flex-col gap-1">
          <SectionHeading id={nutritionHeadingId} className="text-[15px] font-semibold">
            Nutrition per 100 g
          </SectionHeading>
          <p className="text-[13px] text-muted-foreground">
            Copy the per-100 g values from the package label.
          </p>
        </div>
        <NutrientGrid
          values={nutrients}
          parsed={parsedNutrients}
          showErrors={submitted}
          onChange={(key, value) => setNutrients((current) => ({ ...current, [key]: value }))}
        />
      </section>

      <FormActions
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        submitDisabled={false}
        onCancel={onCancel}
        extraActions={extraActions}
        className="border-border border-t pt-4"
      />
    </form>
  );
}

/** Energy, Protein, Carbs, Fat, Fiber, Sugar: unit beside the label, right-aligned values. */
function NutrientGrid({
  values,
  parsed,
  showErrors,
  onChange,
}: {
  values: Record<NutrientKey, string>;
  parsed: Record<NutrientKey, number | null>;
  showErrors: boolean;
  onChange: (key: NutrientKey, value: string) => void;
}) {
  const baseId = useId();
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-3.5">
      {NUTRIENT_FIELDS.map((field) => {
        const id = `${baseId}-${field.key}`;
        const errorId = `${id}-error`;
        const error =
          showErrors && parsed[field.key] === null
            ? `${field.label} must be zero or greater.`
            : null;
        return (
          <div key={field.key} className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={id} className="gap-1">
              {field.label}
              <span className="font-medium text-muted-foreground">{field.suffix}</span>
            </Label>
            <Input
              id={id}
              type="text"
              inputMode="decimal"
              pattern={DECIMAL_INPUT_PATTERN}
              value={values[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="text-right tabular-nums"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              required
            />
            {error ? (
              <p id={errorId} className="text-[13px] text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
