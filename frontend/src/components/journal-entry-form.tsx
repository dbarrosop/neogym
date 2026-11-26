import { type ReactNode, type SubmitEvent, useId, useState } from "react";
import { LabelInput, type LabelSelection, type LabelSuggestion } from "@/components/label-input";
import { FormActions } from "@/components/patterns/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormPageFormId } from "@/lib/form-page-context";

export interface JournalEntryFormValues {
  entryDate: string;
  title: string;
  body: string;
  labels: LabelSelection[];
}

interface JournalEntryFormProps {
  initialValues: JournalEntryFormValues;
  submitLabel: string;
  onSubmit: (values: JournalEntryFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  labelSuggestions: LabelSuggestion[];
  extraActions?: ReactNode;
}

/**
 * Journal editor (Web-JournalEditor): Date and an optional Title on one row,
 * the Markdown entry in a monospace field, then labels. Render it inside a
 * `FormPage`, whose card and sticky bars hold the fields and Cancel/Save.
 */
export function JournalEntryForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting,
  labelSuggestions,
  extraActions,
}: JournalEntryFormProps) {
  const formId = useFormPageFormId();
  const [entryDate, setEntryDate] = useState(initialValues.entryDate);
  const [title, setTitle] = useState(initialValues.title);
  const [body, setBody] = useState(initialValues.body);
  const [labels, setLabels] = useState<LabelSelection[]>(initialValues.labels);
  const dateId = useId();
  const titleId = useId();
  const bodyId = useId();

  const trimmedBody = body.trim();

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (trimmedBody.length === 0 || isSubmitting) {
      return;
    }
    onSubmit({
      entryDate,
      title: title.trim(),
      body: trimmedBody,
      labels,
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={dateId}>Date</Label>
          <Input
            id={dateId}
            type="date"
            className="tabular-nums"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={titleId} className="gap-1.5">
            Title
            <span className="font-medium text-muted-foreground">Optional</span>
          </Label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A short headline for this entry"
            maxLength={200}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={bodyId}>Entry · Markdown</Label>
        <Textarea
          id={bodyId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write what's on your mind…"
          rows={14}
          // 16 px below 768 px keeps iOS Safari from zooming the focused field.
          className="resize-y font-mono leading-[1.6] md:text-sm"
          required
        />
      </div>

      <LabelInput
        value={labels}
        onChange={setLabels}
        suggestions={labelSuggestions}
        optional={false}
        disabled={isSubmitting}
      />

      <FormActions
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        submitDisabled={trimmedBody.length === 0}
        onCancel={onCancel}
        extraActions={extraActions}
      />
    </form>
  );
}
