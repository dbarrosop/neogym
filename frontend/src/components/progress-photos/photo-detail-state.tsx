import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageOff } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isPhotoCollectionKey,
  photoKeys,
  type ReadyPhoto,
  readPhoto,
  readyPhoto,
} from "@/lib/progress-photos/api";
import { usePhotoOwner } from "./photo-session";

type CachedCollection = ReadyPhoto[] | { pages: { items: ReadyPhoto[] }[] } | undefined;

/**
 * A photo's row from a cached photo list (gallery pages, a label's history or a date).
 * The detail query selects the same fields, so the viewer can render it at once.
 */
function cachedRow(queryClient: QueryClient, owner: string, id: string) {
  const queries = queryClient.getQueryCache().findAll({
    queryKey: photoKeys.owner(owner),
    predicate: (query) => isPhotoCollectionKey(query.queryKey),
  });
  for (const query of queries) {
    const data = query.state.data as CachedCollection;
    const rows = Array.isArray(data) ? data : (data?.pages.flatMap((page) => page.items) ?? []);
    const row = rows.find((photo) => photo.id === id);
    if (row) {
      return { row, updatedAt: query.state.dataUpdatedAt };
    }
  }
  return undefined;
}

export function usePhotoDetail(id: string) {
  const owner = usePhotoOwner();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: photoKeys.detail(owner, id),
    queryFn: ({ signal }) => readPhoto(id, signal),
    // Stepping to (or opening) a photo already in a loaded list keeps the viewer
    // mounted instead of a page skeleton; the usual staleness rules still revalidate it.
    initialData: () => cachedRow(queryClient, owner, id)?.row,
    initialDataUpdatedAt: () => cachedRow(queryClient, owner, id)?.updatedAt,
  });
}

/** Loads one ready photo; renders its loading, error and not-found states otherwise. */
export function PhotoDetailState({
  id,
  children,
}: {
  id: string;
  children: (photo: ReadyPhoto) => ReactNode;
}) {
  const query = usePhotoDetail(id);
  if (readyPhoto(query.data)) {
    return children(query.data);
  }
  let fallback: ReactNode;
  if (query.isPending) {
    fallback = (
      <SkeletonState className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-[60dvh] w-full rounded-xl" />
      </SkeletonState>
    );
  } else if (query.isError) {
    fallback = (
      <ErrorState
        title="Couldn't load this photo"
        message={query.error.message}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  } else {
    fallback = (
      <EmptyState
        icon={ImageOff}
        title="Photo not found"
        description="It may have been deleted, or its upload didn't finish."
        actions={
          <Button asChild variant="outline">
            <Link to="/progress/body/photos" preload={false}>
              Back to progress photos
            </Link>
          </Button>
        }
      />
    );
  }
  return fallback;
}
