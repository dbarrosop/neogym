import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Columns2, Images, Plus } from "lucide-react";
import { z } from "zod";
import { ActionLabel, PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import {
  catalogLabelValue,
  PhotoLabelChips,
  PhotoLabelsState,
  photoLabelName,
  usePhotoLabels,
} from "@/components/progress-photos/photo-fields";
import { usePhotoMeasurements, usePhotoOwner } from "@/components/progress-photos/photo-session";
import { PhotoContactSheet, PhotoPoseGrid } from "@/components/progress-photos/photo-sheet";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listPhotos,
  type PhotoCursor,
  photoKeys,
  type ReadyPhoto,
} from "@/lib/progress-photos/api";

// The label filter lives in the URL so returning from a photo keeps it. Values are
// checked against the live catalog, which can be newer than the generated types.
const searchSchema = z.object({ label: z.string().max(64).optional() });

export const Route = createFileRoute("/_authed/progress/body/photos/")({
  validateSearch: searchSchema,
  component: PhotoGallery,
});

function GallerySkeleton() {
  return (
    <SkeletonState className="flex flex-col">
      {[0, 1].map((row) => (
        <div
          key={row}
          className="grid gap-3 border-t py-5 first:border-t-0 first:pt-0 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6"
        >
          <Skeleton className="h-5 w-28" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(2,minmax(0,11rem))]">
            {[0, 1].map((tile) => (
              <Skeleton key={tile} className="aspect-[4/5] w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </SkeletonState>
  );
}

function ChipsPlaceholder() {
  return (
    <div className="flex gap-2" aria-hidden="true">
      {[0, 1, 2].map((chip) => (
        <Skeleton key={chip} className="h-8 w-20 rounded-full" />
      ))}
    </div>
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

/** The newest loaded photo's label that has at least two photos to compare, if any. */
function comparableLabel(items: readonly ReadyPhoto[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.label.value, (counts.get(item.label.value) ?? 0) + 1);
  }
  return items.find((item) => (counts.get(item.label.value) ?? 0) > 1)?.label.value;
}

function PhotoGallery() {
  const owner = usePhotoOwner();
  const labels = usePhotoLabels();
  const measurementFor = usePhotoMeasurements(0);
  const navigate = Route.useNavigate();
  const filter = Route.useSearch().label ?? "";
  const setFilter = (value: string) =>
    navigate({ search: (prev) => ({ ...prev, label: value || undefined }), replace: true });
  const label = catalogLabelValue(filter, labels.data);
  // Filter only by a value the catalog confirms; an unknown one shows a warning instead.
  const filterAvailable = !filter || label !== null;
  const photos = useInfiniteQuery({
    queryKey: photoKeys.list(owner, filter),
    enabled: filterAvailable,
    initialPageParam: null as PhotoCursor | null,
    queryFn: ({ pageParam, signal }) => listPhotos(owner, label, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
  });
  const items = photos.data?.pages.flatMap((page) => page.items) ?? [];
  const compareLabel = comparableLabel(items);
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
        {items.length > 0 && filterName !== undefined ? (
          <PhotoPoseGrid photos={items} labelName={filterName} measurementFor={measurementFor} />
        ) : null}
        {items.length > 0 && filterName === undefined ? (
          <PhotoContactSheet
            photos={items}
            labels={labels.data ?? []}
            measurementFor={measurementFor}
          />
        ) : null}
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
          <>
            {compareLabel ? (
              <Button asChild variant="outline">
                <Link
                  to="/progress/body/photos/compare"
                  search={{ label: compareLabel }}
                  preload={false}
                >
                  <Columns2 />
                  <ActionLabel>Compare</ActionLabel>
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link to="/progress/body/photos/new" preload={false}>
                <Plus />
                <ActionLabel>Add photos</ActionLabel>
              </Link>
            </Button>
          </>
        }
      />
      <PhotoLabelsState labels={labels} placeholder={<ChipsPlaceholder />}>
        {(catalog) => (
          <>
            <PhotoLabelChips labels={catalog} value={filter} onChange={setFilter} />
            {filterAvailable ? null : (
              <p role="alert" className="text-sm text-destructive">
                This label is no longer available. Choose another one.
              </p>
            )}
          </>
        )}
      </PhotoLabelsState>
      {filterAvailable ? renderHistory() : null}
    </PageShell>
  );
}
