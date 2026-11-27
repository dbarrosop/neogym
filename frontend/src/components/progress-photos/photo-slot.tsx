import { CheckCircle2, ImagePlus } from "lucide-react";
import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PhotoLabel } from "@/lib/progress-photos/api";
import { cn } from "@/lib/utils";
import { photoLabelName } from "./photo-fields";
import { useObjectURL } from "./photo-image";

/** One label's place in a check-in: empty, a prepared JPEG, or its upload outcome. */
export type SlotState =
  | { status: "preparing" }
  | { status: "invalid"; message: string }
  | { status: "ready"; jpeg: Blob }
  | { status: "uploading"; jpeg: Blob }
  | { status: "done"; jpeg: Blob; id: string }
  | { status: "retry"; jpeg: Blob; message: string }
  | { status: "stopped"; jpeg: Blob; message: string };

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.heic,.heif";

function SlotPreview({ jpeg }: { jpeg: Blob }) {
  const url = useObjectURL(jpeg);
  return url ? (
    <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
  ) : null;
}

function SlotBadge({ state }: { state: SlotState | undefined }) {
  const bar =
    "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-background/90 px-2 py-1.5 text-xs font-medium";
  if (state?.status === "preparing" || state?.status === "uploading") {
    return (
      <span className={bar}>{state.status === "preparing" ? "Preparing…" : "Uploading…"}</span>
    );
  }
  if (state?.status === "done") {
    return (
      <span className={cn(bar, "text-positive")}>
        <CheckCircle2 aria-hidden="true" className="size-4" />
        Uploaded
      </span>
    );
  }
  return null;
}

function slotDescription(state: SlotState | undefined) {
  switch (state?.status) {
    case "preparing":
      return "Preparing";
    case "uploading":
      return "Uploading";
    case "done":
      return "Uploaded";
    case "ready":
    case "retry":
    case "stopped":
      return "Photo chosen";
    default:
      return "No photo chosen";
  }
}

/**
 * A drop zone and file chooser for one label. The tile is the native input's label, so
 * click, keyboard and drag-and-drop all choose a file; a chosen photo can be replaced or
 * removed until its upload starts.
 */
export function PhotoSlot({
  label,
  state,
  locked,
  highlighted,
  onFile,
  onRemove,
}: {
  label: PhotoLabel;
  state: SlotState | undefined;
  /** An upload exists for this slot: its photo can no longer change. */
  locked: boolean;
  /** Requested from the gallery's "Add" slot: focused and outlined on arrival. */
  highlighted: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const name = photoLabelName(label);
  const preview = state && "jpeg" in state ? state.jpeg : undefined;
  const message = state && "message" in state ? state.message : undefined;
  const busy = state?.status === "preparing" || state?.status === "uploading";
  const disabled = locked || busy;

  // biome-ignore lint/correctness/useExhaustiveDependencies: only the arrival focus matters.
  useEffect(() => {
    if (highlighted) {
      input.current?.focus();
    }
  }, []);

  const drop = {
    onDragOver: (event: DragEvent) => {
      if (!disabled) {
        event.preventDefault();
        setDragging(true);
      }
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files.item(0);
      if (file && !disabled) {
        onFile(file);
      }
    },
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={inputId}
        {...drop}
        className={cn(
          "relative grid aspect-[4/5] place-items-center overflow-hidden rounded-xl border-[1.5px] text-sm text-muted-foreground transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          preview ? "border-border bg-surface-inset" : "border-border-strong border-dashed",
          disabled ? "cursor-default" : "cursor-pointer hover:border-primary hover:text-foreground",
          (dragging || (highlighted && !preview)) && "border-primary text-foreground",
        )}
      >
        {preview ? (
          <SlotPreview jpeg={preview} />
        ) : (
          <span aria-hidden="true" className="flex flex-col items-center gap-1.5 px-2 text-center">
            <ImagePlus className="size-6" />
            {state?.status === "preparing" ? null : "Add photo"}
          </span>
        )}
        <SlotBadge state={state} />
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={PHOTO_ACCEPT}
          className="sr-only"
          disabled={disabled}
          aria-label={`${name} photo`}
          aria-description={slotDescription(state)}
          onChange={(event) => {
            const file = event.currentTarget.files?.item(0);
            // Clear the native value so choosing the same file again still fires.
            event.currentTarget.value = "";
            if (file) {
              onFile(file);
            }
          }}
        />
      </label>
      <div className="flex min-h-9 items-center justify-between gap-2">
        <span className="text-sm font-medium wrap-anywhere">{name}</span>
        {preview && !disabled ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove<span className="sr-only"> {name} photo</span>
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
