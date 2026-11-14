import { createFileRoute, Link } from "@tanstack/react-router";
import { ChartColumn } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { z } from "zod";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import {
  DEFAULT_PROGRESS_WEEKS,
  PROGRESS_PERIODS,
  type ProgressWeeks,
  progressWeeksParam,
  useMuscleSetProgress,
} from "@/components/progress/progress-queries";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { metricFormat } from "@/lib/metric-format";
import {
  latestMuscleSets,
  type MuscleSets,
  muscleHistory,
  muscleSetBar,
} from "@/lib/muscle-set-progress";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  muscle: z.string().optional(),
  weeks: progressWeeksParam,
});

export const Route = createFileRoute("/_authed/progress/muscles")({
  validateSearch: searchSchema,
  component: MusclesRoute,
});

const setsLabel = (value: number) => `${metricFormat.sets(value)} sets`;

function MusclesRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const weeks = search.weeks ?? DEFAULT_PROGRESS_WEEKS;
  const { query } = useMuscleSetProgress(weeks);
  const rows = useMemo(() => query.data?.muscleSetProgress ?? [], [query.data]);
  const muscles = useMemo(() => latestMuscleSets(rows), [rows]);
  const selected = muscles.find((muscle) => muscle.group === search.muscle) ?? muscles[0] ?? null;
  const history = useMemo(
    () => (selected ? muscleHistory(rows, selected.group) : []),
    [rows, selected],
  );

  function setSearch(next: { muscle?: string; weeks?: ProgressWeeks }) {
    navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  }

  let content: ReactNode = null;
  if (!query.data) {
    content = query.error ? null : (
      <SkeletonState className="flex flex-wrap items-start gap-5">
        <Skeleton className="h-96 min-w-0 flex-[1_1_420px] rounded-xl" />
        <Skeleton className="h-96 min-w-0 flex-[999_1_520px] rounded-xl" />
      </SkeletonState>
    );
  } else if (selected) {
    content = (
      <div className="flex flex-wrap items-start gap-5">
        <MuscleSetList
          muscles={muscles}
          selected={selected.group}
          onSelect={(muscle) => setSearch({ muscle })}
        />
        <MuscleHistory
          muscle={selected}
          history={history}
          weeks={weeks}
          isUpdating={query.isPlaceholderData}
          onPeriodChange={(value) => setSearch({ weeks: value })}
        />
      </div>
    );
  } else {
    content = (
      <EmptyState
        icon={ChartColumn}
        title="No strength sets in this period"
        description="Log a strength set with reps to see weighted sets by muscle here. Stretching doesn't count."
        actions={
          <>
            <Button asChild>
              <Link to="/train/workouts">Browse workouts</Link>
            </Button>
            {weeks < 52 ? (
              <Button variant="outline" onClick={() => setSearch({ weeks: 52 })}>
                Show the last year
              </Button>
            ) : null}
          </>
        }
      />
    );
  }

  return (
    <PageShell maxWidth="6xl" contentClassName="space-y-5">
      <PageHeader title="Progress" tabs={<AreaTabs area="progress" />} />
      <p className="max-w-[760px] text-[13px] leading-[1.55] text-muted-foreground">
        Weighted sets per muscle over a rolling seven days: each logged strength set with reps
        counts 1 for its primary muscle and ½ for each secondary muscle. Stretching is excluded.
      </p>
      {query.error ? (
        <ErrorState
          title="Couldn't load muscle sets"
          message={query.error.message}
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : null}
      {content}
    </PageShell>
  );
}

