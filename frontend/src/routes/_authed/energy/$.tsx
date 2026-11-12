import { createFileRoute, redirect } from "@tanstack/react-router";

// Energy moved under Progress; forward old detail and edit URLs.
export const Route = createFileRoute("/_authed/energy/$")({
  beforeLoad: ({ params }) => {
    throw redirect({ href: `/progress/energy/${params._splat ?? ""}`, replace: true });
  },
});
