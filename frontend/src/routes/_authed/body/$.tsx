import { createFileRoute, redirect } from "@tanstack/react-router";

// Body moved under Progress; forward old detail and edit URLs.
export const Route = createFileRoute("/_authed/body/$")({
  beforeLoad: ({ params }) => {
    throw redirect({ href: `/progress/body/${params._splat ?? ""}`, replace: true });
  },
});
