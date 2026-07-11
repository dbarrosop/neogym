import { type ChangeEvent, type ReactNode, type SubmitEvent, useId, useState } from "react";
import { FormActions, FormSection } from "@/components/patterns/form-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptsDailyEnergyNumericInput,
  type DailyEnergyFormValues,
  validateDailyEnergyFormValues,
} from "@/lib/daily-energy";

export type { DailyEnergyFormValues } from "@/lib/daily-energy";

interface DailyEnergyFormProps {
  initialValues: DailyEnergyFormValues;
  submitLabel: string;
  onSubmit: (values: DailyEnergyFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  extraActions?: ReactNode;
}

export function DailyEnergyForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting,
  extraActions,
}: DailyEnergyFormProps) {
  const [energyOn, setEnergyOn] = useState(initialValues.energyOn);
  const [activeKcal, setActiveKcal] = useState(initialValues.activeKcal);
  const [restingKcal, setRestingKcal] = useState(initialValues.restingKcal);
  const [notes, setNotes] = useState(initialValues.notes);
  const [error, setError] = useState<string | null>(null);
  const dateId = useId();
  const activeId = useId();
  const restingId = useId();
  const notesId = useId();

  const hasValue = activeKcal.trim() !== "" || restingKcal.trim() !== "";

  function handleNumeric(setter: (v: string) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (acceptsDailyEnergyNumericInput(v)) {
        setter(v);
      }
    };
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = validateDailyEnergyFormValues({ energyOn, activeKcal, restingKcal, notes });
    if (!result.success) {
      setError(result.message);
      return;
    }
    setError(null);
    onSubmit(result.values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection>
        <div className="space-y-1.5">
          <label htmlFor={dateId} className="text-sm font-medium">
            Date
          </label>
          <Input
            id={dateId}
            type="date"
            value={energyOn}
            onChange={(e) => setEnergyOn(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={activeId} className="text-sm font-medium">
              Active energy
              <span className="ml-1 text-xs font-normal text-muted-foreground">kcal</span>
            </label>
            <Input
              id={activeId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="650"
              value={activeKcal}
              onChange={handleNumeric(setActiveKcal)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={restingId} className="text-sm font-medium">
              Resting energy
              <span className="ml-1 text-xs font-normal text-muted-foreground">kcal</span>
            </label>
            <Input
              id={restingId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="1800"
              value={restingKcal}
              onChange={handleNumeric(setRestingKcal)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={notesId} className="text-sm font-medium">
            Notes
            <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
          </label>
          <Textarea
            id={notesId}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering about this energy day."
            rows={3}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </FormSection>

      <FormActions
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        submitDisabled={!hasValue}
        onCancel={onCancel}
        extraActions={extraActions}
      />
    </form>
  );
}
