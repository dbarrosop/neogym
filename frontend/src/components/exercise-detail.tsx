import type { ResultOf } from "@graphql-typed-document-node/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, Play } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { AlternatingStorageImage } from "@/components/storage-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import {
  aggregationForFormat,
  asCardioMetricsSchema,
  type CardioMetricSpec,
  type CardioMetricsSchema,
  formatMetricValue,
  iterateMetrics,
} from "@/lib/cardio-schema";
import { gqlRequest } from "@/lib/graphql";
import { useStartSession } from "@/lib/hooks/use-start-session";
import { estimateOneRepMax } from "@/lib/strength-metrics";
import { cn } from "@/lib/utils";

const ExerciseDetailQuery = graphql(`
  query ExerciseDetail($id: uuid!) {
    exercise(id: $id) {
      id
      name
      instructions
      image1FileId
      image2FileId
      level
      category
      kind
      equipment
      primaryMuscleGroup
      strength {
        doubleWeight
        force
        mechanic
      }
      cardio {
        metricsSchema
      }
      secondaryMuscleGroups {
        muscleGroup
      }
      workoutSessionExercises {
        id
        workoutSession {
          id
          startedAt
          workout {
            id
            name
          }
        }
        workoutSessionStrengthSets(order_by: { setNumber: asc }) {
          id
          setNumber
          reps
          weight
        }
        workoutSessionCardioEntries(order_by: { entryNumber: asc }) {
          id
          entryNumber
          metrics
        }
      }
    }
  }
`);

export function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["exercises", "detail", exerciseId],
    queryFn: () => gqlRequest(ExerciseDetailQuery, { id: exerciseId }),
  });
  const startSession = useStartSession();

  const history = useMemo(() => {
    const wse = data?.exercise?.workoutSessionExercises ?? [];
    return [...wse].sort(
      (a, b) =>
        new Date(b.workoutSession.startedAt).getTime() -
        new Date(a.workoutSession.startedAt).getTime(),
    );
  }, [data]);

  const progressPoints = useMemo(
    () => buildProgressPoints(history, data?.exercise?.strength?.doubleWeight ?? false),
    [history, data?.exercise?.strength?.doubleWeight],
  );

  const cardioSchema = useMemo(
    () => asCardioMetricsSchema(data?.exercise?.cardio?.metricsSchema),
    [data?.exercise?.cardio?.metricsSchema],
  );

  const cardioPrimary = useMemo<CardioMetricSpec | null>(
    () => (cardioSchema ? (iterateMetrics(cardioSchema)[0] ?? null) : null),
    [cardioSchema],
  );

  const cardioPoints = useMemo(
    () => (cardioPrimary ? buildCardioProgressPoints(history, cardioPrimary) : []),
    [history, cardioPrimary],
  );

  function renderContent() {
    if (isLoading) {
      return <DetailSkeleton />;
    }
    if (error) {
      return <ErrorState title="Couldn't load this exercise" message={error.message} />;
    }
    if (!data?.exercise) {
      return (
        <EmptyState
          title="Exercise not found"
          description="It may have been deleted or is not shared with you."
        />
      );
    }
    const exercise = data.exercise;
    const isCardio = exercise.kind === "cardio" && cardioSchema && cardioPrimary;
    // Cardio exercise without a usable metrics schema: the progress/history
    // tabs would otherwise silently render the strength views (which select
    // workoutSessionStrengthSets — always empty for a cardio exercise). Show a
    // clear placeholder instead.
    const cardioSchemaMissing = exercise.kind === "cardio" && !isCardio;

    function renderProgressTab() {
      if (isCardio && cardioPrimary) {
        return <CardioProgress points={cardioPoints} primary={cardioPrimary} />;
      }
      if (cardioSchemaMissing) {
        return <CardioSchemaMissingNotice />;
      }
      return (
        <ExerciseProgress
          points={progressPoints}
          doubleWeight={exercise.strength?.doubleWeight ?? false}
        />
      );
    }

    function renderHistoryTab() {
      if (isCardio && cardioSchema) {
        return (
          <CardioHistory entries={history} schema={cardioSchema} exerciseName={exercise.name} />
        );
      }
      if (cardioSchemaMissing) {
        return <CardioSchemaMissingNotice />;
      }
      return (
        <ExerciseHistory
          entries={history}
          doubleWeight={exercise.strength?.doubleWeight ?? false}
          exerciseName={exercise.name}
        />
      );
    }

    const chips = [
      exercise.equipment,
      exercise.level,
      exercise.strength?.mechanic,
      exercise.strength?.force,
      exercise.kind === "cardio" ? "cardio" : null,
    ].filter((value): value is string => Boolean(value));

    return (
      <>
        <PageHeader
          eyebrow={formatEnumValue(exercise.primaryMuscleGroup)}
          title={exercise.name}
          description={
            chips.length > 0 ? (
              <span className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-foreground/85"
                  >
                    {formatEnumValue(chip)}
                  </span>
                ))}
              </span>
            ) : undefined
          }
          actions={
            <Button
              type="button"
              disabled={startSession.isPending}
              onClick={() => startSession.mutate({ exerciseId: exercise.id })}
            >
              {startSession.isPending ? <Loader2 className="animate-spin" /> : <Play />}
              Start a session with it
            </Button>
          }
        />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <DetailSection title="Progress">{renderProgressTab()}</DetailSection>
            <DetailSection title="History">{renderHistoryTab()}</DetailSection>
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <section
              aria-label="Images and muscles"
              className="flex flex-col gap-4 rounded-xl border bg-card p-4"
            >
              <AlternatingStorageImage
                fileIds={[exercise.image1FileId, exercise.image2FileId]}
                alt={exercise.name}
                className="aspect-video w-full rounded-lg bg-muted"
              />
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Primary</dt>
                <dd className="font-medium">{formatEnumValue(exercise.primaryMuscleGroup)}</dd>
                {exercise.secondaryMuscleGroups.length > 0 ? (
                  <>
                    <dt className="text-muted-foreground">Secondary</dt>
                    <dd>
                      {exercise.secondaryMuscleGroups
                        .map((s) => formatEnumValue(s.muscleGroup))
                        .join(" · ")}
                    </dd>
                  </>
                ) : null}
              </dl>
              <ExerciseAttributes
                level={exercise.level}
                category={exercise.category}
                equipment={exercise.equipment}
                force={exercise.strength?.force ?? null}
                mechanic={exercise.strength?.mechanic ?? null}
              />
              {exercise.strength?.doubleWeight ? (
                <p className="rounded-lg bg-surface-inset px-3 py-2.5 text-[13px] text-muted-foreground">
                  <strong className="font-semibold text-foreground">Weight per side:</strong> the
                  logged weight is for one side, so session volume counts it twice.
                </p>
              ) : null}
            </section>
            <DetailSection title="How to">
              <ExerciseInstructions instructions={exercise.instructions} />
            </DetailSection>
          </div>
        </div>
      </>
    );
  }

  return <PageShell maxWidth="6xl">{renderContent()}</PageShell>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const ATTRIBUTE_LABELS = {
  level: "Level",
  category: "Category",
  equipment: "Equipment",
  force: "Force",
  mechanic: "Mechanic",
} as const;

