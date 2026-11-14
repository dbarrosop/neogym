import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { EntryDetailCard, EntryDetailSkeleton } from "@/components/entry-detail";
import { HealthSourceTag, isHealthImport, visibleNotes } from "@/components/health-source-tag";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { graphql } from "@/gql";
import { formatDateLong } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { metricFormat } from "@/lib/metric-format";
import { numericOrNull } from "@/lib/rolling-average";

const BodyMeasurementByIdQuery = graphql(`
  query BodyMeasurementById($id: uuid!) {
    bodyMeasurement(id: $id) {
      id
      measuredOn
      weightKg
      bodyFatPct
      notes
      updatedAt
    }
  }
`);

export const Route = createFileRoute("/_authed/progress/body/$id")({
  component: BodyMeasurementDetailRoute,
});

function formatted(value: unknown, format: (value: number) => string) {
  const number = numericOrNull(value);
  return number === null ? "—" : format(number);
}

function BodyMeasurementDetailRoute() {
  const { id } = Route.useParams();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["body_measurements", id],
    queryFn: () => gqlRequest(BodyMeasurementByIdQuery, { id }),
  });

  function renderContent() {
    if (isLoading) {
      return <EntryDetailSkeleton />;
    }
    if (error) {
      return (
        <ErrorState
          title="Couldn't load this measurement"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      );
    }
    if (!data?.bodyMeasurement) {
      return <EmptyState title="Measurement not found." />;
    }
    const m = data.bodyMeasurement;
    return (
      <>
        <PageHeader
          eyebrow={
            <span className="flex flex-wrap items-center gap-2">
              Measurement
              {isHealthImport(m.notes) ? <HealthSourceTag /> : null}
            </span>
          }
          title={formatDateLong(m.measuredOn)}
          actions={
            <Button asChild variant="outline">
              <Link to="/progress/body/$id/edit" params={{ id: m.id }}>
                <Pencil />
                Edit
              </Link>
            </Button>
          }
        />
        <EntryDetailCard
          stats={[
            { label: "Weight", value: formatted(m.weightKg, metricFormat.weight) },
            { label: "Body fat", value: formatted(m.bodyFatPct, metricFormat.bodyFat) },
          ]}
          notes={visibleNotes(m.notes)}
        />
      </>
    );
  }

  return <PageShell contentClassName="max-w-[760px]">{renderContent()}</PageShell>;
}
