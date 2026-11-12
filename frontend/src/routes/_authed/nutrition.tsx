import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { AreaTabs } from "@/components/shell/area-tabs";

export const Route = createFileRoute("/_authed/nutrition")({
  component: NutritionLayoutRoute,
});

function NutritionLayoutRoute() {
  return (
    <PageShell maxWidth="4xl">
      <PageHeader title="Nutrition" tabs={<AreaTabs area="nutrition" />} />
      <Outlet />
    </PageShell>
  );
}
