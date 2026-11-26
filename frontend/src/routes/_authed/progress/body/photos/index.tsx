import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState } from "@/components/patterns/query-states";
import { usePhotoScope } from "@/components/progress-photos/photo-boundary";
import {
  AngleSelect,
  PhotoLoadError,
  photoAngleName,
  photoLabel,
  usePhotoAngles,
} from "@/components/progress-photos/photo-fields";
import { PhotoImage } from "@/components/progress-photos/photo-image";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { listPhotos, type PhotoCursor } from "@/lib/progress-photos/api";
import { photoDateLabel } from "@/lib/progress-photos/date";

export const Route = createFileRoute("/_authed/progress/body/photos/")({ component: PhotoGallery });

function PhotoGallery() {
  const scope = usePhotoScope();
  const angles = usePhotoAngles();
  const [filter, setFilter] = useState("");
  const [history, setHistory] = useState<PhotoCursor[]>([]);
  const cursor = history.at(-1) ?? null;
  const label = photoLabel(filter, angles.data);
  const filterAvailable = !filter || label !== null;
  const photos = useQuery({
    queryKey: ["photo-gallery", scope.owner, filter, cursor],
    enabled: filterAvailable,
    queryFn: ({ signal }) => {
      if (!filterAvailable) {
        throw new Error("This photo angle is no longer available.");
      }
      return listPhotos(scope, label, cursor, signal);
    },
  });
  const page = filterAvailable ? photos.data : undefined;
  const last = page?.items.at(-1);
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
      {angles.isError ? (
        <PhotoLoadError title="Couldn't load photo angles" retry={() => void angles.refetch()} />
      ) : null}
      {angles.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading angles…
        </p>
      ) : null}
      {angles.data ? (
        <div className="max-w-64">
          <AngleSelect
            angles={angles.data}
            value={filter}
            includeAll
            onChange={(value) => {
              setFilter(value);
              setHistory([]);
            }}
          />
        </div>
      ) : null}
      {filterAvailable && photos.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading photos…
        </p>
      ) : null}
      {filterAvailable && photos.isError ? (
        <PhotoLoadError title="Couldn't load photos" retry={() => void photos.refetch()} />
      ) : null}
      {page?.items.length === 0 ? (
        <EmptyState
          title={filter ? "No photos for this angle" : "No progress photos"}
          description={
            filter
              ? "Choose another angle or show all angles."
              : "Add a photo to begin your private history."
          }
        />
      ) : null}
      {page && page.items.length > 0 ? (
        <ul
          aria-label="Progress photos"
          className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4"
        >
          {page.items.map((photo) => (
            <li key={photo.id} className="min-w-0">
              <Link
                to="/progress/body/photos/$photoId"
                params={{ photoId: photo.id }}
                preload={false}
                className="block overflow-hidden rounded-xl border bg-card hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
              >
                <PhotoImage id={photo.file.id} thumbnail alt="" />
                <div className="space-y-1 p-3 text-sm">
                  <p className="font-medium">{photoAngleName(photo.label)}</p>
                  <time dateTime={photo.takenOn} className="text-muted-foreground">
                    {photoDateLabel(photo.takenOn)}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {filterAvailable && (history.length > 0 || page?.hasNext) ? (
        <fieldset className="flex flex-wrap items-center gap-3" aria-label="Photo pages">
          <Button
            type="button"
            variant="outline"
            disabled={history.length === 0 || photos.isPending}
            onClick={() => setHistory((items) => items.slice(0, -1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground" role="status">
            Page {history.length + 1}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!page?.hasNext || !last || photos.isFetching}
            onClick={() => {
              if (last) {
                const { takenOn, createdAt, id } = last;
                setHistory((items) => [...items, { takenOn, createdAt, id }]);
              }
            }}
          >
            Next
          </Button>
        </fieldset>
      ) : null}
    </PageShell>
  );
}
