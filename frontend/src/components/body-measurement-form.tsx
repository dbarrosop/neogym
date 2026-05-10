import { type SubmitEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface BodyMeasurementFormValues {
  measuredOn: string;
  weightKg: string;
  bodyFatPct: string;
  notes: string;
}

interface BodyMeasurementFormProps {
  initialValues: BodyMeasurementFormValues;
  submitLabel: string;
  onSubmit: (values: BodyMeasurementFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  extraActions?: React.ReactNode;
}

const NUMERIC = /^\d{0,3}(\.\d{0,2})?$/;

export function todayLocalISO(): string {
  // en-CA locale yields YYYY-MM-DD using the user's local timezone, which is
  // what <input type="date"> expects. Avoids the UTC drift that
  // toISOString().slice(0,10) introduces near midnight.
  return new Date().toLocaleDateString("en-CA");
}

export function BodyMeasurementForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting,
  extraActions,
}: BodyMeasurementFormProps) {
  const [measuredOn, setMeasuredOn] = useState(initialValues.measuredOn);
  const [weightKg, setWeightKg] = useState(initialValues.weightKg);
  const [bodyFatPct, setBodyFatPct] = useState(initialValues.bodyFatPct);
  const [notes, setNotes] = useState(initialValues.notes);
  const [error, setError] = useState<string | null>(null);
  const dateId = useId();
  const weightId = useId();
  const fatId = useId();
  const notesId = useId();

  const trimmedWeight = weightKg.trim();
  const trimmedFat = bodyFatPct.trim();
  const hasValue = trimmedWeight !== "" || trimmedFat !== "";

  function handleNumeric(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === "" || NUMERIC.test(v)) {
        setter(v);
      }
    };
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasValue) {
      setError("Enter a weight, a body-fat %, or both.");
      return;
    }
    setError(null);
    onSubmit({
      measuredOn,
      weightKg: trimmedWeight,
      bodyFatPct: trimmedFat,
      notes: notes.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={dateId} className="text-sm font-medium">
            Date
          </label>
          <Input
            id={dateId}
            type="date"
            value={measuredOn}
            onChange={(e) => setMeasuredOn(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={weightId} className="text-sm font-medium">
              Weight
              <span className="ml-1 text-xs font-normal text-muted-foreground">kg</span>
            </label>
            <Input
              id={weightId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="78.4"
              value={weightKg}
              onChange={handleNumeric(setWeightKg)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={fatId} className="text-sm font-medium">
              Body fat
              <span className="ml-1 text-xs font-normal text-muted-foreground">%</span>
            </label>
            <Input
              id={fatId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="18.5"
              value={bodyFatPct}
              onChange={handleNumeric(setBodyFatPct)}
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
            placeholder="Anything worth remembering about this reading."
            rows={3}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !hasValue}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
        {extraActions ? <div className="border-t border-border/40 pt-3">{extraActions}</div> : null}
      </div>
    </form>
  );
}
