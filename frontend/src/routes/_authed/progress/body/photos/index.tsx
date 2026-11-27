import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Images } from "lucide-react";
import { z } from "zod";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import {
  catalogLabelValue,
  PhotoLabelSelect,
  PhotoLabelsState,
  photoLabelName,
  usePhotoLabels,
} from "@/components/progress-photos/photo-fields";
import { usePhotoOwner } from "@/components/progress-photos/photo-session";
import { PhotoTimeline } from "@/components/progress-photos/photo-timeline";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listPhotos, type PhotoCursor, photoKeys } from "@/lib/progress-photos/api";

// The label filter lives in the URL so returning from a photo keeps it. Values are
// checked against the live catalog, which can be newer than the generated types.
const searchSchema = z.object({ label: z.string().max(64).optional() });

export const Route = createFileRoute("/_authed/progress/body/photos/")({
  validateSearch: searchSchema,
  component: PhotoGallery,
});

function GallerySkeleton() {
  return (
    <SkeletonState className="border-t">
      {[0, 1].map((row) => (
        <div
          key={row}
          className="grid gap-3 border-b py-4 md:grid-cols-[minmax(0,1fr)_10rem] md:py-5"
        >
          <Skeleton className="h-5 w-28 md:col-start-2 md:row-start-1 md:ml-5" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8rem),1fr))] gap-3 md:col-start-1 md:row-start-1 md:pr-6">
            {[0, 1, 2].map((tile) => (
              <Skeleton key={tile} className="aspect-[4/5] w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </SkeletonState>
  );
}

function GalleryEmpty({
  filterName,
  showAll,
}: {
  filterName: string | undefined;
  showAll: () => void;
}) {
  if (filterName === undefined) {
    return (
      <EmptyState
        icon={Images}
        title="No progress photos yet"
        description="Add a photo to start your history. Only you can see your progress photos."
      />
    );
  }
  return (
    <EmptyState
      icon={Images}
      title={`No ${filterName} photos`}
      description="Try another label, or show all your photos."
      actions={
        <Button type="button" variant="outline" onClick={showAll}>
          Show all photos
        </Button>
      }
    />
  );
}

function LoadOlder({
  loading,
  busy,
  failed,
  load,
}: {
  loading: boolean;
  busy: boolean;
  failed: boolean;
  load: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={busy} onClick={load}>
        {loading ? "Loading older photos…" : "Load older photos"}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn't load older photos. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}

function PhotoGallery() {
  const owner = usePhotoOwner();
  const labels = usePhotoLabels();
  const navigate = Route.useNavigate();
  const filter = Route.useSearch().label ?? "";
  const setFilter = (value: string) =>
    navigate({ search: (prev) => ({ ...prev, label: value || undefined }), replace: true });
  const label = catalogLabelValue(filter, labels.data);
  // Filter only by a value the catalog confirms; an unknown one shows the select's warning.
  const filterAvailable = !filter || label !== null;
  const photos = useInfiniteQuery({
    queryKey: photoKeys.list(owner, filter),
    enabled: filterAvailable,
    initialPageParam: null as PhotoCursor | null,
    queryFn: ({ pageParam, signal }) => listPhotos(owner, label, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
  });
  const filterRow = filter ? labels.data?.find((row) => row.value === filter) : undefined;
  let filterName: string | undefined;
  if (filter) {
    filterName = filterRow ? photoLabelName(filterRow) : filter;
  }

  function renderHistory() {
    if (photos.isPending) {
      return <GallerySkeleton />;
    }
    const error =
      photos.isError && !photos.isFetchNextPageError ? (
        <ErrorState
          title="Couldn't load photos"
          message={photos.error.message}
          onRetry={() => void photos.refetch()}
          isRetrying={photos.isFetching}
        />
      ) : null;
    const items = photos.data?.pages.flatMap((page) => page.items) ?? [];
    if (!photos.data) {
      return error;
    }
    if (items.length === 0 && !photos.hasNextPage) {
      return (
        <>
          {error}
          <GalleryEmpty filterName={filterName} showAll={() => void setFilter("")} />
        </>
      );
    }
    return (
      <>
        {error}
        {items.length > 0 ? <PhotoTimeline photos={items} /> : null}
        {photos.hasNextPage ? (
          <LoadOlder
            loading={photos.isFetchingNextPage}
            busy={photos.isFetching}
            failed={photos.isFetchNextPageError}
            load={() => void photos.fetchNextPage()}
          />
        ) : null}
      </>
    );
  }

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
      <PhotoLabelsState labels={labels}>
        {(catalog) => (
          <div className="max-w-64">
            <PhotoLabelSelect labels={catalog} value={filter} includeAll onChange={setFilter} />
          </div>
        )}
      </PhotoLabelsState>
      {filterAvailable ? renderHistory() : null}
    </PageShell>
  );
}
