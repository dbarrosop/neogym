import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { localTimeZone } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import { addLocalDateDays, localDateToDate } from "@/lib/nutrition";
import { useLocalToday } from "@/lib/use-local-today";
import { cn } from "@/lib/utils";

const MuscleSetProgressQuery = graphql(`
  query WebMuscleSetProgress($from: date!, $through: date!, $timeZone: String!) {
    muscleSetProgress(args: { from_day: $from, through_day: $through, time_zone: $timeZone }) {
      day
      muscleGroup
      rollingDirectSets
      rollingIndirectSets
      rollingWeightedSets
    }
  }
`);

const PERIODS = [
  { value: 30, label: "30 d" },
  { value: 60, label: "60 d" },
  { value: 180, label: "180 d" },
] as const;
type PeriodDays = (typeof PERIODS)[number]["value"];

const searchSchema = z.object({
  muscle: z.string().optional(),
  days: z.union([z.literal(30), z.literal(60), z.literal(180)]).optional(),
});

export const Route = createFileRoute("/_authed/progress/muscles")({
  validateSearch: searchSchema,
  component: MusclesRoute,
});

/** Weekly direct-set volume often used as a reference for hypertrophy work. */
const REFERENCE_SETS = 10;

const UNDERSCORES = /_/g;
const FIRST_LETTER = /^\w/;

function muscleName(group: string): string {
  if (group === "shoulders") {
    return "Shoulders (unspecified)";
  }
  return group.replace(UNDERSCORES, " ").replace(FIRST_LETTER, (c) => c.toUpperCase());
}

const setsFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function MusclesRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const today = useLocalToday();
  const { user } = useAuth();
  const days: PeriodDays = search.days ?? 60;
  const query = useQuery({
    queryKey: ["progress", "muscles", today, days, user?.id],
    queryFn: () =>
      gqlRequest(MuscleSetProgressQuery, {
        from: addLocalDateDays(today, -(days - 1)),
        through: today,
        timeZone: localTimeZone(),
      }),
    enabled: !!user,
  });

  const rows = query.data?.muscleSetProgress ?? [];
  const latest = useMemo(() => {
    let lastDay = "";
    for (const row of rows) {
      if (row.day > lastDay) {
        lastDay = row.day;
      }
    }
    return rows
      .filter((row) => row.day === lastDay && Number(row.rollingWeightedSets) > 0)
      .map((row) => ({
        group: row.muscleGroup,
        direct: row.rollingDirectSets,
        indirect: row.rollingIndirectSets,
        weighted: Number(row.rollingWeightedSets),
      }))
      .sort((a, b) => b.weighted - a.weighted || a.group.localeCompare(b.group));
  }, [rows]);
  const selected = latest.find((row) => row.group === search.muscle) ?? latest[0] ?? null;
  const history = useMemo(
    () =>
      rows
        .filter((row) => row.muscleGroup === selected?.group)
        .map((row) => ({
          date: localDateToDate(row.day)?.getTime() ?? 0,
          sets: Number(row.rollingWeightedSets),
        }))
        .sort((a, b) => a.date - b.date),
    [rows, selected?.group],
  );

  function setSearch(next: { muscle?: string; days?: PeriodDays }) {
    navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
  }

  return (
    <PageShell maxWidth="6xl">
      <PageHeader title="Progress" tabs={<AreaTabs area="progress" />} />
      <p className="max-w-3xl text-sm text-muted-foreground">
        Weighted sets per muscle over a rolling seven days: each logged strength set with reps
        counts 1 for its primary muscle and ½ for each secondary muscle. Stretching is excluded.
      </p>
      {query.error ? (
        <ErrorState title="Couldn't load muscle sets" message={query.error.message} />
      ) : null}
      {query.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : null}
      {query.data && latest.length === 0 ? (
        <EmptyState
          title="No strength sets in the last seven days"
          description="Log a strength set with reps to see sets by muscle here."
        >
          <Button asChild>
            <Link to="/train/workouts">Start a session</Link>
          </Button>
        </EmptyState>
      ) : null}
      {selected ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <MuscleBars
            rows={latest}
            selected={selected.group}
            onSelect={(muscle) => setSearch({ muscle })}
          />
          <section
            aria-label={`${muscleName(selected.group)} history`}
            className="order-first flex flex-col gap-4 rounded-xl border bg-card p-5 lg:order-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{muscleName(selected.group)}</h2>
              <Segmented
                label="History period"
                options={PERIODS}
                value={days}
                onChange={(value) => setSearch({ days: value })}
              />
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5 rounded-lg bg-surface-inset p-3">
                <dt className="text-[13px] text-muted-foreground">Weighted, 7 days</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {setsFormat.format(selected.weighted)} sets
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg bg-surface-inset p-3">
                <dt className="text-[13px] text-muted-foreground">Logged sets</dt>
                <dd className="text-base font-semibold tabular-nums sm:text-xl">
                  {selected.direct} direct · {selected.indirect} secondary
                </dd>
              </div>
            </dl>
            <MuscleHistoryChart points={history} name={muscleName(selected.group)} />
            <p className="text-[13px] text-muted-foreground">
              Dashed line: {REFERENCE_SETS} sets for reference. Pick a muscle to chart it.
            </p>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}

function MuscleBars({
  rows,
  selected,
  onSelect,
}: {
  rows: { group: string; direct: number; indirect: number; weighted: number }[];
  selected: string;
  onSelect: (muscle: string) => void;
}) {
  const max = Math.max(...rows.map((row) => row.weighted), REFERENCE_SETS);
  return (
    <section aria-label="Weighted sets by muscle" className="rounded-xl border bg-card p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2.5 pb-2">
        <h2 className="text-sm font-semibold">Trailing 7 days</h2>
        <span className="flex gap-3 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-sm bg-primary" />
            Direct
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-sm bg-primary/40" />½ secondary
          </span>
        </span>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const active = row.group === selected;
          return (
            <li key={row.group}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(row.group)}
                aria-label={`${muscleName(row.group)}: ${setsFormat.format(row.weighted)} weighted sets, ${row.direct} direct and ${row.indirect} secondary`}
                className={cn(
                  "grid min-h-10 w-full grid-cols-[8.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-muted/60",
                  active && "bg-accent-soft/60 font-semibold hover:bg-accent-soft/60",
                )}
              >
                <span className="truncate">{muscleName(row.group)}</span>
                <span aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-muted">
                  <span className="bg-primary" style={{ width: `${(row.direct / max) * 100}%` }} />
                  <span
                    className="bg-primary/40"
                    style={{ width: `${(row.indirect / 2 / max) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{setsFormat.format(row.weighted)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MuscleHistoryChart({
  points,
  name,
}: {
  points: { date: number; sets: number }[];
  name: string;
}) {
  if (points.length < 2) {
    return (
      <p className="rounded-lg bg-surface-inset px-3 py-8 text-center text-sm text-muted-foreground">
        Not enough history in this period yet.
      </p>
    );
  }
  const formatTick = (value: number) =>
    new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <div className="h-60 w-full" role="img" aria-label={`${name} weighted sets per rolling week`}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTick}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={36}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(max, REFERENCE_SETS + 2)]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <ReferenceLine
            y={REFERENCE_SETS}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            content={<SetsTooltip />}
          />
          <Line
            type="monotone"
            dataKey="sets"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SetsTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const point = payload?.[0]?.payload as { date: number; sets: number } | undefined;
  if (!active || !point) {
    return null;
  }
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">
        {new Date(point.date).toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
      </p>
      <p className="font-semibold tabular-nums">{setsFormat.format(point.sets)} sets</p>
    </div>
  );
}
