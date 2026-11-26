import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { type Photo, readPhoto, readyPhoto } from "@/lib/progress-photos/api";
import { usePhotoScope } from "./photo-boundary";
import { PhotoLoadError } from "./photo-fields";

export function PhotoDetailState({
  id,
  loadingPage,
  children,
}: {
  id: string;
  loadingPage?: boolean;
  children: (photo: Photo & { file: { id: string; isUploaded: true } }) => ReactNode;
}) {
  const scope = usePhotoScope();
  const query = useQuery({
    queryKey: ["photo-detail", scope.owner, id],
    queryFn: ({ signal }) => readPhoto(scope, id, signal),
  });
  const pending = () => {
    if (query.isPending) {
      return (
        <p role="status" className="text-sm text-muted-foreground">
          Loading photo…
        </p>
      );
    }
    if (query.isError) {
      return <PhotoLoadError title="Couldn't load photo" retry={() => void query.refetch()} />;
    }
    if (!readyPhoto(query.data)) {
      return (
        <EmptyState
          title="Photo unavailable"
          description="It may have been removed or not finished uploading."
        >
          <Button asChild variant="outline">
            <Link to="/progress/body/photos" preload={false}>
              Back to progress photos
            </Link>
          </Button>
        </EmptyState>
      );
    }
    return null;
  };
  const fallback = pending();
  if (fallback) {
    return loadingPage ? <PageShell maxWidth="2xl">{fallback}</PageShell> : fallback;
  }
  return readyPhoto(query.data) ? children(query.data) : null;
}
