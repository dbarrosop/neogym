import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { useMemo } from "react";
import { DailyEnergyChart, type DailyEnergyPoint } from "@/components/daily-energy-chart";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { formatDailyEnergyValues } from "@/lib/daily-energy";
import { formatDateLong, parseDateOnly } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";

const DailyEnergyQuery = graphql(`
  query DailyEnergy {
    dailyEnergyEntries(order_by: { energyOn: desc }) {
      id
      energyOn
      activeKcal
      restingKcal
      notes
    }
  }
`);

export const Route = createFileRoute("/_authed/energy/")({
  component: DailyEnergyRoute,
});

function DailyEnergyRoute() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["daily_energy"],
    queryFn: () => gqlRequest(DailyEnergyQuery),
  });

  const entries = useMemo(() => data?.dailyEnergyEntries ?? [], [data]);

  const chartPoints = useMemo<DailyEnergyPoint[]>(() => {
    return [...entries]
      .map((entry) => {
        const date = parseDateOnly(entry.energyOn);
        return date ? { entry, time: date.getTime() } : null;
      })
      .filter((x): x is { entry: (typeof entries)[number]; time: number } => x !== null)
      .sort((a, b) => a.time - b.time)
      .map(({ entry, time }) => ({
        date: time,
        activeKcal:
          entry.activeKcal !== null && entry.activeKcal !== undefined
            ? Number(entry.activeKcal)
            : null,
        restingKcal:
          entry.restingKcal !== null && entry.restingKcal !== undefined
            ? Number(entry.restingKcal)
            : null,
      }));
  }, [entries]);

  const activeCount = chartPoints.filter((p) => p.activeKcal !== null).length;
  const restingCount = chartPoints.filter((p) => p.restingKcal !== null).length;

  function renderContent() {
    if (isLoading) {
      return <EnergySkeleton />;
    }
    if (error) {
      return <ErrorState title="Failed to load energy entries" message={error.message} />;
    }
    if (entries.length === 0) {
      return (
        <EmptyState title="No energy days yet.">
          <Button asChild size="sm">
            <Link to="/energy/new">
              <Plus className="h-4 w-4" />
              Log your first energy day
            </Link>
          </Button>
        </EmptyState>
      );
    }
    return (
      <>
        {activeCount >= 2 || restingCount >= 2 ? (
          <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <CardHeader className="pb-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Trend
              </p>
              <CardTitle className="text-base font-medium">Energy over time</CardTitle>
            </CardHeader>
            <CardContent>
              <DailyEnergyChart points={chartPoints} />
            </CardContent>
          </Card>
        ) : null}

        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link to="/energy/$id" params={{ id: entry.id }} className="group block">
                <Card className="border-border/60 py-0 backdrop-blur transition-colors group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80">
                  <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium tabular-nums">
                        {formatDateLong(entry.energyOn)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatDailyEnergyValues(entry.activeKcal, entry.restingKcal)}
                      </p>
                      {entry.notes ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground/80">
                          {entry.notes}
                        </p>
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
        title="Energy"
        description="Log active and resting calories over time."
        actions={
          <Button asChild size="sm">
            <Link to="/energy/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New energy day</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
        }
      />

      {renderContent()}
    </PageShell>
  );
}

function EnergySkeleton() {
  return (
    <SkeletonState>
      <ul className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <Card className="border-border/60 py-0">
              <CardContent className="space-y-2 px-4 py-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </SkeletonState>
  );
}
