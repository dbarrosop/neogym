import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useId, useRef, useState } from "react";
import { FormActions } from "@/components/patterns/form-actions";
import { FormPage } from "@/components/patterns/form-page";
import { usePhotoScope } from "@/components/progress-photos/photo-boundary";
import {
  AngleSelect,
  PhotoDateInput,
  PhotoLoadError,
  photoLabel,
  usePhotoAngles,
} from "@/components/progress-photos/photo-fields";
import { PhotoPreview } from "@/components/progress-photos/photo-image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormPageFormId } from "@/lib/form-page-context";
import {
  newPhotoAttempt,
  type PhotoUploadAttempt,
  type UploadResult,
} from "@/lib/progress-photos/attempt";
import { validPhotoDate } from "@/lib/progress-photos/date";
import { preparePhoto } from "@/lib/progress-photos/prepare";
import { useLocalToday } from "@/lib/use-local-today";

export const Route = createFileRoute("/_authed/progress/body/photos/new")({
  component: NewPhotoPage,
});

function NewPhotoPage() {
  return (
    <FormPage title="Add progress photo" width="2xl">
      <NewPhotoForm />
    </FormPage>
  );
}

function NewPhotoForm() {
  const scope = usePhotoScope();
  const navigate = Route.useNavigate();
  const angles = usePhotoAngles();
  const formId = useFormPageFormId();
  const fileId = useId();
  const today = useLocalToday();
  const [date, setDate] = useState(today);
  const [angle, setAngle] = useState("");
  const label = photoLabel(angle, angles.data);
  const [jpeg, setJPEG] = useState<Blob>();
  const [stage, setStage] = useState<"Preparing…" | "Uploading…" | "Checking upload…">();
  const [fileError, setFileError] = useState<string>();
  const [outcome, setOutcome] = useState<Exclude<UploadResult, { status: "ready" }>>();
  const busy = useRef(false);
  const attempt = useRef<PhotoUploadAttempt>(null);

  async function chooseFile(source: File) {
    if (busy.current || attempt.current || !scope.active) {
      return;
    }
    busy.current = true;
    setJPEG(undefined);
    setFileError(undefined);
    setStage("Preparing…");
    try {
      const prepared = await preparePhoto(scope, source, scope.signal);
      scope.assertActive();
      setJPEG(prepared);
    } catch (error) {
      if (scope.active) {
        setFileError(error instanceof Error ? error.message : "Couldn't prepare the photo.");
      }
    } finally {
      busy.current = false;
      if (scope.active) {
        setStage(undefined);
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !scope.active || outcome?.status === "stopped") {
      return;
    }
    if (!attempt.current && jpeg && label && validPhotoDate(date, today)) {
      attempt.current = newPhotoAttempt(scope, { label, date }, jpeg);
    }
    if (!attempt.current) {
      return;
    }
    busy.current = true;
    setStage(outcome ? "Checking upload…" : "Uploading…");
    setOutcome(undefined);
    try {
      const result = await attempt.current.run();
      scope.assertActive();
      if (result.status === "ready") {
        await navigate({
          to: "/progress/body/photos/$photoId",
          params: { photoId: result.id },
          replace: true,
        });
      } else {
        setOutcome(result);
      }
    } finally {
      busy.current = false;
      if (scope.active) {
        setStage(undefined);
      }
    }
  }

  // Read-only once a submission exists: its ID, bytes, date and angle are one immutable attempt.
  const submitted = Boolean(attempt.current);
  const isUploading = stage !== undefined && stage !== "Preparing…";
  return (
    <form
      id={formId}
      autoComplete="off"
      className="space-y-5"
      onSubmit={(event) =>
        void submit(event).catch(() => {
          if (scope.active) {
            setOutcome({
              status: "retry",
              message:
                "Couldn't confirm the upload. Check it again before starting a new submission.",
            });
          }
        })
      }
    >
      <fieldset disabled={submitted || Boolean(stage)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={fileId}>Photo file</Label>
          <Input
            id={fileId}
            type="file"
            className="min-h-11"
            accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={(event) => {
              const source = event.currentTarget.files?.item(0);
              event.currentTarget.value = "";
              if (source) {
                void chooseFile(source);
              }
            }}
            aria-describedby={`${fileId}-help`}
          />
          <p id={`${fileId}-help`} className="text-sm text-muted-foreground">
            Choose one JPEG, PNG or browser-supported HEIC. NeoGym prepares a JPEG without source
            metadata. Only your signed-in account can access it.
          </p>
        </div>
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
      {jpeg ? <PhotoPreview jpeg={jpeg} /> : null}
      {stage ? (
        <p role="status" className="text-sm text-muted-foreground">
          {stage}
        </p>
      ) : null}
      {fileError || outcome ? (
        <p role="alert" className="text-sm text-destructive">
          {fileError ?? outcome?.message}
        </p>
      ) : null}
      <FormActions
        submitLabel={outcome?.status === "retry" ? "Check upload" : "Upload photo"}
        submitDisabled={
          stage === "Preparing…" ||
          outcome?.status === "stopped" ||
          (!submitted && (!jpeg || !label || !validPhotoDate(date, today)))
        }
        isSubmitting={isUploading}
        submittingLabel={stage}
        onCancel={() => void navigate({ to: "/progress/body/photos", replace: true })}
      />
    </form>
  );
}
