import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { OverviewBodyCard } from "@/components/progress/overview-body-card";
import { OverviewEnergyCard } from "@/components/progress/overview-energy-card";
import { OverviewMusclesCard } from "@/components/progress/overview-muscles-card";
import { OverviewStrengthCard } from "@/components/progress/overview-strength-card";
import { AreaTabs } from "@/components/shell/area-tabs";

export const Route = createFileRoute("/_authed/progress/overview")({
  component: ProgressOverviewRoute,
});

/**
 * The Progress landing: one card per section with "See all". Muscles and
 * Strength share their sections' default 8-week queries; Body and Energy
 * cover the last 30 days.
 */
function ProgressOverviewRoute() {
  return (
    <PageShell maxWidth="6xl" contentClassName="space-y-5">
      <PageHeader title="Progress" tabs={<AreaTabs area="progress" />} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-start gap-5">
        <OverviewMusclesCard />
        <OverviewStrengthCard />
        <OverviewBodyCard />
        <OverviewEnergyCard />
      </div>
    </PageShell>
  );
}
