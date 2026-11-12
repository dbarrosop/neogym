import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/progress/")({
  beforeLoad: () => {
    throw redirect({ to: "/progress/body", replace: true });
  },
});
