import { createFileRoute, redirect } from "@tanstack/react-router";

// Energy moved under Progress; keep old bookmarks and installed-PWA links working.
export const Route = createFileRoute("/_authed/energy/")({
  beforeLoad: () => {
    throw redirect({ to: "/progress/energy", replace: true });
  },
});
