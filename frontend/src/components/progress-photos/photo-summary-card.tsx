import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Images } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { photoKeys, readPhotoSummary } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";
import { usePhotoOwner } from "./photo-session";

function PhotoSummaryStats() {
  const owner = usePhotoOwner();
  const query = useQuery({
    queryKey: photoKeys.summary(owner),
    queryFn: ({ signal }) => readPhotoSummary(owner, signal),
  });
  const summary = query.data;
  if (!summary) {
    return query.isError ? (
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
    ) : (
      <Skeleton aria-hidden="true" className="h-5 w-40" />
    );
  }
  if (summary.count === 0) {
    return <p className="text-sm text-muted-foreground">No photos yet</p>;
  }
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground tabular-nums">
      <span>
        <strong className="font-semibold text-foreground">{summary.count}</strong>{" "}
        {summary.count === 1 ? "photo" : "photos"}
      </span>
      {summary.latestDate ? (
        <span>
          Last taken <time dateTime={summary.latestDate}>{photoDateLabel(summary.latestDate)}</time>
        </span>
      ) : null}
    </p>
  );
}

export function PhotoSummaryCard() {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-xl border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-link">
          <Images size={20} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 id={titleId} className="text-base font-semibold">
            Progress photos
          </h2>
          <PhotoSummaryStats />
        </div>
      </div>
      <Button asChild variant="outline" className="min-h-11">
        <Link to="/progress/body/photos" preload={false}>
          View progress photos
        </Link>
      </Button>
    </section>
  );
}
