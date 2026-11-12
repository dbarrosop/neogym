import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { AreaTabs } from "@/components/shell/area-tabs";

export const Route = createFileRoute("/_authed/nutrition")({
  component: NutritionLayoutRoute,
});

const TRAILING_SLASH = /\/$/;

function NutritionLayoutRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // The day log (timeline + summary rail) and the foods table use the full width.
  const wide =
    pathname.startsWith("/nutrition/days/") ||
    pathname.replace(TRAILING_SLASH, "") === "/nutrition/foods";
  return (
    <PageShell maxWidth={wide ? "6xl" : "4xl"}>
      <PageHeader title="Nutrition" tabs={<AreaTabs area="nutrition" />} />
      <Outlet />
    </PageShell>
  );
}
