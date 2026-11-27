import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { FormActions } from "@/components/patterns/form-actions";
import { DangerZone, FormPage } from "@/components/patterns/form-page";
import { PhotoDetailState } from "@/components/progress-photos/photo-detail-state";
import {
  catalogLabelValue,
  PhotoDateInput,
  PhotoLabelSelect,
  PhotoLabelsState,
  usePhotoLabels,
} from "@/components/progress-photos/photo-fields";
import { invalidatePhotoRows, usePhotoOwner } from "@/components/progress-photos/photo-session";
import { useFormPageFormId } from "@/lib/form-page-context";
import { type Photo, type PhotoFields, photoKeys, updatePhoto } from "@/lib/progress-photos/api";
import { validPhotoDate } from "@/lib/progress-photos/date";
import { deletePhoto } from "@/lib/progress-photos/storage";
import { useLocalToday } from "@/lib/use-local-today";

export const Route = createFileRoute("/_authed/progress/body/photos/$photoId_/edit")({
  component: EditPhotoPage,
});

function EditPhotoPage() {
  const { photoId } = Route.useParams();
  return (
    <PhotoDetailState id={photoId} loadingPage>
      {(photo) => <EditPhoto photo={photo} />}
    </PhotoDetailState>
  );
}

function EditPhoto({ photo }: { photo: Photo }) {
  const [confirm, setConfirm] = useState(false);
  const [stage, setStage] = useState<"saving" | "deleting">();
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const navigate = Route.useNavigate();
  const owner = usePhotoOwner();
  const queryClient = useQueryClient();
  const openViewer = () =>
    navigate({
      to: "/progress/body/photos/$photoId",
      params: { photoId: photo.id },
      replace: true,
    });

  async function apply(action: "saving" | "deleting", operation: () => Promise<boolean>) {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setError(undefined);
    setStage(action);
    try {
      if (!(await operation())) {
        throw new Error("Photo operation was not confirmed.");
      }
      if (action === "deleting") {
        // Cached lists would flash the deleted photo; the gallery reloads them instead.
        queryClient.removeQueries({ queryKey: photoKeys.lists(owner) });
        void queryClient.invalidateQueries({ queryKey: photoKeys.summary(owner) });
        await navigate({ to: "/progress/body/photos", replace: true });
        queryClient.removeQueries({ queryKey: photoKeys.photo(owner, photo.id) });
      } else {
        await invalidatePhotoRows(queryClient, owner);
        await openViewer();
      }
    } catch {
      setError(
        action === "deleting"
          ? "Couldn't delete the photo. Check your connection and try again."
          : "Couldn't save your changes. Check your connection and try again.",
      );
      setConfirm(false);
    } finally {
      busy.current = false;
      setStage(undefined);
    }
  }

  return (
    <FormPage
      title="Edit progress photo"
      width="2xl"
      danger={
        <DangerZone
          title="Delete this photo"
          description="Permanently removes this photo from your history."
          actionLabel="Delete photo"
          onAction={() => setConfirm(true)}
          disabled={Boolean(stage)}
        />
      }
    >
      <EditPhotoForm
        photo={photo}
        stage={stage}
        error={error}
        cancel={() => void openViewer()}
        save={(label, date) => void apply("saving", () => updatePhoto(photo.id, { label, date }))}
      />
      <ConfirmActionDialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy.current) {
            setConfirm(open);
          }
        }}
        title="Delete this progress photo?"
        description="The photo is removed from your history for good. This can't be undone."
        destructive
        confirmLabel="Delete photo"
        pendingLabel="Deleting…"
        isPending={stage === "deleting"}
        onConfirm={() => void apply("deleting", () => deletePhoto(photo.id))}
      />
    </FormPage>
  );
}

function EditPhotoForm({
  photo,
  stage,
  error,
  cancel,
  save,
}: {
  photo: Photo;
  stage: "saving" | "deleting" | undefined;
  error: string | undefined;
  cancel: () => void;
  save: (label: PhotoFields["label"], date: string) => void;
}) {
  const labels = usePhotoLabels();
  const formId = useFormPageFormId();
  const today = useLocalToday();
  const [date, setDate] = useState<string>(photo.takenOn);
  const [selectedLabel, setSelectedLabel] = useState<string>(photo.label.value);
  const label = catalogLabelValue(selectedLabel, labels.data);
  const validDate = validPhotoDate(date, today);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (label && validDate && !stage) {
      save(label, date);
    }
  }
  return (
    <form id={formId} autoComplete="off" className="space-y-5" onSubmit={submit}>
      <fieldset className="space-y-5" disabled={Boolean(stage)}>
        <PhotoLabelsState labels={labels}>
          {(catalog) => (
            <PhotoLabelSelect labels={catalog} value={selectedLabel} onChange={setSelectedLabel} />
          )}
        </PhotoLabelsState>
        <PhotoDateInput value={date} today={today} onChange={setDate} />
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel="Save changes"
        isSubmitting={Boolean(stage)}
        submittingLabel={stage === "deleting" ? "Deleting…" : "Saving…"}
        submitDisabled={!label || !validDate}
        onCancel={cancel}
      />
    </form>
  );
}
