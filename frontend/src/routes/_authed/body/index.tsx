import { createFileRoute, redirect } from "@tanstack/react-router";

// Body moved under Progress; keep old bookmarks and installed-PWA links working.
export const Route = createFileRoute("/_authed/body/")({
  beforeLoad: () => {
    throw redirect({ to: "/progress/body", replace: true });
  },
});
