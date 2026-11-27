import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { FormActions } from "@/components/patterns/form-actions";
import { FormPage } from "@/components/patterns/form-page";
import {
  catalogLabelValue,
  PhotoDateInput,
  PhotoLabelSelect,
  PhotoLabelsState,
  usePhotoLabels,
} from "@/components/progress-photos/photo-fields";
import { PhotoPreview } from "@/components/progress-photos/photo-image";
import { invalidatePhotoRows, usePhotoOwner } from "@/components/progress-photos/photo-session";
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

/**
 * The form's lifetime as an abort signal: leaving the page (or an account switch, which
 * remounts it) stops preparing and uploading. The draft only ever lives in this component.
 */
function useFormSignal() {
  const controller = useRef<AbortController>(null);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => current.abort();
  }, []);
  return () => controller.current?.signal ?? AbortSignal.abort();
}

type Stage = "Preparing photo…" | "Uploading…" | "Checking upload…";

function NewPhotoForm() {
  const owner = usePhotoOwner();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const labels = usePhotoLabels();
  const formId = useFormPageFormId();
  const fileId = useId();
  const today = useLocalToday();
  const formSignal = useFormSignal();
  const [date, setDate] = useState(today);
  const [selectedLabel, setSelectedLabel] = useState("");
  const label = catalogLabelValue(selectedLabel, labels.data);
  const [jpeg, setJPEG] = useState<Blob>();
  const [stage, setStage] = useState<Stage>();
  const [fileError, setFileError] = useState<string>();
  const [outcome, setOutcome] = useState<Exclude<UploadResult, { status: "ready" }>>();
  const busy = useRef(false);
  const attempt = useRef<PhotoUploadAttempt>(null);

  async function chooseFile(source: File) {
    if (busy.current || attempt.current) {
      return;
    }
    const signal = formSignal();
    busy.current = true;
    setJPEG(undefined);
    setFileError(undefined);
    setStage("Preparing photo…");
    try {
      setJPEG(await preparePhoto(source, signal));
    } catch (error) {
      if (!signal.aborted) {
        setFileError(
          error instanceof Error
            ? error.message
            : "Couldn't open this photo. Choose a JPEG or PNG.",
        );
      }
    } finally {
      busy.current = false;
      setStage(undefined);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || outcome?.status === "stopped") {
      return;
    }
    const signal = formSignal();
    // One submission is one immutable attempt: retries reuse its reservation, never a new one.
    if (!attempt.current && jpeg && label && validPhotoDate(date, today)) {
      attempt.current = newPhotoAttempt({ label, date }, jpeg, signal);
    }
    if (!attempt.current) {
      return;
    }
    busy.current = true;
    setStage(outcome ? "Checking upload…" : "Uploading…");
    setOutcome(undefined);
    try {
      const result = await attempt.current.run();
      if (result.status === "ready") {
        void invalidatePhotoRows(queryClient, owner);
        await navigate({
          to: "/progress/body/photos/$photoId",
          params: { photoId: result.id },
          replace: true,
        });
      } else {
        setOutcome(result);
      }
    } catch {
      if (!signal.aborted) {
        setOutcome({
          status: "retry",
          message: "Couldn't confirm the upload. Check your connection and try again.",
        });
      }
    } finally {
      busy.current = false;
      setStage(undefined);
    }
  }

  // Read-only once a submission exists: its ID, bytes, date and label are one immutable attempt.
  const submitted = Boolean(attempt.current);
  const isUploading = stage !== undefined && stage !== "Preparing photo…";
  return (
    <form id={formId} autoComplete="off" className="space-y-5" onSubmit={submit}>
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
            JPEG, PNG or HEIC, up to 25 MB. NeoGym removes location and camera details before
            uploading, and only you can see your progress photos.
          </p>
        </div>
        <PhotoLabelsState labels={labels}>
          {(catalog) => (
            <PhotoLabelSelect labels={catalog} value={selectedLabel} onChange={setSelectedLabel} />
          )}
        </PhotoLabelsState>
        <PhotoDateInput value={date} today={today} onChange={setDate} />
      </fieldset>
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
        submitLabel={outcome?.status === "retry" ? "Try again" : "Upload photo"}
        submitDisabled={
          stage === "Preparing photo…" ||
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
