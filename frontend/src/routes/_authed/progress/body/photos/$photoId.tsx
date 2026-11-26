import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { PhotoDetailState } from "@/components/progress-photos/photo-detail-state";
import { photoAngleName } from "@/components/progress-photos/photo-fields";
import { PhotoImage } from "@/components/progress-photos/photo-image";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { photoDateLabel } from "@/lib/progress-photos/date";

export const Route = createFileRoute("/_authed/progress/body/photos/$photoId")({
  component: PhotoViewer,
});

function PhotoViewer() {
  const { photoId } = Route.useParams();
  return (
    <PageShell maxWidth="5xl">
      <PhotoDetailState id={photoId}>
        {(photo) => {
          const angle = photoAngleName(photo.label);
          const date = photoDateLabel(photo.takenOn);
          return (
            <>
              <PageHeader
                title="Progress photo"
                tabs={<AreaTabs area="progress" />}
                actions={
                  <Button asChild variant="outline">
                    <Link
                      to="/progress/body/photos/$photoId/edit"
                      params={{ photoId }}
                      preload={false}
                      replace
                    >
                      Edit
                    </Link>
                  </Button>
                }
                description={
                  <>
                    {angle} · <time dateTime={photo.takenOn}>{date}</time>
                  </>
                }
              />
              <PhotoImage id={photo.file.id} alt={`${angle} progress photo, ${date}`} />
            </>
          );
        }}
      </PhotoDetailState>
    </PageShell>
  );
}
