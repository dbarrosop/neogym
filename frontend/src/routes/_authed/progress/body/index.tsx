import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { useMemo } from "react";
import { BodyMetricsChart, type BodyMetricsPoint } from "@/components/body-metrics-chart";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { formatDateLong, parseDateOnly } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";

const BodyMeasurementsQuery = graphql(`
  query BodyMeasurements {
    bodyMeasurements(order_by: { measuredOn: desc }) {
      id
      measuredOn
      weightKg
      bodyFatPct
      notes
    }
  }
`);

export const Route = createFileRoute("/_authed/body/")({
  component: BodyRoute,
});

function BodyRoute() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["body_measurements"],
    queryFn: () => gqlRequest(BodyMeasurementsQuery),
  });

  const measurements = useMemo(() => data?.bodyMeasurements ?? [], [data]);

  const chartPoints = useMemo<BodyMetricsPoint[]>(() => {
    return [...measurements]
      .map((m) => {
        const date = parseDateOnly(m.measuredOn);
        return date ? { measurement: m, time: date.getTime() } : null;
      })
      .filter((x): x is { measurement: (typeof measurements)[number]; time: number } => x !== null)
      .sort((a, b) => a.time - b.time)
      .map(({ measurement: m, time }) => ({
        date: time,
        weightKg: m.weightKg !== null && m.weightKg !== undefined ? Number(m.weightKg) : null,
        bodyFatPct:
          m.bodyFatPct !== null && m.bodyFatPct !== undefined ? Number(m.bodyFatPct) : null,
      }));
  }, [measurements]);

  const weightCount = chartPoints.filter((p) => p.weightKg !== null).length;
  const fatCount = chartPoints.filter((p) => p.bodyFatPct !== null).length;

  function renderContent() {
    if (isLoading) {
      return <BodySkeleton />;
    }
    if (error) {
      return <ErrorState title="Failed to load body measurements" message={error.message} />;
    }
    if (measurements.length === 0) {
      return (
        <EmptyState title="No measurements yet.">
          <Button asChild size="sm">
            <Link to="/body/new">
              <Plus className="h-4 w-4" />
              Log your first measurement
            </Link>
          </Button>
        </EmptyState>
      );
    }
    return (
      <>
        {weightCount >= 2 || fatCount >= 2 ? (
          <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <CardHeader className="pb-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Trend
              </p>
              <CardTitle className="text-base font-medium">Weight & body fat over time</CardTitle>
            </CardHeader>
            <CardContent>
              <BodyMetricsChart points={chartPoints} />
            </CardContent>
          </Card>
        ) : null}

        <ul className="space-y-2">
          {measurements.map((m) => (
            <li key={m.id}>
              <Link to="/body/$id" params={{ id: m.id }} className="group block">
                <Card className="border-border/60 py-0 backdrop-blur transition-colors group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80">
                  <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium tabular-nums">
                        {formatDateLong(m.measuredOn)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatValues(m.weightKg, m.bodyFatPct)}
                      </p>
                      {m.notes ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground/80">{m.notes}</p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <PageShell maxWidth="3xl">
      <PageHeader
        eyebrow="Tracking"
        title="Body"
        description="Log your weight and body fat over time."
        actions={
          <Button asChild size="sm">
            <Link to="/body/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New measurement</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
        }
      />

      {renderContent()}
    </PageShell>
  );
}

function formatValues(
  weightKg: number | string | null | undefined,
  bodyFatPct: number | string | null | undefined,
): string {
  const parts: string[] = [];
  if (weightKg !== null && weightKg !== undefined) {
    parts.push(`${Number(weightKg).toFixed(2)} kg`);
  }
  if (bodyFatPct !== null && bodyFatPct !== undefined) {
    parts.push(`${Number(bodyFatPct).toFixed(1)} %`);
  }
  return parts.join(" · ");
}

function BodySkeleton() {
  return (
    <SkeletonState>
      <ul className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <Card className="border-border/60 py-0">
              <CardContent className="space-y-2 px-4 py-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </SkeletonState>
  );
}
