import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { FormActions } from "@/components/patterns/form-actions";
import { FormPage } from "@/components/patterns/form-page";
import {
  catalogLabelValue,
  PhotoDateInput,
  PhotoLabelsState,
  usePhotoLabels,
} from "@/components/progress-photos/photo-fields";
import { invalidatePhotoRows, usePhotoOwner } from "@/components/progress-photos/photo-session";
import { PhotoSlot, type SlotState } from "@/components/progress-photos/photo-slot";
import type { ProgressPhotoLabel_Enum } from "@/gql/graphql";
import { useFormPageFormId } from "@/lib/form-page-context";
import type { PhotoLabel } from "@/lib/progress-photos/api";
import { newPhotoAttempt, type PhotoUploadAttempt } from "@/lib/progress-photos/attempt";
import { validPhotoDate } from "@/lib/progress-photos/date";
import { preparePhoto } from "@/lib/progress-photos/prepare";
import { useLocalToday } from "@/lib/use-local-today";

// The gallery's dashed "Add" slots open this form on their date with their label outlined.
const searchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  label: z.string().max(64).optional(),
});

export const Route = createFileRoute("/_authed/progress/body/photos/new")({
  validateSearch: searchSchema,
  component: NewPhotosPage,
});

function NewPhotosPage() {
  return (
    <FormPage title="Add progress photos" width="form">
      <CheckInForm />
    </FormPage>
  );
}

/**
 * The form's lifetime as an abort signal: leaving the page (or an account switch, which
 * remounts it) stops preparing and uploading. Drafts only ever live in this component.
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

type Slots = Record<string, SlotState>;

/** Labels whose photo is ready to upload, or whose upload can be retried, in catalog order. */
function queuedLabels(catalog: PhotoLabel[], slots: Slots) {
  return catalog.flatMap((row) => {
    const slot = slots[row.value];
    const value = catalogLabelValue(row.value, catalog);
    return value && (slot?.status === "ready" || slot?.status === "retry")
      ? [{ value, jpeg: slot.jpeg }]
      : [];
  });
}

function submitLabel(slots: Slots, queued: number) {
  if (Object.values(slots).some((slot) => slot.status === "retry")) {
    return "Try again";
  }
  return queued === 1 ? "Upload photo" : `Upload ${queued > 1 ? `${queued} ` : ""}photos`;
}

