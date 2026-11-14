import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Plus } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { z } from "zod";
import { CaloriesCard } from "@/components/calories-card";
import { EnergyTrendSummary } from "@/components/daily-energy-chart";
import { HealthSourceTag, isHealthImport, visibleNotes } from "@/components/health-source-tag";
import { ListFooter } from "@/components/patterns/list-footer";
import { ActionLabel, PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import { QuickDailyEnergyForm } from "@/components/progress/quick-entry-forms";
import { AreaTabs } from "@/components/shell/area-tabs";
import { TodayEnergyEstimate } from "@/components/today-energy-estimate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateShort } from "@/lib/dates";
import { buildEnergyTrend } from "@/lib/energy-trend";
import { useDailyEnergyList, useDailyEnergyRange } from "@/lib/hooks/use-daily-energy";
import { formatKcalNumber } from "@/lib/metric-format";
import {
  ENTRY_HISTORY_PAGE_SIZE,
  entryHistoryWindow,
  needsEntryHistoryPage,
  nextEntryHistoryLimit,
} from "@/lib/progress-entries";
import { chartWindow, numericOrNull } from "@/lib/rolling-average";
import { useLocalToday } from "@/lib/use-local-today";

const PERIODS = [
  { value: 30, label: "30 d" },
  { value: 90, label: "90 d" },
  { value: 365, label: "1 y" },
] as const;
type PeriodDays = (typeof PERIODS)[number]["value"];
const period = z.union([z.literal(30), z.literal(90), z.literal(365)]).optional();

const searchSchema = z.object({ days: period, calories: period });

export const Route = createFileRoute("/_authed/progress/energy/")({
  validateSearch: searchSchema,
  component: DailyEnergyRoute,
});

// The side column (estimate and "Log energy") sits beside the content once
// the page has room for both (560 + 20 + 280 px, as on the board); below that
// it follows the content and the header carries the Log action instead.
const SIDE_BY_SIDE = "@min-[860px]:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]";
// Wrapped below the content, the column keeps its board width (340 px) unless
// the page is phone-narrow.
const SIDE_COLUMN = "min-w-0 @min-[560px]:max-w-[340px] @min-[860px]:max-w-none";

function DailyEnergyRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const list = useDailyEnergyList();
  const periodControl = (key: "days" | "calories", label: string) => (
    <Segmented
      label={label}
      options={PERIODS}
      value={search[key] ?? 30}
      onChange={(value: PeriodDays) =>
        navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true })
      }
    />
  );

  const calories = (
    <CaloriesCard
      days={search.calories ?? 30}
      periodControl={periodControl("calories", "Calories period")}
    />
  );

  // Board order: energy trend, Calories, then the day list.
  function renderMain() {
    if (list.isPending) {
      return (
        <SkeletonState className="flex flex-col gap-5">
          <Skeleton className="h-[380px] w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </SkeletonState>
      );
    }
    if (list.error) {
      return (
        <>
          <ErrorState
            title="Couldn't load energy days"
            message={list.error.message}
            onRetry={() => list.refetch()}
            isRetrying={list.isFetching}
          />
          {calories}
        </>
      );
    }
    const rows = list.data.pages.flatMap((page) => page.dailyEnergyEntries);
    const total = list.data.pages.at(-1)?.dailyEnergyEntriesAggregate.aggregate?.count ?? 0;
    if (Math.max(total, rows.length) === 0) {
      return (
        <>
          <EmptyState
            icon={Flame}
            title="No energy days yet"
            description="Log active and resting kilocalories to see what you burn. The NeoGym Apple Watch app imports them from Apple Health."
          />
          {calories}
        </>
      );
    }
    return (
      <>
        <EnergyTrendCard days={search.days ?? 30} periodControl={periodControl("days", "Period")} />
        {calories}
        <EnergyHistory
          rows={rows}
          total={total}
          hasMoreRemote={list.hasNextPage}
          isFetchingMore={list.isFetchingNextPage}
          fetchMore={() => list.fetchNextPage()}
        />
      </>
    );
  }

  return (
    <PageShell maxWidth="6xl" contentClassName="@container">
      <PageHeader
        title="Progress"
        tabs={<AreaTabs area="progress" />}
        actions={
          <Button asChild className="@min-[860px]:hidden">
            <Link to="/progress/energy/new">
              <Plus />
              <ActionLabel>Log energy</ActionLabel>
            </Link>
          </Button>
        }
      />
      <div className={`grid items-start gap-5 ${SIDE_BY_SIDE}`}>
        <div className="flex min-w-0 flex-col gap-5">{renderMain()}</div>
        <div className={`flex flex-col gap-4 ${SIDE_COLUMN}`}>
          <TodayEnergyEstimate variant="energy" />
          <QuickDailyEnergyForm />
        </div>
      </div>
    </PageShell>
  );
}

