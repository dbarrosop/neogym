import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Images } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { readPhotoSummary } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";
import { PrivatePhotos, usePhotoScope } from "./photo-boundary";

function PhotoSummaryStats() {
  const scope = usePhotoScope();
  const query = useQuery({
    queryKey: ["photo-summary", scope.owner],
    queryFn: ({ signal }) => readPhotoSummary(scope, signal),
  });
  const summary = query.data;
  return (
    <div className="text-sm text-muted-foreground" role="status">
      {summary ? (
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
          <span>
            <strong className="font-semibold text-foreground">{summary.count}</strong>{" "}
            {summary.count === 1 ? "photo" : "photos"}
          </span>
          {summary.latestDate ? (
            <span>
              Last taken{" "}
              <time dateTime={summary.latestDate}>{photoDateLabel(summary.latestDate)}</time>
            </span>
          ) : (
            <span>No photos taken yet</span>
          )}
        </p>
      ) : (
        <p>{query.isPending ? "Loading photo summary…" : "Photo summary unavailable"}</p>
      )}
    </div>
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
          <PrivatePhotos>
            <PhotoSummaryStats />
          </PrivatePhotos>
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
