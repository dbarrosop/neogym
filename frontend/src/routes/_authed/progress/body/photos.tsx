import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { PrivatePhotos } from "@/components/progress-photos/photo-boundary";

export const Route = createFileRoute("/_authed/progress/body/photos")({
  ssr: false,
  component: PhotoLayout,
});

function PhotoLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const keepWhileHidden =
    pathname === "/progress/body/photos/new" || pathname === "/progress/body/photos/new/";
  return (
    <PrivatePhotos key={pathname} keepWhileHidden={keepWhileHidden}>
      <Outlet />
    </PrivatePhotos>
  );
}
