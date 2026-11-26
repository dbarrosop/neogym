import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { EntryDetailCard, EntryDetailSkeleton } from "@/components/entry-detail";
import { HealthSourceTag, isHealthImport, visibleNotes } from "@/components/health-source-tag";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { TodayEnergyEstimate } from "@/components/today-energy-estimate";
import { Button } from "@/components/ui/button";
import { graphql } from "@/gql";
import { formatDateLong } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { formatKcal } from "@/lib/metric-format";
import { numericOrNull } from "@/lib/rolling-average";

const DailyEnergyByIdQuery = graphql(`
  query DailyEnergyById($id: uuid!) {
    dailyEnergyEntry(id: $id) {
      id
      energyOn
      activeKcal
      restingKcal
      notes
      updatedAt
    }
  }
`);

export const Route = createFileRoute("/_authed/progress/energy/$id")({
  component: DailyEnergyDetailRoute,
});

function kcal(value: unknown) {
  const number = numericOrNull(value);
  return number === null ? "—" : formatKcal(number);
}

function DailyEnergyDetailRoute() {
  const { id } = Route.useParams();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["daily_energy", id],
    queryFn: () => gqlRequest(DailyEnergyByIdQuery, { id }),
  });

  function renderContent() {
    if (isLoading) {
      return <EntryDetailSkeleton />;
    }
    if (error) {
      return (
        <ErrorState
          title="Couldn't load this energy day"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      );
    }
    if (!data?.dailyEnergyEntry) {
      return <EmptyState title="Energy day not found." />;
    }
    const entry = data.dailyEnergyEntry;
    return (
      <>
        <PageHeader
          eyebrow={
            <span className="flex flex-wrap items-center gap-2">
              Energy day
              {isHealthImport(entry.notes) ? <HealthSourceTag /> : null}
            </span>
          }
          title={formatDateLong(entry.energyOn)}
          actions={
            <Button asChild variant="outline">
              <Link to="/progress/energy/$id/edit" params={{ id: entry.id }}>
                <Pencil />
                Edit
              </Link>
            </Button>
          }
        />
        <EntryDetailCard
          stats={[
            { label: "Active", value: kcal(entry.activeKcal) },
            { label: "Resting", value: kcal(entry.restingKcal) },
          ]}
          notes={visibleNotes(entry.notes)}
        >
          <TodayEnergyEstimate date={entry.energyOn} variant="log" />
        </EntryDetailCard>
      </>
    );
  }

  return <PageShell contentClassName="max-w-[760px]">{renderContent()}</PageShell>;
}
