import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/train/")({
  beforeLoad: () => {
    throw redirect({ to: "/train/sessions", replace: true });
  },
});
