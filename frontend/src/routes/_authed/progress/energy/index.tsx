import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DailyEnergyChart, type DailyEnergyPoint } from "@/components/daily-energy-chart";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { QuickDailyEnergyForm } from "@/components/progress/quick-entry-forms";
import { AreaTabs } from "@/components/shell/area-tabs";
import { TodayEnergyEstimate } from "@/components/today-energy-estimate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { formatDateShort, parseDateOnly } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";

const DAILY_ENERGY_PAGE_SIZE = 50;

const DailyEnergyQuery = graphql(`
  query DailyEnergy($limit: Int!, $offset: Int!) {
    dailyEnergyEntries(order_by: { energyOn: desc }, limit: $limit, offset: $offset) {
      id
      energyOn
      activeKcal
      restingKcal
      notes
    }
  }
`);

export const Route = createFileRoute("/_authed/progress/energy/")({
  component: DailyEnergyRoute,
});

function DailyEnergyRoute() {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ["daily_energy"],
      initialPageParam: 0,
      queryFn: ({ pageParam }) =>
        gqlRequest(DailyEnergyQuery, { limit: DAILY_ENERGY_PAGE_SIZE, offset: pageParam }),
      getNextPageParam: (lastPage, allPages) =>
        lastPage.dailyEnergyEntries.length === DAILY_ENERGY_PAGE_SIZE
          ? allPages.length * DAILY_ENERGY_PAGE_SIZE
          : undefined,
    });

  const entries = useMemo(
    () => data?.pages.flatMap((page) => page.dailyEnergyEntries) ?? [],
    [data],
  );

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

  const [limit, setLimit] = useState(20);
  const stats = useMemo(() => {
    const recent = entries.slice(0, 7);
    const avg = (pick: (e: (typeof entries)[number]) => unknown) => {
      const values = recent
        .map(pick)
        .filter((v) => v !== null && v !== undefined)
        .map(Number);
      return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
    };
    return {
      active: avg((e) => e.activeKcal),
      resting: avg((e) => e.restingKcal),
      days: recent.length,
    };
  }, [entries]);

  function renderContent() {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </div>
      );
    }
    if (error) {
      return <ErrorState title="Couldn't load energy days" message={error.message} />;
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          title="No energy days yet"
          description="Log active and resting kilocalories to see what you burn."
        />
      );
    }
    const kcal = (value: number | null) =>
      value === null ? "—" : `${Math.round(value).toLocaleString()} kcal`;
    return (
      <div className="flex flex-col gap-5">
        <section
          aria-label="Energy trend"
          className="flex flex-col gap-4 rounded-xl border bg-card p-5"
        >
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted-foreground">
                Burned · avg of last {stats.days} logged days
              </dt>
              <dd className="text-[28px] leading-tight font-semibold tabular-nums">
                {kcal(
                  stats.active === null && stats.resting === null
                    ? null
                    : (stats.active ?? 0) + (stats.resting ?? 0),
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted-foreground">Resting</dt>
              <dd className="text-lg font-semibold tabular-nums">{kcal(stats.resting)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted-foreground">Active</dt>
              <dd className="text-lg font-semibold tabular-nums">{kcal(stats.active)}</dd>
            </div>
          </dl>
          {activeCount >= 2 || restingCount >= 2 ? (
            <DailyEnergyChart points={chartPoints} />
          ) : (
            <p className="rounded-lg bg-surface-inset px-3 py-8 text-center text-sm text-muted-foreground">
              Log a few more days to draw a trend.
            </p>
          )}
        </section>

        <section aria-label="Energy days" className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-right text-[12px] text-muted-foreground">
                <th scope="col" className="py-2.5 pl-4 text-left font-medium">
                  Date
                </th>
                <th scope="col" className="font-medium">
                  Resting
                </th>
                <th scope="col" className="font-medium">
                  Active
                </th>
                <th scope="col" className="pr-4 font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, limit).map((entry) => {
                const resting =
                  entry.restingKcal === null || entry.restingKcal === undefined
                    ? null
                    : Number(entry.restingKcal);
                const active =
                  entry.activeKcal === null || entry.activeKcal === undefined
                    ? null
                    : Number(entry.activeKcal);
                return (
                  <tr key={entry.id} className="border-t text-right hover:bg-muted/40">
                    <td className="py-2.5 pl-4 text-left">
                      <Link
                        to="/progress/energy/$id"
                        params={{ id: entry.id }}
                        className="font-medium hover:text-link"
                        title={entry.notes ?? undefined}
                      >
                        {formatDateShort(entry.energyOn)}
                      </Link>
                    </td>
                    <td>{resting === null ? "—" : Math.round(resting).toLocaleString()}</td>
                    <td>{active === null ? "—" : Math.round(active).toLocaleString()}</td>
                    <td className="pr-4 font-semibold">
                      {resting === null && active === null
                        ? "—"
                        : Math.round((resting ?? 0) + (active ?? 0)).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasNextPage || entries.length > limit ? (
            <div className="border-t px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLimit((value) => value + 40);
                  if (entries.length <= limit + 40 && hasNextPage) {
                    fetchNextPage();
                  }
                }}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading…" : "Show more"}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        title="Progress"
        tabs={<AreaTabs area="progress" />}
        actions={
          <Button asChild className="lg:hidden">
            <Link to="/progress/energy/new">
              <Plus />
              Log energy
            </Link>
          </Button>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {renderContent()}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <TodayEnergyEstimate />
          <div className="hidden lg:block">
            <QuickDailyEnergyForm />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
