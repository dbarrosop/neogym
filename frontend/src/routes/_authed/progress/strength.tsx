import { createFileRoute, Link } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { z } from "zod";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import { ExerciseStrengthCard } from "@/components/progress/exercise-strength-card";
import {
  DEFAULT_PROGRESS_WEEKS,
  PROGRESS_PERIODS,
  type ProgressWeeks,
  progressWeeksParam,
  useStrengthProgress,
} from "@/components/progress/progress-queries";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatChartDate, metricFormat } from "@/lib/metric-format";
import {
  buildWeeklyStrength,
  type ExerciseStrengthTrend,
  RECENT_EXERCISE_DAYS,
  recentExerciseTrends,
  type WeeklyStrength,
  weeklyVolumeLabel,
} from "@/lib/strength-progress";

const searchSchema = z.object({
  weeks: progressWeeksParam,
});

export const Route = createFileRoute("/_authed/progress/strength")({
  validateSearch: searchSchema,
  component: StrengthRoute,
});

function StrengthRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const weeks = search.weeks ?? DEFAULT_PROGRESS_WEEKS;
  const { query, today } = useStrengthProgress(weeks);
  const rows = useMemo(() => query.data?.strengthProgress ?? [], [query.data]);
  const weekly = useMemo(() => buildWeeklyStrength(rows, { today }), [rows, today]);
  const recent = useMemo(() => recentExerciseTrends(rows, { today }), [rows, today]);

  function setWeeks(value: ProgressWeeks) {
    navigate({ search: (prev) => ({ ...prev, weeks: value }), replace: true });
  }

  let content: ReactNode = null;
  if (!query.data) {
    content = query.error ? null : (
      <SkeletonState className="flex flex-col gap-5">
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(460px,100%),1fr))] gap-3">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </SkeletonState>
    );
  } else if (weekly.weeks.length === 0) {
    content = (
      <EmptyState
        icon={Dumbbell}
        title="No strength sets in this period"
        description="Log strength sets to see weekly volume and estimated one-rep max here."
        actions={
          <>
            <Button asChild>
              <Link to="/train/workouts">Browse workouts</Link>
            </Button>
            {weeks < 52 ? (
              <Button variant="outline" onClick={() => setWeeks(52)}>
                Show the last year
              </Button>
            ) : null}
          </>
        }
      />
    );
  } else {
    content = (
      <>
        <WeeklyVolumeCard
          weekly={weekly}
          weeks={weeks}
          isUpdating={query.isPlaceholderData}
          onPeriodChange={setWeeks}
        />
        <RecentExercises trends={recent} />
      </>
    );
  }

  return (
    <PageShell maxWidth="6xl" contentClassName="space-y-5">
      <PageHeader title="Progress" tabs={<AreaTabs area="progress" />} />
      <p className="max-w-[760px] text-sm leading-normal text-muted-foreground">
        Weekly strength volume (weight × reps, both sides for per-side lifts), plus estimated
        one-rep max for exercises logged in the last {RECENT_EXERCISE_DAYS} days.
      </p>
      {query.error ? (
        <ErrorState
          title="Couldn't load strength progress"
          message={query.error.message}
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : null}
      {content}
    </PageShell>
  );
}

function WeeklyVolumeCard({
  weekly,
  weeks,
  isUpdating,
  onPeriodChange,
}: {
  weekly: WeeklyStrength;
  weeks: ProgressWeeks;
  isUpdating: boolean;
  onPeriodChange: (weeks: ProgressWeeks) => void;
}) {
  const best = weekly.bestWeek;
  return (
    <section
      aria-labelledby="weekly-volume"
      aria-busy={isUpdating}
      className="flex flex-col gap-3.5 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="weekly-volume" className="text-[15px] font-semibold">
            Weekly volume
          </h2>
          {best && best.volume > 0 ? (
            <p className="tabular-nums">
              <strong className="text-2xl font-bold">
                {metricFormat.weeklyVolume(best.volume)}
              </strong>{" "}
              <span className="text-[13px] text-muted-foreground">
                kg · best week, {formatChartDate(best.weekStart)}
              </span>
            </p>
          ) : null}
        </div>
        <Segmented
          label="Period"
          options={PROGRESS_PERIODS}
          value={weeks}
          onChange={onPeriodChange}
        />
      </div>
      <TrendChart
        title="Weekly strength volume"
        period="week"
        height={220}
        legend={false}
        series={[
          {
            id: "volume",
            name: "Volume",
            color: "chart-1",
            points: weekly.points,
            format: weeklyVolumeLabel,
          },
        ]}
      />
    </section>
  );
}

function RecentExercises({ trends }: { trends: ExerciseStrengthTrend[] }) {
  return (
    <section aria-labelledby="recent-lifts" className="flex flex-col gap-3">
      <h2 id="recent-lifts" className="mt-1 text-[17px] font-semibold">
        Logged in the last {RECENT_EXERCISE_DAYS} days
      </h2>
      {trends.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing logged in the last {RECENT_EXERCISE_DAYS} days.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(460px,100%),1fr))] gap-3">
          {trends.map((trend) => (
            <li key={trend.id} className="min-w-0">
              <ExerciseStrengthCard trend={trend} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
