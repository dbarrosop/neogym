import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { FormActions } from "@/components/patterns/form-actions";
import { DangerZone, FormPage } from "@/components/patterns/form-page";
import { usePhotoScope } from "@/components/progress-photos/photo-boundary";
import { PhotoDetailState } from "@/components/progress-photos/photo-detail-state";
import {
  AngleSelect,
  PhotoDateInput,
  PhotoLoadError,
  photoLabel,
  usePhotoAngles,
} from "@/components/progress-photos/photo-fields";
import { useFormPageFormId } from "@/lib/form-page-context";
import { type Photo, type PhotoFields, updatePhoto } from "@/lib/progress-photos/api";
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
  const scope = usePhotoScope();
  const openViewer = () =>
    navigate({
      to: "/progress/body/photos/$photoId",
      params: { photoId: photo.id },
      replace: true,
    });

  async function apply(action: "saving" | "deleting", operation: () => Promise<boolean>) {
    if (busy.current || !scope.active) {
      return;
    }
    busy.current = true;
    setError(undefined);
    setStage(action);
    try {
      const complete = await operation();
      scope.assertActive();
      if (!complete) {
        throw new Error("Photo operation was not confirmed.");
      }
      if (action === "deleting") {
        await navigate({ to: "/progress/body/photos", replace: true });
      } else {
        await openViewer();
      }
    } catch {
      if (scope.active) {
        setError(
          action === "deleting"
            ? "Couldn't confirm deletion. Check the connection and retry Delete."
            : "Couldn't save changes. Check the connection and retry Save.",
        );
        setConfirm(false);
      }
    } finally {
      busy.current = false;
      if (scope.active) {
        setStage(undefined);
      }
    }
  }

  return (
    <FormPage
      title="Edit progress photo"
      width="2xl"
      danger={
        <DangerZone
          title="Delete this photo"
          description="Removes the photo from your private history."
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
        save={(label, date) =>
          void apply("saving", () => updatePhoto(scope, photo.id, { label, date }))
        }
      />
      <ConfirmActionDialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy.current) {
            setConfirm(open);
          }
        }}
        title="Delete this progress photo?"
        description="The photo will no longer be available in your history. Storage cleanup may continue after it disappears."
        destructive
        confirmLabel="Delete photo"
        pendingLabel="Deleting…"
        isPending={stage === "deleting"}
        onConfirm={() => void apply("deleting", () => deletePhoto(scope, photo.id))}
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
  const angles = usePhotoAngles();
  const formId = useFormPageFormId();
  const today = useLocalToday();
  const [date, setDate] = useState<string>(photo.takenOn);
  const [angle, setAngle] = useState(photo.label.value);
  const label = photoLabel(angle, angles.data);
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
        {angles.data ? (
          <AngleSelect angles={angles.data} value={angle} onChange={setAngle} />
        ) : null}
        <PhotoDateInput value={date} today={today} onChange={setDate} />
      </fieldset>
      {angles.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading angles…
        </p>
      ) : null}
      {angles.isError ? (
        <PhotoLoadError title="Couldn't load photo angles" retry={() => void angles.refetch()} />
      ) : null}
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
