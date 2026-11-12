import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { Sparkline } from "@/components/patterns/metrics";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import type { WebStrengthProgressQuery } from "@/gql/graphql";
import { describeTrend } from "@/lib/chart-trend";
import { localTimeZone } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import { addLocalDateDays } from "@/lib/nutrition";
import { useLocalToday } from "@/lib/use-local-today";
import { cn } from "@/lib/utils";

const StrengthProgressQuery = graphql(`
  query WebStrengthProgress($from: date!, $through: date!, $timeZone: String!) {
    strengthProgress(args: { from_day: $from, through_day: $through, time_zone: $timeZone }) {
      sessionId
      exerciseId
      startedAt
      volume
      estimatedOneRepMax
      exercise {
        id
        name
      }
    }
  }
`);

const PERIODS = [
  { value: 12, label: "12 w" },
  { value: 26, label: "6 m" },
  { value: 52, label: "1 y" },
] as const;
type PeriodWeeks = (typeof PERIODS)[number]["value"];

const searchSchema = z.object({
  weeks: z.union([z.literal(12), z.literal(26), z.literal(52)]).optional(),
});

export const Route = createFileRoute("/_authed/progress/strength")({
  validateSearch: searchSchema,
  component: StrengthRoute,
});

type Row = WebStrengthProgressQuery["strengthProgress"][number];

const RECENT_DAYS = 10;
const kgFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function compactKg(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : kgFormat.format(value);
}

function buildWeeks(rows: Row[], weeks: number, now: Date) {
  const current = startOfWeek(now);
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(current);
    start.setDate(start.getDate() - (weeks - 1 - index) * 7);
    return { start, volume: 0 };
  });
  for (const row of rows) {
    const week = startOfWeek(new Date(row.startedAt)).getTime();
    const bucket = buckets.find((candidate) => candidate.start.getTime() === week);
    if (bucket) {
      bucket.volume += Number(row.volume ?? 0);
    }
  }
  return buckets;
}

