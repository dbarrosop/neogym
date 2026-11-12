import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/me/")({
  beforeLoad: () => {
    throw redirect({ to: "/me/journal", replace: true });
  },
});
