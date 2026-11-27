import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState } from "@/components/patterns/query-states";
import { usePhotoScope } from "@/components/progress-photos/photo-boundary";
import {
  catalogLabelValue,
  PhotoLabelSelect,
  PhotoLoadError,
  usePhotoLabels,
} from "@/components/progress-photos/photo-fields";
import { PhotoTimeline } from "@/components/progress-photos/photo-timeline";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { listPhotos, type PhotoCursor } from "@/lib/progress-photos/api";

export const Route = createFileRoute("/_authed/progress/body/photos/")({ component: PhotoGallery });

function PhotoGallery() {
  const scope = usePhotoScope();
  const labels = usePhotoLabels();
  const [filter, setFilter] = useState("");
  const label = catalogLabelValue(filter, labels.data);
  const filterAvailable = !filter || label !== null;
  const photos = useInfiniteQuery({
    queryKey: ["photo-gallery", scope.owner, filter],
    enabled: filterAvailable,
    initialPageParam: null as PhotoCursor | null,
    queryFn: ({ pageParam, signal }) => listPhotos(scope, label, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
  });
  const items = filterAvailable ? photos.data?.pages.flatMap((page) => page.items) : undefined;
  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        title="Progress photos"
        tabs={<AreaTabs area="progress" />}
        actions={
          <Button asChild>
            <Link to="/progress/body/photos/new" preload={false}>
              Add photo
            </Link>
          </Button>
        }
      />
      {labels.isError ? (
        <PhotoLoadError title="Couldn't load photo labels" retry={() => void labels.refetch()} />
      ) : null}
      {labels.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading labels…
        </p>
      ) : null}
      {labels.data ? (
        <div className="max-w-64">
          <PhotoLabelSelect labels={labels.data} value={filter} includeAll onChange={setFilter} />
        </div>
      ) : null}
      {filterAvailable && photos.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading photos…
        </p>
      ) : null}
      {filterAvailable && photos.isError && !photos.isFetchNextPageError ? (
        <PhotoLoadError title="Couldn't load photos" retry={() => void photos.refetch()} />
      ) : null}
      {items?.length === 0 && !photos.hasNextPage ? (
        <EmptyState
          title={filter ? "No photos for this label" : "No progress photos"}
          description={
            filter
              ? "Choose another label or show all labels."
              : "Add a photo to begin your private history."
          }
        />
      ) : null}
      {items && items.length > 0 ? <PhotoTimeline photos={items} /> : null}
      {filterAvailable && photos.hasNextPage ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={photos.isFetching}
            onClick={() => void photos.fetchNextPage()}
          >
            {photos.isFetchingNextPage ? "Loading older photos…" : "Load older photos"}
          </Button>
          {photos.isFetchNextPageError ? (
            <p role="alert" className="text-sm text-destructive">
              Couldn't load older photos. Try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
