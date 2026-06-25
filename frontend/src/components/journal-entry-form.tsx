import { type ReactNode, type SubmitEvent, useId, useState } from "react";
import { LabelInput, type LabelSelection, type LabelSuggestion } from "@/components/label-input";
import { FormActions, FormSection } from "@/components/patterns/form-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

export function JournalEntryForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting,
  labelSuggestions,
  extraActions,
}: JournalEntryFormProps) {
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection>
        <div className="space-y-1.5">
          <label htmlFor={dateId} className="text-sm font-medium">
            Date
          </label>
          <Input
            id={dateId}
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={titleId} className="text-sm font-medium">
            Title
            <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
          </label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A short headline for this entry"
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={bodyId} className="text-sm font-medium">
            Entry
          </label>
          <Textarea
            id={bodyId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write what's on your mind…"
            rows={14}
            required
          />
          <p className="text-xs text-muted-foreground">
            Markdown supported — use <code className="font-mono">**bold**</code>,{" "}
            <code className="font-mono">- lists</code>, headings, and more.
          </p>
        </div>

        <LabelInput
          value={labels}
          onChange={setLabels}
          suggestions={labelSuggestions}
          disabled={isSubmitting}
        />
      </FormSection>

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
