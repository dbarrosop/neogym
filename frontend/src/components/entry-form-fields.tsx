import { type ChangeEvent, type ReactNode, type SubmitEvent, useId } from "react";
import { FormSection } from "@/components/patterns/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * `page`: the Edit measurement board (full-page create/edit, also used for
 * energy): one section card, Date at most 240 px wide, value fields that wrap
 * from 200 px, and a caption. `quick`: the inline "Log …" card on Progress ›
 * Body and Energy: fields in two columns, inline Cancel/Save.
 */
export type EntryFormVariant = "page" | "quick";

export function EntryNumberField({
  label,
  unit,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="gap-1">
        {label}
        <span className="font-medium text-muted-foreground">{unit}</span>
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="tabular-nums"
      />
    </div>
  );
}

interface EntryFormLayoutProps {
  variant: EntryFormVariant;
  formId: string | undefined;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  date: string;
  onDateChange: (value: string) => void;
  /** A save error about the date (it already has an entry), shown under the field. */
  dateError: string | null;
  /** The two value fields (`EntryNumberField`). */
  fields: ReactNode;
  notes: string;
  onNotesChange: (value: string) => void;
  notesPlaceholder: string;
  /** Validation or save error for the whole form. */
  error: string | null;
  /** Page variant: the caption at the end of the card. */
  caption: string;
  /** `FormActions`: inline in the quick card, portalled into the form page bars. */
  actions: ReactNode;
}

/** Date, two values and notes: the shared body of the measurement and energy forms. */
export function EntryFormLayout({
  variant,
  formId,
  onSubmit,
  date,
  onDateChange,
  dateError,
  fields,
  notes,
  onNotesChange,
  notesPlaceholder,
  error,
  caption,
  actions,
}: EntryFormLayoutProps) {
  const dateId = useId();
  const dateErrorId = useId();
  const notesId = useId();
  const page = variant === "page";
  const body = (
    <>
      <div className={cn("flex min-w-0 flex-col gap-1.5", page && "max-w-[240px]")}>
        <Label htmlFor={dateId}>Date</Label>
        <Input
          id={dateId}
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          required
          aria-invalid={dateError ? true : undefined}
          aria-describedby={dateError ? dateErrorId : undefined}
          className="tabular-nums"
        />
        {dateError ? (
          <p id={dateErrorId} role="alert" className="text-[13px] text-destructive">
            {dateError}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "grid",
          page
            ? "grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4"
            : "grid-cols-2 gap-2.5",
        )}
      >
        {fields}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={notesId} className="gap-1.5">
          Notes
          <span className="font-medium text-muted-foreground">Optional</span>
        </Label>
        <Textarea
          id={notesId}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder={notesPlaceholder}
          rows={3}
        />
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className={cn("flex flex-col", page ? "gap-5" : "gap-3.5")}
    >
      {page ? (
        <FormSection card>
          {body}
          <p className="text-[13px] text-muted-foreground">{caption}</p>
        </FormSection>
      ) : (
        body
      )}
      {actions}
    </form>
  );
}
