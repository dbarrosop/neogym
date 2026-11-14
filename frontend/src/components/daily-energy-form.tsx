import { type ChangeEvent, type ReactNode, type SubmitEvent, useState } from "react";
import {
  EntryFormLayout,
  type EntryFormVariant,
  EntryNumberField,
} from "@/components/entry-form-fields";
import { FormActions } from "@/components/patterns/form-actions";
import {
  acceptsDailyEnergyNumericInput,
  type DailyEnergyFormValues,
  validateDailyEnergyFormValues,
} from "@/lib/daily-energy";
import { useFormPageFormId } from "@/lib/form-page-context";
import type { EntryFormError } from "@/lib/progress-entries";

export type { DailyEnergyFormValues } from "@/lib/daily-energy";

interface DailyEnergyFormProps {
  initialValues: DailyEnergyFormValues;
  submitLabel: string;
  onSubmit: (values: DailyEnergyFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  extraActions?: ReactNode;
  /** `page` (default) for the full-page editor, `quick` for the Energy page card. */
  variant?: EntryFormVariant;
  /** The last failed save (`dailyEnergyMutationError`), shown inline. */
  serverError?: EntryFormError | null;
  /** Called on every edit, so the caller can clear `serverError`. */
  onEdit?: () => void;
}

export function DailyEnergyForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting,
  extraActions,
  variant = "page",
  serverError = null,
  onEdit,
}: DailyEnergyFormProps) {
  const formId = useFormPageFormId();
  const [energyOn, setEnergyOn] = useState(initialValues.energyOn);
  const [activeKcal, setActiveKcal] = useState(initialValues.activeKcal);
  const [restingKcal, setRestingKcal] = useState(initialValues.restingKcal);
  const [notes, setNotes] = useState(initialValues.notes);
  const [error, setError] = useState<string | null>(null);
  const hasValue = activeKcal.trim() !== "" || restingKcal.trim() !== "";

  function edited<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      onEdit?.();
    };
  }

  function numeric(setter: (value: string) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      if (acceptsDailyEnergyNumericInput(event.target.value)) {
        edited(setter)(event.target.value);
      }
    };
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateDailyEnergyFormValues({ energyOn, activeKcal, restingKcal, notes });
    if (!result.success) {
      setError(result.message);
      return;
    }
    setError(null);
    onSubmit(result.values);
  }

  return (
    <EntryFormLayout
      variant={variant}
      formId={formId}
      onSubmit={handleSubmit}
      date={energyOn}
      onDateChange={edited(setEnergyOn)}
      dateError={serverError?.field === "date" ? serverError.message : null}
      fields={
        <>
          <EntryNumberField
            label="Active"
            unit="kcal"
            placeholder="650"
            value={activeKcal}
            onChange={numeric(setActiveKcal)}
          />
          <EntryNumberField
            label="Resting"
            unit="kcal"
            placeholder="1800"
            value={restingKcal}
            onChange={numeric(setRestingKcal)}
          />
        </>
      }
      notes={notes}
      onNotesChange={edited(setNotes)}
      notesPlaceholder="Anything worth remembering about this energy day."
      error={error ?? (serverError && serverError.field !== "date" ? serverError.message : null)}
      caption="One entry per date with at least one value."
      actions={
        <FormActions
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          submitDisabled={!hasValue}
          onCancel={onCancel}
          extraActions={extraActions}
        />
      }
    />
  );
}
