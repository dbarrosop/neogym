import { createFileRoute } from "@tanstack/react-router";
import { PhotoBoundary } from "@/components/progress-photos/photo-boundary";

export const Route = createFileRoute("/_authed/progress/body/photos")({
  ssr: false,
  component: PhotoBoundary,
});
