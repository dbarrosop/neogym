import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ImageOff } from "lucide-react";
import type { ReactNode } from "react";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { photoKeys, type ReadyPhoto, readPhoto, readyPhoto } from "@/lib/progress-photos/api";
import { usePhotoOwner } from "./photo-session";

export function usePhotoDetail(id: string) {
  const owner = usePhotoOwner();
  return useQuery({
    queryKey: photoKeys.detail(owner, id),
    queryFn: ({ signal }) => readPhoto(id, signal),
  });
}

/** Loads one ready photo; renders its loading, error and not-found states otherwise. */
export function PhotoDetailState({
  id,
  loadingPage,
  children,
}: {
  id: string;
  /** Wrap the fallback in a page shell (the edit route has no shell of its own until loaded). */
  loadingPage?: boolean;
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
  return loadingPage ? <PageShell maxWidth="2xl">{fallback}</PageShell> : fallback;
}
