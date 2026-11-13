import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { AreaTabs } from "@/components/shell/area-tabs";
import { isFormPage, isSectionLanding } from "@/lib/navigation";

export const Route = createFileRoute("/_authed/nutrition")({
  component: NutritionLayoutRoute,
});

const TRAILING_SLASH = /\/$/;

function NutritionLayoutRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const path = pathname.replace(TRAILING_SLASH, "");
  // Create and edit pages are full form pages with their own sticky header.
  if (isFormPage(path)) {
    return <Outlet />;
  }
  // Detail pages sit under the breadcrumb trail; only section landings show the area tabs.
  if (!isSectionLanding(path)) {
    return (
      <PageShell maxWidth="4xl">
        <Outlet />
      </PageShell>
    );
  }
  // The day log (timeline + summary rail) and the foods table use the full width.
  const wide = path.startsWith("/nutrition/log/") || path === "/nutrition/foods";
  return (
    <PageShell maxWidth={wide ? "6xl" : "4xl"}>
      <PageHeader title="Nutrition" tabs={<AreaTabs area="nutrition" />} />
      <Outlet />
    </PageShell>
  );
}
