import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Columns2, Pencil } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { DangerZone } from "@/components/patterns/form-page";
import { ActionLabel, PageHeader, PageShell } from "@/components/patterns/page-shell";
import { PhotoDetailState } from "@/components/progress-photos/photo-detail-state";
import { EditPhotoDialog } from "@/components/progress-photos/photo-edit-dialog";
import { PhotoMeasurementText, photoLabelName } from "@/components/progress-photos/photo-fields";
import { PhotoImage } from "@/components/progress-photos/photo-image";
import {
  dropPhotoCollections,
  forgetPhoto,
  usePhotoMeasurements,
  usePhotoOwner,
  usePosePhotos,
} from "@/components/progress-photos/photo-session";
import { Button } from "@/components/ui/button";
import type { ProgressPhotoLabel_Enum } from "@/gql/graphql";
import type { ReadyPhoto } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";
import { poseNeighbors } from "@/lib/progress-photos/sheet";
import { deletePhoto } from "@/lib/progress-photos/storage";

export const Route = createFileRoute("/_authed/progress/body/photos/$photoId")({
  component: PhotoViewer,
});

function PhotoViewer() {
  const { photoId } = Route.useParams();
  return (
    <PageShell maxWidth="5xl">
      <PhotoDetailState id={photoId}>{(photo) => <PhotoView photo={photo} />}</PhotoDetailState>
    </PageShell>
  );
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, select, textarea"));
}

/** Older/newer within the photo's label: buttons, arrow keys and horizontal swipes. */
function usePoseNavigation(photo: ReadyPhoto, paused: boolean) {
  const navigate = Route.useNavigate();
  const pose = usePosePhotos(photo.label.value as ProgressPhotoLabel_Enum);
  const place = pose.data ? poseNeighbors(pose.data, photo.id) : null;
  const go = (target: ReadyPhoto | null | undefined) => {
    if (target) {
      // Stepping through photos replaces the entry, so Back returns to the gallery.
      void navigate({
        to: "/progress/body/photos/$photoId",
        params: { photoId: target.id },
        replace: true,
      });
    }
  };
  const goRef = useRef({ older: () => go(place?.older), newer: () => go(place?.newer) });
  useEffect(() => {
    goRef.current = { older: () => go(place?.older), newer: () => go(place?.newer) };
  });

  useEffect(() => {
    if (paused) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) {
        return;
      }
      if (event.key === "ArrowLeft") {
        goRef.current.older();
      } else if (event.key === "ArrowRight") {
        goRef.current.newer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipe = {
    onPointerDown: (event: PointerEvent) => {
      touch.current = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
    },
    onPointerUp: (event: PointerEvent) => {
      const start = touch.current;
      touch.current = null;
      const dx = start ? event.clientX - start.x : 0;
      const dy = start ? event.clientY - start.y : 0;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        // Swiping left brings in the next (newer) photo, as in a carousel.
        (dx < 0 ? goRef.current.newer : goRef.current.older)();
      }
    },
    onPointerCancel: () => {
      touch.current = null;
    },
  };
  return { place, swipe };
}

function StepLink({
  photo,
  direction,
}: {
  photo: ReadyPhoto | null;
  direction: "Older" | "Newer";
}) {
  const icon = direction === "Older" ? <ChevronLeft /> : <ChevronRight />;
  if (!photo) {
    return (
      <Button type="button" variant="outline" disabled className="min-h-11">
        {direction === "Older" ? icon : null}
        {direction}
        {direction === "Newer" ? icon : null}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" className="min-h-11">
      <Link
        to="/progress/body/photos/$photoId"
        params={{ photoId: photo.id }}
        preload={false}
        replace
        aria-label={`${direction} photo, ${photoDateLabel(photo.takenOn)}`}
      >
        {direction === "Older" ? icon : null}
        {direction}
        {direction === "Newer" ? icon : null}
      </Link>
    </Button>
  );
}

function PhotoView({ photo }: { photo: ReadyPhoto }) {
  const owner = usePhotoOwner();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The view stays mounted while stepping between photos, so an error belongs to one photo.
  const [error, setError] = useState<{ id: string; message: string }>();
  const { place, swipe } = usePoseNavigation(photo, editing || confirming);
  const measurement = usePhotoMeasurements(0)(photo.takenOn);
  const name = photoLabelName(photo.label);
  const date = photoDateLabel(photo.takenOn);

  // Forget a deleted photo's row and bytes once this view has gone; doing it while it
  // is still mounted would refetch them ("not found", and a request for a deleted file).
  const deleted = useRef(false);
  useEffect(
    () => () => {
      if (deleted.current) {
        forgetPhoto(queryClient, owner, photo.id);
      }
    },
    [queryClient, owner, photo.id],
  );

  async function remove() {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setError(undefined);
    try {
      if (!(await deletePhoto(photo.id))) {
        throw new Error("Photo deletion was not confirmed.");
      }
      deleted.current = true;
      void dropPhotoCollections(queryClient, owner);
      // No state changes after this: the view is leaving.
      await navigate({ to: "/progress/body/photos", replace: true });
    } catch {
      setError({
        id: photo.id,
        message: "Couldn't delete the photo. Check your connection and try again.",
      });
      setConfirming(false);
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap gap-x-2">
            <time dateTime={photo.takenOn}>{date}</time>
            {measurement ? (
              <>
                <span aria-hidden="true">·</span>
                <PhotoMeasurementText measurement={measurement} date={photo.takenOn} />
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              <ActionLabel>Edit</ActionLabel>
            </Button>
            {place && place.total > 1 ? (
              <Button asChild variant="outline">
                <Link
                  to="/progress/body/photos/compare"
                  // Opened from a photo: that photo against the newest (from the newest,
                  // compareSelection falls back to the oldest against it).
                  search={{ label: photo.label.value, from: photo.id }}
                  preload={false}
                >
                  <Columns2 />
                  <ActionLabel>Compare</ActionLabel>
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="touch-pan-y" {...swipe}>
        <PhotoImage id={photo.file.id} alt={`${name} progress photo, ${date}`} />
      </div>
      {place && place.total > 1 ? (
        <nav
          aria-label={`${name} photos`}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <StepLink photo={place.older} direction="Older" />
          <span className="text-muted-foreground tabular-nums">
            {place.position} of {place.total}
          </span>
          <StepLink photo={place.newer} direction="Newer" />
        </nav>
      ) : null}
      {error && error.id === photo.id ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
      <DangerZone
        title="Delete this photo"
        description="Permanently removes this photo from your history."
        actionLabel="Delete photo"
        onAction={() => setConfirming(true)}
        disabled={deleting}
      />
      <EditPhotoDialog photo={photo} open={editing} onOpenChange={setEditing} />
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!deleting) {
            setConfirming(open);
          }
        }}
        title="Delete this progress photo?"
        description="The photo is removed from your history for good. This can't be undone."
        destructive
        confirmLabel="Delete photo"
        pendingLabel="Deleting…"
        isPending={deleting}
        onConfirm={() => void remove()}
      />
    </>
  );
}