function CheckInForm() {
  const owner = usePhotoOwner();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const labels = usePhotoLabels();
  const formId = useFormPageFormId();
  const helpId = useId();
  const today = useLocalToday();
  const formSignal = useFormSignal();
  const [date, setDate] = useState(() =>
    search.date && validPhotoDate(search.date, today) ? search.date : today,
  );
  const [slots, setSlots] = useState<Slots>({});
  const [uploading, setUploading] = useState(false);
  // One immutable attempt per label once its upload starts: retries reuse its reservation.
  const attempts = useRef(new Map<string, PhotoUploadAttempt>());
  const generations = useRef(new Map<string, number>());
  const busy = useRef(false);

  const setSlot = (value: string, next: SlotState | undefined) =>
    setSlots((current) => {
      const copy = { ...current };
      if (next) {
        copy[value] = next;
      } else {
        delete copy[value];
      }
      return copy;
    });

  async function choose(value: string, file: File) {
    if (attempts.current.has(value)) {
      return;
    }
    // A newer choice (or Remove) for the same slot wins over a slower preparation.
    const generation = (generations.current.get(value) ?? 0) + 1;
    generations.current.set(value, generation);
    const signal = formSignal();
    setSlot(value, { status: "preparing" });
    try {
      const jpeg = await preparePhoto(file, signal);
      if (generations.current.get(value) === generation) {
        setSlot(value, { status: "ready", jpeg });
      }
    } catch (error) {
      if (!signal.aborted && generations.current.get(value) === generation) {
        const message =
          error instanceof Error
            ? error.message
            : "Couldn't open this photo. Choose a JPEG or PNG.";
        setSlot(value, { status: "invalid", message });
      }
    }
  }

  function remove(value: string) {
    if (!attempts.current.has(value)) {
      generations.current.set(value, (generations.current.get(value) ?? 0) + 1);
      setSlot(value, undefined);
    }
  }

  async function uploadOne(
    label: ProgressPhotoLabel_Enum,
    jpeg: Blob,
    signal: AbortSignal,
  ): Promise<SlotState> {
    let attempt = attempts.current.get(label);
    if (!attempt) {
      attempt = newPhotoAttempt({ label, date }, jpeg, signal);
      attempts.current.set(label, attempt);
    }
    setSlot(label, { status: "uploading", jpeg });
    try {
      const result = await attempt.run();
      return result.status === "ready"
        ? { status: "done", jpeg, id: result.id }
        : { ...result, jpeg };
    } catch {
      signal.throwIfAborted();
      return {
        status: "retry",
        jpeg,
        message: "Couldn't confirm the upload. Check your connection and try again.",
      };
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const queue = labels.data ? queuedLabels(labels.data, slots) : [];
    if (busy.current || queue.length === 0 || !validPhotoDate(date, today)) {
      return;
    }
    const signal = formSignal();
    busy.current = true;
    setUploading(true);
    const finished: Slots = { ...slots };
    try {
      // One at a time: each photo has its own reservation and retry state.
      for (const { value, jpeg } of queue) {
        // biome-ignore lint/performance/noAwaitInLoops: uploads run one after another.
        finished[value] = await uploadOne(value, jpeg, signal);
        setSlot(value, finished[value]);
      }
    } catch {
      // Only an abort reaches here: the form has gone, and so has its draft.
      return;
    } finally {
      busy.current = false;
      setUploading(false);
    }
    const outcomes = Object.values(finished).filter((slot) => slot.status !== "invalid");
    if (outcomes.some((slot) => slot.status === "done")) {
      void invalidatePhotoRows(queryClient, owner);
    }
    if (outcomes.every((slot) => slot.status === "done")) {
      await navigate({ to: "/progress/body/photos", replace: true });
    }
  }

  const queued = labels.data ? queuedLabels(labels.data, slots).length : 0;
  const states = Object.values(slots);
  const uploaded = states.filter((slot) => slot.status === "done").length;
  const started = attempts.current.size > 0;
  return (
    <form id={formId} autoComplete="off" className="flex flex-col gap-6" onSubmit={submit}>
      <div className="max-w-xs">
        <PhotoDateInput
          value={date}
          today={today}
          onChange={setDate}
          disabled={started || uploading}
        />
      </div>
      <PhotoLabelsState labels={labels}>
        {(catalog) => (
          <fieldset className="flex min-w-0 flex-col gap-3" aria-describedby={helpId}>
            <legend className="mb-1 text-sm font-medium">Photos</legend>
            <p id={helpId} className="text-sm text-muted-foreground">
              Add a photo for any of these labels: JPEG, PNG or HEIC, up to 25 MB each. NeoGym
              removes location and camera details before uploading, and only you can see your
              progress photos.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
              {catalog.map((label) => (
                <PhotoSlot
                  key={label.value}
                  label={label}
                  state={slots[label.value]}
                  locked={uploading || attempts.current.has(label.value)}
                  highlighted={label.value === search.label}
                  onFile={(file) => void choose(label.value, file)}
                  onRemove={() => remove(label.value)}
                />
              ))}
            </div>
          </fieldset>
        )}
      </PhotoLabelsState>
      <p role="status" className="sr-only">
        {uploading ? "Uploading photos…" : ""}
        {!uploading && uploaded > 0 ? `${uploaded} uploaded.` : ""}
      </p>
      <FormActions
        submitLabel={submitLabel(slots, queued)}
        submitDisabled={
          queued === 0 ||
          states.some((slot) => slot.status === "preparing") ||
          !validPhotoDate(date, today)
        }
        isSubmitting={uploading}
        submittingLabel="Uploading…"
        cancelLabel={uploaded > 0 ? "Done" : "Cancel"}
        onCancel={() => void navigate({ to: "/progress/body/photos", replace: true })}
      />
    </form>
  );
}
