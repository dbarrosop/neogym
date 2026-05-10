import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { useMemo } from "react";
import { BodyMetricsChart, type BodyMetricsPoint } from "@/components/body-metrics-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
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
      .sort((a, b) => new Date(a.measuredOn).getTime() - new Date(b.measuredOn).getTime())
      .map((m) => ({
        date: new Date(m.measuredOn).getTime(),
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
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (measurements.length === 0) {
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>No measurements yet.</p>
            <Button asChild size="sm">
              <Link to="/body/new">
                <Plus className="h-4 w-4" />
                Log your first measurement
              </Link>
            </Button>
          </CardContent>
        </Card>
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
                      <p className="text-sm font-medium tabular-nums">{formatDate(m.measuredOn)}</p>
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
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tracking
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Body</h1>
            <p className="text-sm text-muted-foreground">Log your weight and body fat over time.</p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/body/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New measurement</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
        </header>

        {renderContent()}
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  // Date inputs are naive (YYYY-MM-DD); parse as local to avoid TZ shifts.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) {
    return iso;
  }
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  );
}
