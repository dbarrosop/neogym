import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Images, Plus } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listPhotosOn, photoKeys, readPhotoSummary } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";
import { sortPhotoLabels } from "@/lib/progress-photos/sheet";
import { photoLabelName } from "./photo-fields";
import { PhotoImage } from "./photo-image";
import { usePhotoOwner } from "./photo-session";

const CHECK_IN_TILES = 4;

/** Thumbnails of the photos taken on the latest date, front before back. */
function LatestCheckIn({ date }: { date: string }) {
  const owner = usePhotoOwner();
  const query = useQuery({
    queryKey: photoKeys.day(owner, date),
    queryFn: ({ signal }) => listPhotosOn(owner, date, signal),
  });
  if (!query.data) {
    return query.isPending ? (
      <Skeleton aria-hidden="true" className="aspect-[4/1.25] w-full rounded-lg" />
    ) : null;
  }
  const order = sortPhotoLabels(query.data.map((photo) => photo.label)).map((row) => row.value);
  const photos = [...query.data]
    .sort((a, b) => order.indexOf(a.label.value) - order.indexOf(b.label.value))
    .slice(0, CHECK_IN_TILES);
  const dateLabel = photoDateLabel(date);
  return (
    <ul aria-label={`Photos from ${dateLabel}`} className="grid grid-cols-4 gap-2">
      {photos.map((photo) => (
        <li key={photo.id}>
          <Link
            to="/progress/body/photos/$photoId"
            params={{ photoId: photo.id }}
            preload={false}
            aria-label={`${photoLabelName(photo.label)}, ${dateLabel}`}
            className="block overflow-hidden rounded-lg border hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <PhotoImage id={photo.file.id} thumbnail eager alt="" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Progress › Body's entry point to photos: the count and latest date taken, that date's
 * photos, and links to the gallery and the check-in form.
 */
export function PhotoSummaryCard() {
  const titleId = useId();
  const owner = usePhotoOwner();
  const query = useQuery({
    queryKey: photoKeys.summary(owner),
    queryFn: ({ signal }) => readPhotoSummary(owner, signal),
  });
  const summary = query.data;

  let stats = <Skeleton aria-hidden="true" className="h-5 w-40" />;
  if (summary && summary.count === 0) {
    stats = <p className="text-sm text-muted-foreground">No photos yet</p>;
  } else if (summary) {
    stats = (
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground tabular-nums">
        <span>
          <strong className="font-semibold text-foreground">{summary.count}</strong>{" "}
          {summary.count === 1 ? "photo" : "photos"}
        </span>
        {summary.latestDate ? (
          <span>
            Last taken{" "}
            <time dateTime={summary.latestDate}>{photoDateLabel(summary.latestDate)}</time>
          </span>
        ) : null}
      </p>
    );
  } else if (query.isError) {
    stats = (
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        Couldn't load your photos.
        <button
          type="button"
          className="min-h-11 text-link underline-offset-4 hover:underline disabled:opacity-60"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Retry
        </button>
      </p>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-link">
          <Images size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 id={titleId} className="text-base font-semibold">
            Progress photos
          </h2>
          {stats}
        </div>
      </div>
      {summary?.latestDate ? <LatestCheckIn date={summary.latestDate} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11 flex-1">
          <Link to="/progress/body/photos" preload={false}>
            View all<span className="sr-only"> progress photos</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 flex-1">
          <Link to="/progress/body/photos/new" preload={false}>
            <Plus />
            Add photos
          </Link>
        </Button>
      </div>
    </section>
  );
}