type AttributeKey = keyof typeof ATTRIBUTE_LABELS;

function formatEnumValue(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ExerciseAttributesProps {
  level: string | null | undefined;
  category: string | null | undefined;
  equipment: string | null | undefined;
  force: string | null | undefined;
  mechanic: string | null | undefined;
}

function ExerciseAttributes(props: ExerciseAttributesProps) {
  const items = (Object.keys(ATTRIBUTE_LABELS) as AttributeKey[])
    .map((key) => ({ key, value: props[key] }))
    .filter((i): i is { key: AttributeKey; value: string } => Boolean(i.value));

  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg bg-surface-inset p-3 text-sm sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-0.5">
          <dt className="text-[12px] text-muted-foreground">{ATTRIBUTE_LABELS[item.key]}</dt>
          <dd className="font-medium">{formatEnumValue(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExerciseInstructions({ instructions }: { instructions: string[] }) {
  if (instructions.length === 0) {
    return <p className="text-sm italic text-muted-foreground/60">No instructions yet.</p>;
  }
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground/85 marker:text-muted-foreground">
      {instructions.map((step, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: instructions are stable, ordered, and never reordered
        <li key={i}>{step}</li>
      ))}
    </ol>
  );
}

type ExerciseHistoryEntry = NonNullable<
  ResultOf<typeof ExerciseDetailQuery>["exercise"]
>["workoutSessionExercises"][number];

interface ExerciseHistoryProps {
  entries: ExerciseHistoryEntry[];
  doubleWeight: boolean;
  exerciseName: string;
}

const historyVolumeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function compactSets(sets: { reps: number; weight: unknown }[]): string {
  const weights = sets.map((s) => Number(s.weight));
  const label = (w: number) => (w === 0 ? "BW" : String(w));
  if (weights.every((w) => w === weights[0])) {
    return `${label(weights[0] ?? 0)} × ${sets.map((s) => s.reps).join(" · ")}`;
  }
  return sets.map((s) => `${label(Number(s.weight))} × ${s.reps}`).join(" · ");
}

function ExerciseHistory({ entries, doubleWeight, exerciseName }: ExerciseHistoryProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">You haven't logged this exercise yet.</p>;
  }
  const multiplier = doubleWeight ? 2 : 1;
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th scope="col" className="py-2 pl-4 font-medium">
              Session
            </th>
            <th scope="col" className="font-medium">
              Sets{doubleWeight ? " (per side)" : ""}
            </th>
            <th scope="col" className="hidden font-medium sm:table-cell">
              e1RM
            </th>
            <th scope="col" className="pr-4 text-right font-medium">
              Volume
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const date = new Date(entry.workoutSession.startedAt);
            const sameYear = date.getFullYear() === new Date().getFullYear();
            const sets = entry.workoutSessionStrengthSets;
            const volume = sets.reduce((acc, s) => acc + s.reps * Number(s.weight) * multiplier, 0);
            const best = sets.reduce(
              (acc, s) => Math.max(acc, estimateOneRepMax(Number(s.weight), s.reps)),
              0,
            );
            return (
              <tr key={entry.id} className="border-t">
                <td className="py-2.5 pr-3 pl-4">
                  <Link
                    to="/train/sessions/$sessionId"
                    params={{ sessionId: entry.workoutSession.id }}
                    className="flex flex-col font-medium hover:text-link"
                  >
                    {date.toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      ...(sameYear ? {} : { year: "numeric" }),
                    })}
                    <span className="text-[12px] font-normal text-muted-foreground">
                      {entry.workoutSession.workout?.name ?? exerciseName}
                    </span>
                  </Link>
                </td>
                <td className="pr-3">{sets.length > 0 ? compactSets(sets) : "—"}</td>
                <td className="hidden pr-3 sm:table-cell">
                  {best > 0 ? `${best.toFixed(1)} kg` : "—"}
                </td>
                <td className="pr-4 text-right whitespace-nowrap">
                  {historyVolumeFormat.format(volume)} kg
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface ProgressPoint {
  date: number;
  volume: number;
  oneRm: number;
}

function buildProgressPoints(
  entries: ExerciseHistoryEntry[],
  doubleWeight: boolean,
): ProgressPoint[] {
  const points: ProgressPoint[] = [];
  for (const entry of entries) {
    if (entry.workoutSessionStrengthSets.length === 0) {
      continue;
    }
    let volume = 0;
    let oneRm = 0;
    for (const set of entry.workoutSessionStrengthSets) {
      if (set.reps <= 0) {
        continue;
      }
      const w = Number(set.weight);
      volume += w * set.reps;
      // A one-rep set is measured; Epley estimates sets with two or more reps.
      const est = estimateOneRepMax(w, set.reps);
      if (est > oneRm) {
        oneRm = est;
      }
    }
    if (doubleWeight) {
      volume *= 2;
    }
    points.push({
      date: new Date(entry.workoutSession.startedAt).getTime(),
      volume,
      oneRm,
    });
  }
  return points.sort((a, b) => a.date - b.date);
}

interface ExerciseProgressProps {
  points: ProgressPoint[];
  doubleWeight: boolean;
}

function ExerciseProgress({ points, doubleWeight }: ExerciseProgressProps) {
  if (points.length === 0) {
    return (
      <Card className="border-border border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Log a session to start tracking progress.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-right text-xs text-muted-foreground">
        {points.length} session{points.length === 1 ? "" : "s"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ProgressCard
          title="Volume"
          subtitle="weight × reps, all sets"
          metric="volume"
          metricLabel="Volume"
          points={points}
          format={(v) => `${Math.round(v).toLocaleString()} kg`}
          color="var(--color-chart-1)"
          gradientId="progress-volume"
        />
        <ProgressCard
          title="Est. 1RM"
          subtitle={`Epley${doubleWeight ? ", per side" : ""}`}
          metric="oneRm"
          metricLabel="Est. 1RM"
          points={points}
          format={(v) => `${v.toFixed(1)} kg`}
          color="var(--color-chart-2)"
          // Orange is fill-only: a neutral outline keeps the trend legible in light mode.
          stroke="var(--color-muted-foreground)"
          gradientId="progress-1rm"
        />
      </div>
    </section>
  );
}

interface ProgressCardProps {
  title: string;
  subtitle: string;
  metric: "volume" | "oneRm";
  metricLabel: string;
  points: ProgressPoint[];
  format: (v: number) => string;
  /** Area fill; also the line colour unless `stroke` is set. */
  color: string;
  stroke?: string;
  gradientId: string;
}

/**
 * Gains are favourable deltas (positive). Declines stay neutral: destructive
 * text is reserved for delete actions and errors.
 */
function deltaToneClass(delta: number | null): string {
  return delta !== null && delta > 0 ? "text-positive" : "text-muted-foreground";
}

function ProgressCard({
  title,
  subtitle,
  metric,
  metricLabel,
  points,
  format,
  color,
  stroke,
  gradientId,
}: ProgressCardProps) {
  const last = points.at(-1);
  if (!last) {
    return null;
  }
  const latest = last[metric];
  const prev = points.length > 1 ? points.at(-2) : undefined;
  const previous = prev ? prev[metric] : null;
  let delta: number | null = null;
  let deltaPct: number | null = null;
  if (previous !== null) {
    delta = latest - previous;
    if (previous !== 0) {
      deltaPct = (delta / previous) * 100;
    }
  }
  const deltaTone = deltaToneClass(delta);

  return (
    <Card className="gap-3 border-0 bg-surface-inset py-4 shadow-none">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold text-muted-foreground">{title}</p>
          {deltaPct === null ? null : (
            <span className={cn("text-xs tabular-nums", deltaTone)}>
              {deltaPct > 0 ? "+" : ""}
              {deltaPct.toFixed(1)}%
            </span>
          )}
        </div>
        <CardTitle className="text-xl tabular-nums">{format(latest)}</CardTitle>
        <p className="text-[11px] text-muted-foreground/80">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-0">
        {points.length >= 2 ? (
          <TrendChart
            points={points}
            metric={metric}
            metricLabel={metricLabel}
            format={format}
            color={color}
            stroke={stroke}
            gradientId={gradientId}
          />
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Log another session to see a trend.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface TrendChartProps {
  points: ProgressPoint[];
  metric: "volume" | "oneRm";
  metricLabel: string;
  format: (v: number) => string;
  color: string;
  stroke?: string | undefined;
  gradientId: string;
}

function TrendChart({
  points,
  metric,
  metricLabel,
  format,
  color,
  stroke = color,
  gradientId,
}: TrendChartProps) {
  const formatTick = (value: number) =>
    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTick}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            interval="preserveStartEnd"
            height={20}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke, strokeOpacity: 0.5, strokeDasharray: "3 3" }}
            content={<TrendTooltip metric={metric} metricLabel={metricLabel} format={format} />}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 3.5,
              fill: color,
              stroke: stroke === color ? "var(--color-background)" : stroke,
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type TrendTooltipProps = Partial<TooltipContentProps<number, string>> & {
  metric: "volume" | "oneRm";
  metricLabel: string;
  format: (v: number) => string;
};

function TrendTooltip({ active, payload, metric, metricLabel, format }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload as ProgressPoint | undefined;
  if (!point) {
    return null;
  }
  const value = point[metric];
  const date = new Date(point.date);
  return (
    <div className="rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">
        {date.toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
      <p className="font-medium tabular-nums">
        <span className="text-muted-foreground">{metricLabel}: </span>
        {format(value)}
      </p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}

interface CardioPoint {
  date: number;
  value: number;
}

function buildCardioProgressPoints(
  entries: ExerciseHistoryEntry[],
  primary: CardioMetricSpec,
): CardioPoint[] {
  const aggregation = aggregationForFormat(primary.format);
  const points: CardioPoint[] = [];
  for (const entry of entries) {
    const cardioEntries = entry.workoutSessionCardioEntries;
    if (!cardioEntries || cardioEntries.length === 0) {
      continue;
    }
    let total = 0;
    let seen = 0;
    for (const e of cardioEntries) {
      const v = e.metrics?.[primary.key];
      if (typeof v === "number" && Number.isFinite(v)) {
        total += v;
        seen += 1;
      }
    }
    if (seen === 0) {
      continue;
    }
    points.push({
      date: new Date(entry.workoutSession.startedAt).getTime(),
      value: aggregation === "average" ? total / seen : total,
    });
  }
  return points.sort((a, b) => a.date - b.date);
}

function CardioSchemaMissingNotice() {
  return (
    <Card className="border-border border-dashed">
      <CardContent className="text-muted-foreground py-6 text-center text-sm">
        This cardio exercise is missing its metrics schema, so there's nothing to show here. An
        admin needs to configure it before sessions can record entries.
      </CardContent>
    </Card>
  );
}

function CardioProgress({ points, primary }: { points: CardioPoint[]; primary: CardioMetricSpec }) {
  if (points.length === 0) {
    return (
      <Card className="border-border border-dashed">
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          Log a session to start tracking progress.
        </CardContent>
      </Card>
    );
  }
  const last = points.at(-1);
  const prev = points.length > 1 ? points.at(-2) : undefined;
  const latest = last ? last.value : 0;
  const previous = prev ? prev.value : null;
  let deltaPct: number | null = null;
  let delta: number | null = null;
  if (previous !== null) {
    delta = latest - previous;
    if (previous !== 0) {
      deltaPct = (delta / previous) * 100;
    }
  }
  const tone = deltaToneClass(delta);
  const aggregation = aggregationForFormat(primary.format);
  const caption = aggregation === "average" ? "average across entries" : "total across entries";
  return (
    <section className="space-y-3">
      <p className="text-muted-foreground text-right text-xs">
        {points.length} session{points.length === 1 ? "" : "s"}
      </p>
      <Card className="border-border/60">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {primary.label} per session
            </p>
            {deltaPct === null ? null : (
              <span className={cn("text-xs tabular-nums", tone)}>
                {deltaPct > 0 ? "+" : ""}
                {deltaPct.toFixed(1)}%
              </span>
            )}
          </div>
          <CardTitle className="text-xl tabular-nums">
            {formatMetricValue(latest, primary)}
          </CardTitle>
          <p className="text-muted-foreground/80 text-[11px]">{caption}</p>
        </CardHeader>
        <CardContent className="pt-0">
          {points.length >= 2 ? (
            <CardioTrendChart points={points} primary={primary} />
          ) : (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Log another session to see a trend.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function CardioTrendChart({
  points,
  primary,
}: {
  points: CardioPoint[];
  primary: CardioMetricSpec;
}) {
  const formatTick = (value: number) =>
    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const color = "var(--color-chart-1)";
  const gradientId = "cardio-progress";
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTick}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            interval="preserveStartEnd"
            height={20}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.5, strokeDasharray: "3 3" }}
            content={<CardioTrendTooltip primary={primary} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 3.5,
              fill: color,
              stroke: "var(--color-background)",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardioTrendTooltip({
  active,
  payload,
  primary,
}: Partial<TooltipContentProps<number, string>> & { primary: CardioMetricSpec }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload as CardioPoint | undefined;
  if (!point) {
    return null;
  }
  return (
    <div className="border-border bg-popover/95 rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">
        {new Date(point.date).toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
      <p className="font-medium tabular-nums">
        <span className="text-muted-foreground">{primary.label}: </span>
        {formatMetricValue(point.value, primary)}
      </p>
    </div>
  );
}

interface CardioHistoryProps {
  entries: ExerciseHistoryEntry[];
  schema: CardioMetricsSchema;
  exerciseName: string;
}

function CardioHistory({ entries, schema, exerciseName }: CardioHistoryProps) {
  const specs = iterateMetrics(schema);
  return (
    <section className="space-y-3">
      <p className="text-muted-foreground text-right text-xs">
        {entries.length} session{entries.length === 1 ? "" : "s"}
      </p>
      {entries.length === 0 ? (
        <Card className="border-border border-dashed">
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            You haven't logged this exercise yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const cardioEntries = entry.workoutSessionCardioEntries ?? [];
            const date = new Date(entry.workoutSession.startedAt);
            return (
              <li key={entry.id}>
                <Link
                  to="/train/sessions/$sessionId"
                  params={{ sessionId: entry.workoutSession.id }}
                  className="group block"
                >
                  <Card className="border-border group-hover:border-foreground/20 transition-colors">
                    <CardContent className="space-y-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-medium">
                            {entry.workoutSession.workout?.name ?? exerciseName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {date.toLocaleDateString(undefined, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            {" · "}
                            {cardioEntries.length} entr
                            {cardioEntries.length === 1 ? "y" : "ies"}
                          </p>
                        </div>
                        <ChevronRight className="text-muted-foreground/50 group-hover:text-foreground h-4 w-4 shrink-0 transition-colors" />
                      </div>
                      {cardioEntries.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {cardioEntries.map((e) => (
                            <span
                              key={e.id}
                              className="border-border bg-surface-inset inline-flex items-baseline gap-1.5 rounded-md border px-2 py-1 text-xs tabular-nums"
                            >
                              <span className="text-muted-foreground">{e.entryNumber}.</span>
                              {specs.map((spec) => {
                                const v = e.metrics?.[spec.key];
                                if (v === undefined || v === null) {
                                  return null;
                                }
                                return (
                                  <span key={spec.key} className="font-medium">
                                    {formatMetricValue(v, spec)}
                                  </span>
                                );
                              })}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
