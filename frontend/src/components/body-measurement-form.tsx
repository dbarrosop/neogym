import { type ChangeEvent, type ReactNode, type SubmitEvent, useState } from "react";
import {
  EntryFormLayout,
  type EntryFormVariant,
  EntryNumberField,
} from "@/components/entry-form-fields";
import { FormActions } from "@/components/patterns/form-actions";
import {
  acceptsBodyMeasurementInput,
  type BodyMeasurementFormValues,
  validateBodyMeasurementFormValues,
} from "@/lib/body-measurements";
import { useFormPageFormId } from "@/lib/form-page-context";
import type { EntryFormError } from "@/lib/progress-entries";

export type { BodyMeasurementFormValues } from "@/lib/body-measurements";

interface BodyMeasurementFormProps {
  initialValues: BodyMeasurementFormValues;
  submitLabel: string;
  onSubmit: (values: BodyMeasurementFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  extraActions?: ReactNode;
  /** `page` (default) for the full-page editor, `quick` for the Body page card. */
  variant?: EntryFormVariant;
  /** The last failed save (`bodyMeasurementMutationError`), shown inline. */
  serverError?: EntryFormError | null;
  /** Called on every edit, so the caller can clear `serverError`. */
  onEdit?: () => void;
}

export function BodyMeasurementForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting,
  extraActions,
  variant = "page",
  serverError = null,
  onEdit,
}: BodyMeasurementFormProps) {
  const formId = useFormPageFormId();
  const [measuredOn, setMeasuredOn] = useState(initialValues.measuredOn);
  const [weightKg, setWeightKg] = useState(initialValues.weightKg);
  const [bodyFatPct, setBodyFatPct] = useState(initialValues.bodyFatPct);
  const [notes, setNotes] = useState(initialValues.notes);
  const [error, setError] = useState<string | null>(null);
  const hasValue = weightKg.trim() !== "" || bodyFatPct.trim() !== "";

  function edited<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      onEdit?.();
    };
  }

  function numeric(setter: (value: string) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      if (acceptsBodyMeasurementInput(event.target.value)) {
        edited(setter)(event.target.value);
      }
    };
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateBodyMeasurementFormValues({ measuredOn, weightKg, bodyFatPct, notes });
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
      date={measuredOn}
      onDateChange={edited(setMeasuredOn)}
      dateError={serverError?.field === "date" ? serverError.message : null}
      fields={
        <>
          <EntryNumberField
            label="Weight"
            unit="kg"
            placeholder="70.85"
            value={weightKg}
            onChange={numeric(setWeightKg)}
          />
          <EntryNumberField
            label="Body fat"
            unit="%"
            placeholder="12.6"
            value={bodyFatPct}
            onChange={numeric(setBodyFatPct)}
          />
        </>
      }
      notes={notes}
      onNotesChange={edited(setNotes)}
      notesPlaceholder="Anything worth remembering about this reading."
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