function EnergyTrendCard({ days, periodControl }: { days: number; periodControl: ReactNode }) {
  const today = useLocalToday();
  const range = chartWindow(days, today);
  const query = useDailyEnergyRange(range.start, range.end);
  const trend = useMemo(
    () =>
      query.data
        ? buildEnergyTrend(query.data.dailyEnergyEntries, {
            today,
            start: range.start,
            end: range.end,
          })
        : null,
    [query.data, today, range.start, range.end],
  );
  let body: ReactNode;
  if (trend) {
    body = <EnergyTrendSummary trend={trend} domain={range} periodControl={periodControl} />;
  } else {
    body = (
      <>
        <div className="flex justify-end">{periodControl}</div>
        {query.error ? (
          <ErrorState
            title="Couldn't load the energy trend"
            message={query.error.message}
            onRetry={() => query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : (
          <SkeletonState>
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </SkeletonState>
        )}
      </>
    );
  }
  return (
    <section
      aria-label="Energy trend"
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5"
    >
      {body}
    </section>
  );
}

type EnergyRow = {
  id: string;
  energyOn: string;
  activeKcal?: unknown;
  restingKcal?: unknown;
  notes?: string | null;
};

function kcalCell(value: number | null) {
  return value === null ? "—" : formatKcalNumber(value);
}

function EnergyHistory({
  rows,
  total,
  hasMoreRemote,
  isFetchingMore,
  fetchMore,
}: {
  rows: EnergyRow[];
  total: number;
  hasMoreRemote: boolean;
  isFetchingMore: boolean;
  fetchMore: () => void;
}) {
  const [limit, setLimit] = useState(ENTRY_HISTORY_PAGE_SIZE);
  const history = entryHistoryWindow(rows, limit, total);
  function loadMore() {
    const next = nextEntryHistoryLimit(limit);
    setLimit(next);
    if (needsEntryHistoryPage({ limit: next, loaded: rows.length, hasMoreRemote })) {
      fetchMore();
    }
  }
  return (
    <section aria-label="Energy days" className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-right text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 text-left font-semibold">
              Date
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Resting
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Active
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {history.visible.map((entry) => {
            const resting = numericOrNull(entry.restingKcal);
            const active = numericOrNull(entry.activeKcal);
            return (
              <tr
                key={entry.id}
                className="h-[46px] border-b text-right last:border-b-0 hover:bg-muted/40"
              >
                <td className="px-4 py-2 text-left">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      to="/progress/energy/$id"
                      params={{ id: entry.id }}
                      className="font-medium whitespace-nowrap hover:text-link"
                      title={visibleNotes(entry.notes) || undefined}
                    >
                      {formatDateShort(entry.energyOn)}
                    </Link>
                    {isHealthImport(entry.notes) ? <HealthSourceTag /> : null}
                  </span>
                </td>
                <td className="px-4">{kcalCell(resting)}</td>
                <td className="px-4">{kcalCell(active)}</td>
                <td className="px-4 font-semibold">
                  {resting === null && active === null
                    ? "—"
                    : formatKcalNumber((resting ?? 0) + (active ?? 0))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ListFooter
        shown={history.shown}
        total={history.total}
        noun="days"
        onLoadMore={loadMore}
        isLoading={isFetchingMore}
      />
    </section>
  );
}
