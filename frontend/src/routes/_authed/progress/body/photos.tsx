import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Fragment } from "react";
import { useAuth } from "@/lib/nhost/auth-provider";

export const Route = createFileRoute("/_authed/progress/body/photos")({
  ssr: false,
  component: PhotoLayout,
});

function PhotoLayout() {
  const { user } = useAuth();
  // An account switch remounts the photo screens, so no draft or form state carries over.
  return user ? (
    <Fragment key={user.id}>
      <Outlet />
    </Fragment>
  ) : null;
}
