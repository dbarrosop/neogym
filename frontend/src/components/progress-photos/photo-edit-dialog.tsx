import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { FormActions } from "@/components/patterns/form-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ReadyPhoto, updatePhoto } from "@/lib/progress-photos/api";
import { validPhotoDate } from "@/lib/progress-photos/date";
import { useLocalToday } from "@/lib/use-local-today";
import {
  catalogLabelValue,
  PhotoDateInput,
  PhotoLabelSelect,
  PhotoLabelsState,
  usePhotoLabels,
} from "./photo-fields";
import { PhotoImage } from "./photo-image";
import { invalidatePhotoRows, usePhotoOwner } from "./photo-session";

function EditPhotoForm({
  photo,
  saving,
  setSaving,
  done,
}: {
  photo: ReadyPhoto;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  done: () => void;
}) {
  const owner = usePhotoOwner();
  const queryClient = useQueryClient();
  const labels = usePhotoLabels();
  const today = useLocalToday();
  const [date, setDate] = useState<string>(photo.takenOn);
  const [selectedLabel, setSelectedLabel] = useState<string>(photo.label.value);
  const [error, setError] = useState<string>();
  const label = catalogLabelValue(selectedLabel, labels.data);
  const validDate = validPhotoDate(date, today);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !label || !validDate) {
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      if (!(await updatePhoto(photo.id, { label, date }))) {
        throw new Error("Photo update was not confirmed.");
      }
      // Refetch this photo (and its label's history) before closing, so the page
      // behind the dialog shows the new details.
      await invalidatePhotoRows(queryClient, owner);
      done();
    } catch {
      setError("Couldn't save your changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form autoComplete="off" className="flex flex-col gap-5" onSubmit={submit}>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-4">
        <div className="overflow-hidden rounded-lg border">
          <PhotoImage id={photo.file.id} thumbnail alt="" />
        </div>
        <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4">
          <PhotoLabelsState labels={labels}>
            {(catalog) => (
              <PhotoLabelSelect
                labels={catalog}
                value={selectedLabel}
                onChange={setSelectedLabel}
              />
            )}
          </PhotoLabelsState>
          <PhotoDateInput value={date} today={today} onChange={setDate} />
        </fieldset>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel="Save"
        isSubmitting={saving}
        submittingLabel="Saving…"
        submitDisabled={!label || !validDate}
        onCancel={done}
      />
    </form>
  );
}

/** Correct a photo's label or date without replacing the image. */
export function EditPhotoDialog({
  photo,
  open,
  onOpenChange,
}: {
  photo: ReadyPhoto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit photo details</DialogTitle>
          <DialogDescription>Change its label or the date it was taken.</DialogDescription>
        </DialogHeader>
        {open ? (
          <EditPhotoForm
            photo={photo}
            saving={saving}
            setSaving={setSaving}
            done={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