function SetsBar({ muscle, max }: { muscle: MuscleSets; max: number }) {
  const { direct, halfIndirect } = muscleSetBar(muscle, max);
  return (
    <span aria-hidden="true" className="flex h-3.5 min-w-0 gap-px overflow-hidden">
      {direct > 0 ? (
        <span
          className={cn("bg-primary", halfIndirect > 0 ? "rounded-l-[3px]" : "rounded-[3px]")}
          style={{ width: `${direct * 100}%` }}
        />
      ) : null}
      {halfIndirect > 0 ? (
        <span
          className={cn("bg-muscle-secondary", direct > 0 ? "rounded-r-[3px]" : "rounded-[3px]")}
          style={{ width: `${halfIndirect * 100}%` }}
        />
      ) : null}
    </span>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-2.5 rounded-[2px]", className)} />
      {label}
    </span>
  );
}

function MuscleSetList({
  muscles,
  selected,
  onSelect,
}: {
  muscles: MuscleSets[];
  selected: string;
  onSelect: (muscle: string) => void;
}) {
  const max = muscles[0]?.weighted ?? 0;
  return (
    <section
      aria-label="Weighted sets by muscle"
      className="flex min-w-0 flex-[1_1_420px] flex-col gap-0.5 rounded-xl border bg-card px-2 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-1 pb-2.5">
        <h2 className="text-[15px] font-semibold">Trailing 7 days</h2>
        <span className="flex gap-3 text-[13px] text-muted-foreground">
          <LegendSwatch className="bg-primary" label="Direct" />
          <LegendSwatch className="bg-muscle-secondary" label="½ secondary" />
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {muscles.map((muscle) => {
          const active = muscle.group === selected;
          return (
            <li key={muscle.group}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(muscle.group)}
                aria-label={`${muscle.name}: ${metricFormat.sets(muscle.weighted)} weighted sets, ${muscle.direct} direct and ${muscle.indirect} secondary`}
                className={cn(
                  "grid min-h-11 w-full grid-cols-[110px_minmax(0,1fr)_40px] items-center gap-3 rounded-lg px-4 text-left transition-colors hover:bg-surface-inset md:min-h-[38px] md:grid-cols-[150px_minmax(0,1fr)_48px]",
                  active &&
                    "bg-accent-soft/60 ring-1 ring-primary/40 ring-inset hover:bg-accent-soft/60",
                )}
              >
                <span className="truncate text-sm">{muscle.name}</span>
                <SetsBar muscle={muscle} max={max} />
                <span className="text-right text-sm font-semibold tabular-nums">
                  {metricFormat.sets(muscle.weighted)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MuscleHistory({
  muscle,
  history,
  weeks,
  isUpdating,
  onPeriodChange,
}: {
  muscle: MuscleSets;
  history: { date: string; value: number }[];
  weeks: ProgressWeeks;
  isUpdating: boolean;
  onPeriodChange: (weeks: ProgressWeeks) => void;
}) {
  return (
    <section
      aria-labelledby="muscle-history-title"
      aria-busy={isUpdating}
      className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="muscle-history-title" className="text-[17px] font-semibold">
          {muscle.name}
        </h2>
        <Segmented
          label="History period"
          options={PROGRESS_PERIODS}
          value={weeks}
          onChange={onPeriodChange}
        />
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <dt className="text-[13px] text-muted-foreground">Weighted, 7 days</dt>
          <dd className="text-2xl leading-tight font-bold tabular-nums sm:text-[28px]">
            {setsLabel(muscle.weighted)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[13px] text-muted-foreground">Logged sets</dt>
          <dd className="text-2xl leading-tight font-bold tabular-nums sm:text-[28px]">
            {muscle.direct} direct · {muscle.indirect} secondary
          </dd>
        </div>
      </dl>
      <TrendChart
        title={`${muscle.name} trailing seven-day weighted sets`}
        height={240}
        legend={false}
        axes={{ left: { includeZero: true } }}
        series={[
          {
            id: "weighted",
            name: "Weighted sets",
            color: "chart-1",
            style: "line",
            points: history,
            format: setsLabel,
          },
        ]}
      />
      <p className="text-[13px] text-muted-foreground">Pick a muscle to chart it.</p>
    </section>
  );
}