function buildRecentExercises(rows: Row[], now: Date) {
  const recentStart = new Date(now);
  recentStart.setHours(0, 0, 0, 0);
  recentStart.setDate(recentStart.getDate() - (RECENT_DAYS - 1));
  const byExercise = new Map<string, { id: string; name: string; points: Row[] }>();
  for (const row of rows) {
    const entry = byExercise.get(row.exerciseId) ?? {
      id: row.exerciseId,
      name: row.exercise?.name ?? "Exercise",
      points: [] as Row[],
    };
    entry.points.push(row);
    byExercise.set(row.exerciseId, entry);
  }
  return [...byExercise.values()]
    .filter((entry) => entry.points.some((point) => new Date(point.startedAt) >= recentStart))
    .map((entry) => ({
      ...entry,
      points: entry.points.toSorted((a, b) => a.startedAt.localeCompare(b.startedAt)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function StrengthRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const today = useLocalToday();
  const { user } = useAuth();
  const weeks: PeriodWeeks = search.weeks ?? 12;
  const query = useQuery({
    queryKey: ["progress", "strength", today, weeks, user?.id],
    queryFn: () =>
      gqlRequest(StrengthProgressQuery, {
        from: addLocalDateDays(today, -(weeks * 7 - 1)),
        through: today,
        timeZone: localTimeZone(),
      }),
    enabled: !!user,
  });

  const rows = useMemo(() => query.data?.strengthProgress ?? [], [query.data]);
  const now = useMemo(() => new Date(), []);
  const weekly = useMemo(() => buildWeeks(rows, weeks, now), [rows, weeks, now]);
  const recent = useMemo(() => buildRecentExercises(rows, now), [rows, now]);

  return (
    <PageShell maxWidth="6xl">
      <PageHeader title="Progress" tabs={<AreaTabs area="progress" />} />
      <p className="max-w-3xl text-sm text-muted-foreground">
        Weekly strength volume (weight × reps, both sides for per-side lifts), plus estimated
        one-rep max for exercises logged in the last {RECENT_DAYS} days.
      </p>
      {query.error ? (
        <ErrorState title="Couldn't load strength progress" message={query.error.message} />
      ) : null}
      {query.isLoading ? <Skeleton className="h-72 w-full rounded-xl" /> : null}
      {query.data && rows.length === 0 ? (
        <EmptyState
          title="No strength sessions in this period"
          description="Log strength sets to see weekly volume and estimated maxes here."
        >
          <Button asChild>
            <Link to="/train/workouts">Start a session</Link>
          </Button>
        </EmptyState>
      ) : null}
      {rows.length > 0 ? (
        <>
          <WeeklyVolume
            weeks={weekly}
            period={weeks}
            onPeriodChange={(value) =>
              navigate({ search: (prev) => ({ ...prev, weeks: value }), replace: true })
            }
          />
          <section aria-labelledby="recent-lifts" className="flex flex-col gap-3">
            <h2 id="recent-lifts" className="text-base font-semibold">
              Logged in the last {RECENT_DAYS} days
            </h2>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged in the last ten days.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {recent.map((exercise) => (
                  <RecentLift key={exercise.id} exercise={exercise} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}

function WeeklyVolume({
  weeks,
  period,
  onPeriodChange,
}: {
  weeks: { start: Date; volume: number }[];
  period: PeriodWeeks;
  onPeriodChange: (value: PeriodWeeks) => void;
}) {
  const max = Math.max(...weeks.map((week) => week.volume), 1);
  const complete = weeks.slice(0, -1);
  const best = complete.reduce(
    (top, week) => (week.volume > (top?.volume ?? 0) ? week : top),
    complete[0],
  );
  const label = (date: Date) =>
    date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <section
      aria-label="Weekly volume"
      className="flex flex-col gap-4 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold">Weekly volume</h2>
          {best && best.volume > 0 ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              <strong className="text-2xl font-semibold text-foreground">
                {compactKg(best.volume)}
              </strong>{" "}
              kg · best week, {label(best.start)}
            </p>
          ) : null}
        </div>
        <Segmented label="Period" options={PERIODS} value={period} onChange={onPeriodChange} />
      </div>
      <ol
        className="flex h-40 items-end gap-1 sm:gap-1.5"
        aria-label={`Weekly volume: ${weeks
          .map((week) => `week of ${label(week.start)} ${compactKg(week.volume)} kilograms`)
          .join(", ")}`}
      >
        {weeks.map((week, index) => {
          const isCurrent = index === weeks.length - 1;
          return (
            <li
              key={week.start.toISOString()}
              title={`Week of ${label(week.start)}: ${kgFormat.format(week.volume)} kg${isCurrent ? " (so far)" : ""}`}
              className={cn(
                "min-h-1 flex-1 rounded-t-md",
                week === best ? "bg-primary" : "bg-primary/45",
                isCurrent && "bg-primary/25",
              )}
              style={{ height: `${Math.max(1, (week.volume / max) * 100)}%` }}
            />
          );
        })}
      </ol>
      <div className="flex justify-between text-[12px] text-muted-foreground tabular-nums">
        <span>{weeks[0] ? label(weeks[0].start) : ""}</span>
        <span>This week (so far)</span>
      </div>
    </section>
  );
}

function RecentLift({ exercise }: { exercise: { id: string; name: string; points: Row[] } }) {
  const maxes = exercise.points
    .map((point) => (point.estimatedOneRepMax === null ? null : Number(point.estimatedOneRepMax)))
    .filter((value): value is number => value !== null && value > 0);
  const volumes = exercise.points.map((point) => Number(point.volume ?? 0));
  const useMax = maxes.length > 0;
  const series = useMax ? maxes : volumes;
  const latest = series.at(-1) ?? 0;
  const best = Math.max(...series, 0);
  return (
    <li>
      <Link
        to="/train/exercises/$exerciseId"
        params={{ exerciseId: exercise.id }}
        className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="truncate text-sm font-semibold">{exercise.name}</strong>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {useMax ? "e1RM" : "Volume"} {kgFormat.format(latest)} kg · best {kgFormat.format(best)}
          </span>
        </span>
        <Sparkline
          values={series}
          label={describeTrend(
            series.map((value) => ({ value })),
            {
              label: `${exercise.name} ${useMax ? "estimated one-rep max" : "volume"}`,
              unit: "kg",
            },
          )}
          className="h-10 w-24 shrink-0"
        />
      </Link>
    </li>
  );
}
