import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, History, Loader2, Play, TrendingUp } from "lucide-react";
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
import { AlternatingStorageImage } from "@/components/storage-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { graphql } from "@/gql";
import {
  asCardioMetricsSchema,
  type CardioMetricSpec,
  type CardioMetrics,
  type CardioMetricsSchema,
  formatMetricValue,
  iterateMetrics,
} from "@/lib/cardio-schema";
import { gqlRequest } from "@/lib/graphql";
import { useStartSession } from "@/lib/hooks/use-start-session";
import { cn } from "@/lib/utils";

const ExerciseDetailQuery = graphql(`
  query ExerciseDetail($id: uuid!) {
    exercise(id: $id) {
      id
      name
      instructions
      image1FileId
      image2FileId
      doubleWeight
      level
      category
      equipment
      force
      mechanic
      primaryMuscleGroup
      metricsSchema
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
        workoutSessionSets(order_by: { setNumber: asc }) {
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
    () => buildProgressPoints(history, data?.exercise?.doubleWeight ?? false),
    [history, data?.exercise?.doubleWeight],
  );

  const cardioSchema = useMemo(
    () => asCardioMetricsSchema(data?.exercise?.metricsSchema),
    [data?.exercise?.metricsSchema],
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
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!data?.exercise) {
      return <p className="text-sm text-muted-foreground">Exercise not found.</p>;
    }
    const exercise = data.exercise;
    const isCardio = exercise.category === "cardio" && cardioSchema && cardioPrimary;
    return (
      <>
        <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <CardHeader className="space-y-3 pb-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {exercise.primaryMuscleGroup}
              </p>
              <CardTitle className="text-2xl tracking-tight">{exercise.name}</CardTitle>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="primary">{exercise.primaryMuscleGroup}</Badge>
              {exercise.secondaryMuscleGroups.map((s) => (
                <Badge key={s.muscleGroup}>{s.muscleGroup}</Badge>
              ))}
              {exercise.doubleWeight ? <Badge variant="outline">Two-handed</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={startSession.isPending}
              onClick={() => startSession.mutate({ exerciseId: exercise.id })}
            >
              {startSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              Start session
            </Button>
            <Separator />
            <AlternatingStorageImage
              fileIds={[exercise.image1FileId, exercise.image2FileId]}
              alt={exercise.name}
              className="aspect-video w-full rounded-lg border border-border/60"
            />
            <ExerciseAttributes
              level={exercise.level}
              category={exercise.category}
              equipment={exercise.equipment}
              force={exercise.force}
              mechanic={exercise.mechanic}
            />
            <ExerciseInstructions instructions={exercise.instructions} />

            {exercise.doubleWeight ? (
              <div className="rounded-md border border-border/40 bg-muted/40 p-3 text-xs text-muted-foreground">
                <strong className="font-medium text-foreground">Two-handed:</strong> the recorded
                weight is per side; total volume doubles when calculating session totals.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Tabs defaultValue="progress">
          <TabsList>
            <TabsTrigger value="progress">
              <TrendingUp className="h-3.5 w-3.5" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress">
            {isCardio && cardioPrimary ? (
              <CardioProgress points={cardioPoints} primary={cardioPrimary} />
            ) : (
              <ExerciseProgress points={progressPoints} doubleWeight={exercise.doubleWeight} />
            )}
          </TabsContent>

          <TabsContent value="history">
            {isCardio && cardioSchema ? (
              <CardioHistory entries={history} schema={cardioSchema} exerciseName={exercise.name} />
            ) : (
              <ExerciseHistory
                entries={history}
                doubleWeight={exercise.doubleWeight}
                exerciseName={exercise.name}
              />
            )}
          </TabsContent>
        </Tabs>
      </>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">{renderContent()}</div>
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
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border/40 bg-muted/30 p-3 text-xs sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-0.5">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {ATTRIBUTE_LABELS[item.key]}
          </dt>
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
    <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
      {instructions.map((step, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: instructions are stable, ordered, and never reordered
        <li key={i}>{step}</li>
      ))}
    </ol>
  );
}

interface ExerciseHistoryProps {
  entries: Array<{
    id: string;
    workoutSession: {
      id: string;
      startedAt: string;
      workout?: { id: string; name: string } | null;
    };
    workoutSessionSets: Array<{
      id: string;
      setNumber: number;
      reps: number;
      weight: number | string;
    }>;
  }>;
  doubleWeight: boolean;
  exerciseName: string;
}

function ExerciseHistory({ entries, doubleWeight, exerciseName }: ExerciseHistoryProps) {
  return (
    <section className="space-y-3">
      <p className="text-right text-xs text-muted-foreground">
        {entries.length} session{entries.length === 1 ? "" : "s"}
      </p>

      {entries.length === 0 ? (
        <Card className="border-border/60 border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            You haven't logged this exercise yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const date = new Date(entry.workoutSession.startedAt);
            const totalReps = entry.workoutSessionSets.reduce((acc, s) => acc + s.reps, 0);
            const topWeight = entry.workoutSessionSets.reduce(
              (acc, s) => Math.max(acc, Number(s.weight)),
              0,
            );
            return (
              <li key={entry.id}>
                <Link
                  to="/sessions/$sessionId"
                  params={{ sessionId: entry.workoutSession.id }}
                  className="group block"
                >
                  <Card className="border-border/60 backdrop-blur transition-colors group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80">
                    <CardContent className="space-y-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-medium">
                            {entry.workoutSession.workout?.name ?? exerciseName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {date.toLocaleDateString(undefined, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            {" · "}
                            {entry.workoutSessionSets.length} sets · {totalReps} reps
                            {topWeight > 0
                              ? ` · top ${topWeight}${doubleWeight ? "/side" : ""} kg`
                              : ""}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                      </div>
                      {entry.workoutSessionSets.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.workoutSessionSets.map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 py-1 text-xs tabular-nums"
                            >
                              <span className="text-muted-foreground">{s.setNumber}.</span>
                              <span className="font-medium">
                                {Number(s.weight) === 0 ? "BW" : `${Number(s.weight)} kg`}
                              </span>
                              <span className="text-muted-foreground">×</span>
                              <span className="font-medium">{s.reps}</span>
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

interface ProgressPoint {
  date: number;
  volume: number;
  oneRm: number;
}

function buildProgressPoints(
  entries: ExerciseHistoryProps["entries"],
  doubleWeight: boolean,
): ProgressPoint[] {
  const points: ProgressPoint[] = [];
  for (const entry of entries) {
    if (entry.workoutSessionSets.length === 0) {
      continue;
    }
    let volume = 0;
    let oneRm = 0;
    for (const set of entry.workoutSessionSets) {
      if (set.reps <= 0) {
        continue;
      }
      const w = Number(set.weight);
      volume += w * set.reps;
      // Epley: 1RM ≈ w × (1 + reps / 30); collapses to w when reps = 1.
      const est = w * (1 + set.reps / 30);
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
      <Card className="border-border/60 border-dashed">
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
  color: string;
  gradientId: string;
}

function deltaToneClass(delta: number | null): string {
  if (delta === null || delta === 0) {
    return "text-muted-foreground";
  }
  if (delta > 0) {
    return "text-emerald-500";
  }
  return "text-destructive";
}

function ProgressCard({
  title,
  subtitle,
  metric,
  metricLabel,
  points,
  format,
  color,
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
    <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
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
  gradientId: string;
}

function TrendChart({ points, metric, metricLabel, format, color, gradientId }: TrendChartProps) {
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
            cursor={{ stroke: color, strokeOpacity: 0.5, strokeDasharray: "3 3" }}
            content={<TrendTooltip metric={metric} metricLabel={metricLabel} format={format} />}
          />
          <Area
            type="monotone"
            dataKey={metric}
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
    <div className="rounded-md border border-border/60 bg-popover/95 px-2.5 py-1.5 text-xs shadow-md backdrop-blur">
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
  entries: ExerciseHistoryProps["entries"] & {
    [k: number]: { workoutSessionCardioEntries: Array<{ metrics: unknown }> };
  },
  primary: CardioMetricSpec,
): CardioPoint[] {
  const points: CardioPoint[] = [];
  for (const entry of entries) {
    const cardioEntries = (
      entry as unknown as {
        workoutSessionCardioEntries: Array<{ metrics: CardioMetrics | null }>;
      }
    ).workoutSessionCardioEntries;
    if (!cardioEntries || cardioEntries.length === 0) {
      continue;
    }
    let total = 0;
    let saw = false;
    for (const e of cardioEntries) {
      const v = e.metrics?.[primary.key];
      if (typeof v === "number" && Number.isFinite(v)) {
        total += v;
        saw = true;
      }
    }
    if (!saw) {
      continue;
    }
    points.push({
      date: new Date(entry.workoutSession.startedAt).getTime(),
      value: total,
    });
  }
  return points.sort((a, b) => a.date - b.date);
}

function CardioProgress({ points, primary }: { points: CardioPoint[]; primary: CardioMetricSpec }) {
  if (points.length === 0) {
    return (
      <Card className="border-border/60 border-dashed">
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
  return (
    <section className="space-y-3">
      <p className="text-muted-foreground text-right text-xs">
        {points.length} session{points.length === 1 ? "" : "s"}
      </p>
      <Card className="border-border/60 supports-[backdrop-filter]:bg-card/80 backdrop-blur">
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
          <p className="text-muted-foreground/80 text-[11px]">total across entries</p>
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
    <div className="border-border/60 bg-popover/95 rounded-md border px-2.5 py-1.5 text-xs shadow-md backdrop-blur">
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
  entries: ExerciseHistoryProps["entries"];
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
        <Card className="border-border/60 border-dashed">
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            You haven't logged this exercise yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const cardioEntries =
              (
                entry as unknown as {
                  workoutSessionCardioEntries: Array<{
                    id: string;
                    entryNumber: number;
                    metrics: CardioMetrics | null;
                  }>;
                }
              ).workoutSessionCardioEntries ?? [];
            const date = new Date(entry.workoutSession.startedAt);
            return (
              <li key={entry.id}>
                <Link
                  to="/sessions/$sessionId"
                  params={{ sessionId: entry.workoutSession.id }}
                  className="group block"
                >
                  <Card className="border-border/60 group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80 backdrop-blur transition-colors">
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
                              className="border-border/50 bg-muted/40 inline-flex items-baseline gap-1.5 rounded-md border px-2 py-1 text-xs tabular-nums"
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
