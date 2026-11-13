import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { isFormPage, isSectionLanding } from "@/lib/navigation";

export const Route = createFileRoute("/_authed/nutrition")({
  component: NutritionLayoutRoute,
});

const TRAILING_SLASH = /\/$/;

/** Primary "New …" action per library section, shown at the header's right. */
const SECTION_ACTIONS: Record<
  string,
  { to: "/nutrition/plans/new" | "/nutrition/foods/new" | "/nutrition/meals/new"; label: string }
> = {
  "/nutrition/plans": { to: "/nutrition/plans/new", label: "New plan" },
  "/nutrition/foods": { to: "/nutrition/foods/new", label: "New food" },
  "/nutrition/meals": { to: "/nutrition/meals/new", label: "New meal" },
};

function NutritionLayoutRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const path = pathname.replace(TRAILING_SLASH, "");
  // Create and edit pages are full form pages with their own sticky header.
  if (isFormPage(path)) {
    return <Outlet />;
  }
  // Detail pages own their page shell; only section landings show the area tabs.
  if (!isSectionLanding(path)) {
    return <Outlet />;
  }
  const action = SECTION_ACTIONS[path];
  // Section landings (day log, plan grid, food and meal tables) use the full width.
  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        title="Nutrition"
        tabs={<AreaTabs area="nutrition" />}
        actions={
          action ? (
            <Button asChild>
              <Link to={action.to}>
                <Plus />
                {action.label}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Outlet />
    </PageShell>
  );
}
