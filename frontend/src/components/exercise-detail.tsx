import type { ResultOf } from "@graphql-typed-document-node/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Play } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import { Tag } from "@/components/patterns/tag";
import { AlternatingStorageImage } from "@/components/storage-image";
import { Button } from "@/components/ui/button";
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
import {
  buildCardioProgress,
  buildStrengthProgress,
  type CardioProgressPoint,
  changeFromPrevious,
  DEFAULT_EXERCISE_PROGRESS_PERIOD,
  EXERCISE_PROGRESS_PERIODS,
  type ExerciseProgressPeriod,
  formatPercentChange,
  pointsInPeriod,
  type StrengthProgressPoint,
} from "@/lib/exercise-progress";
import { gqlRequest } from "@/lib/graphql";
import { useStartSession } from "@/lib/hooks/use-start-session";
import { metricFormat } from "@/lib/metric-format";
import { summarizeCardioEntries } from "@/lib/session-logging";
import { formatSetsSummary } from "@/lib/set-summary";
import { estimateOneRepMax } from "@/lib/strength-metrics";
import { useLocalToday } from "@/lib/use-local-today";
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

type ExerciseData = NonNullable<ResultOf<typeof ExerciseDetailQuery>["exercise"]>;
type ExerciseHistoryEntry = ExerciseData["workoutSessionExercises"][number];

export function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["exercises", "detail", exerciseId],
    queryFn: () => gqlRequest(ExerciseDetailQuery, { id: exerciseId }),
  });

  function renderContent() {
    if (isLoading) {
      return <DetailSkeleton />;
    }
    if (error) {
      return (
        <ErrorState
          title="Couldn't load this exercise"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      );
    }
    if (!data?.exercise) {
      return (
        <EmptyState
          title="Exercise not found"
          description="It may have been deleted or is not shared with you."
        />
      );
    }
    return <ExerciseDetailContent exercise={data.exercise} />;
  }

  return <PageShell maxWidth="6xl">{renderContent()}</PageShell>;
}

function ExerciseDetailContent({ exercise }: { exercise: ExerciseData }) {
  const startSession = useStartSession();
  const doubleWeight = exercise.strength?.doubleWeight ?? false;

  const history = useMemo(
    () =>
      [...exercise.workoutSessionExercises].sort(
        (a, b) =>
          new Date(b.workoutSession.startedAt).getTime() -
          new Date(a.workoutSession.startedAt).getTime(),
      ),
    [exercise.workoutSessionExercises],
  );
  const cardioSchema = useMemo(
    () => asCardioMetricsSchema(exercise.cardio?.metricsSchema),
    [exercise.cardio?.metricsSchema],
  );
  const cardioPrimary = cardioSchema ? (iterateMetrics(cardioSchema)[0] ?? null) : null;
  const isCardio = exercise.kind === "cardio";
  // A cardio exercise without a usable metrics schema would otherwise fall
  // through to the strength views (always empty for cardio): say so instead.
  const cardioSchemaMissing = isCardio && !(cardioSchema && cardioPrimary);

  const chips = [
    exercise.equipment,
    exercise.level,
    exercise.strength?.mechanic,
    exercise.strength?.force,
    isCardio ? "cardio" : null,
  ].filter((value): value is string => Boolean(value));

  function renderProgress() {
    if (cardioSchemaMissing) {
      return (
        <DetailCard title="Progress">
          <CardioSchemaMissingNotice />
        </DetailCard>
      );
    }
    if (isCardio && cardioPrimary) {
      return <CardioProgress history={history} primary={cardioPrimary} />;
    }
    return (
      <StrengthProgress
        history={history}
        doubleWeight={doubleWeight}
        exerciseName={exercise.name}
      />
    );
  }

  function renderHistory() {
    if (cardioSchemaMissing) {
      return <CardioSchemaMissingNotice />;
    }
    if (isCardio && cardioSchema && cardioPrimary) {
      return (
        <CardioHistory
          entries={history}
          schema={cardioSchema}
          primary={cardioPrimary}
          exerciseName={exercise.name}
        />
      );
    }
    return (
      <ExerciseHistory entries={history} doubleWeight={doubleWeight} exerciseName={exercise.name} />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={formatEnumValue(exercise.primaryMuscleGroup)}
        title={exercise.name}
        description={
          chips.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <Tag key={chip}>{formatEnumValue(chip)}</Tag>
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-start gap-5">
        <div className="flex min-w-0 flex-col gap-5">
          {renderProgress()}
          <DetailCard title="History" flush>
            {renderHistory()}
          </DetailCard>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <ImagesAndMuscles exercise={exercise} />
          <DetailCard title="How to">
            <ExerciseInstructions instructions={exercise.instructions} />
          </DetailCard>
        </div>
      </div>
    </>
  );
}

/**
 * A card on the exercise page: 20 px padding, 16 px heading, optional caption
 * on the right ("6 sessions"). `flush` drops the side padding for tables.
 */
function DetailCard({
  title,
  heading = title,
  aside,
  flush = false,
  children,
}: {
  title: string;
  heading?: string | null;
  aside?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-xl border bg-card",
        flush ? "pt-5 pb-2" : "p-5",
      )}
    >
      {heading ? (
        <div className={cn("flex items-baseline justify-between gap-3", flush && "px-5")}>
          <h2 className="text-base font-semibold">{heading}</h2>
          {aside ? (
            <span className="text-[13px] text-muted-foreground tabular-nums">{aside}</span>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function ImagesAndMuscles({ exercise }: { exercise: ExerciseData }) {
  const imageIds = [exercise.image1FileId, exercise.image2FileId];
  return (
    <DetailCard title="Images and muscles" heading={null}>
      {imageIds.some(Boolean) ? (
        <AlternatingStorageImage
          fileIds={imageIds}
          alt={`${exercise.name}, start and end positions`}
          frame="hero"
          pager
        />
      ) : null}
      <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-[13px] text-muted-foreground">Primary</dt>
        <dd className="font-semibold">{formatEnumValue(exercise.primaryMuscleGroup)}</dd>
        {exercise.secondaryMuscleGroups.length > 0 ? (
          <>
            <dt className="text-[13px] text-muted-foreground">Secondary</dt>
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
        <p className="rounded-[10px] bg-surface-inset px-3 py-2.5 text-[13px] text-muted-foreground">
          <strong className="font-semibold text-foreground">Weight per side:</strong> the logged
          weight is for one side, so session volume counts it twice.
        </p>
      ) : null}
    </DetailCard>
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
    <dl className="grid grid-cols-2 gap-3 rounded-[10px] bg-surface-inset p-3 text-sm sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-0.5">
          <dt className="text-[12px] text-muted-foreground">{ATTRIBUTE_LABELS[item.key]}</dt>
          <dd className="font-semibold">{formatEnumValue(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExerciseInstructions({ instructions }: { instructions: string[] }) {
  if (instructions.length === 0) {
    return <p className="text-sm text-muted-foreground">No instructions yet.</p>;
  }
  return (
    <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-sm leading-relaxed text-foreground/90 marker:text-muted-foreground">
      {instructions.map((step, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: instructions are stable, ordered, and never reordered
        <li key={i}>{step}</li>
      ))}
    </ol>
  );
}

function sessionDateLabel(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** History's first cell: the session date over its workout, linking to the session. */
function SessionCell({
  entry,
  exerciseName,
}: {
  entry: ExerciseHistoryEntry;
  exerciseName: string;
}) {
  return (
    <td className="py-2 pr-2 pl-5">
      <Link
        to="/train/sessions/$sessionId"
        params={{ sessionId: entry.workoutSession.id }}
        className="flex flex-col font-medium hover:text-link"
      >
        <span className="whitespace-nowrap">
          {sessionDateLabel(entry.workoutSession.startedAt)}
        </span>
        <span className="text-[12px] font-normal text-muted-foreground">
          {entry.workoutSession.workout?.name ?? exerciseName}
        </span>
      </Link>
    </td>
  );
}

const HISTORY_HEAD = "py-2 font-semibold";

function ExerciseHistory({
  entries,
  doubleWeight,
  exerciseName,
}: {
  entries: ExerciseHistoryEntry[];
  doubleWeight: boolean;
  exerciseName: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="px-5 pb-3 text-sm text-muted-foreground">
        You haven't logged this exercise yet.
      </p>
    );
  }
  const multiplier = doubleWeight ? 2 : 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th scope="col" className={cn(HISTORY_HEAD, "pl-5")}>
              Session
            </th>
            <th scope="col" className={cn(HISTORY_HEAD, "px-2")}>
              Sets{doubleWeight ? " (per side)" : ""}
            </th>
            <th scope="col" className={cn(HISTORY_HEAD, "px-2 text-right")}>
              e1RM
            </th>
            <th scope="col" className={cn(HISTORY_HEAD, "pr-5 text-right")}>
              Volume
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const sets = entry.workoutSessionStrengthSets;
            const volume = sets.reduce((acc, s) => acc + s.reps * Number(s.weight) * multiplier, 0);
            const best = sets.reduce(
              (acc, s) => Math.max(acc, estimateOneRepMax(Number(s.weight), s.reps)),
              0,
            );
            return (
              <tr key={entry.id} className="h-14 border-t">
                <SessionCell entry={entry} exerciseName={exerciseName} />
                <td className="px-2">{formatSetsSummary(sets, { style: "compact" }) ?? "—"}</td>
                <td className="px-2 text-right font-semibold whitespace-nowrap">
                  {best > 0 ? metricFormat.estimatedOneRepMax(best) : "—"}
                </td>
                <td className="pr-5 text-right whitespace-nowrap">{metricFormat.volume(volume)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Gains are favourable (positive); declines stay neutral, never destructive. */
function changeToneClass(change: number | null): string {
  return change !== null && change > 0 ? "text-positive" : "text-muted-foreground";
}

function ProgressTile({
  label,
  value,
  change,
  caption,
}: {
  label: string;
  value: string;
  change: number | null;
  caption: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-surface-inset px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-soft-foreground">{label}</span>
        {change === null ? null : (
          <span className={cn("text-[12px] font-semibold tabular-nums", changeToneClass(change))}>
            {formatPercentChange(change)}
          </span>
        )}
      </div>
      <strong className="text-[22px] font-bold tabular-nums">{value}</strong>
      <span className="text-[12px] text-muted-foreground">{caption}</span>
    </div>
  );
}

function PeriodControl({
  value,
  onChange,
}: {
  value: ExerciseProgressPeriod;
  onChange: (value: ExerciseProgressPeriod) => void;
}) {
  return (
    <div className="flex justify-end">
      <Segmented
        label="Chart period"
        options={EXERCISE_PROGRESS_PERIODS}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function sessionCount(count: number): string {
  return `${count} session${count === 1 ? "" : "s"}`;
}

function StrengthProgress({
  history,
  doubleWeight,
  exerciseName,
}: {
  history: ExerciseHistoryEntry[];
  doubleWeight: boolean;
  exerciseName: string;
}) {
  const today = useLocalToday();
  const [period, setPeriod] = useState<ExerciseProgressPeriod>(DEFAULT_EXERCISE_PROGRESS_PERIOD);
  const points = useMemo(
    () => buildStrengthProgress(history, doubleWeight),
    [history, doubleWeight],
  );
  const latest = points.at(-1);
  if (!latest) {
    return (
      <DetailCard title="Progress">
        <ProgressEmpty>Log a session to start tracking progress.</ProgressEmpty>
      </DetailCard>
    );
  }
  const shown = pointsInPeriod(points, period, today);
  return (
    <DetailCard title="Progress" aside={sessionCount(points.length)}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <ProgressTile
          label="Volume"
          value={metricFormat.volume(latest.volume)}
          change={changeFromPrevious(points, (point) => point.volume)}
          caption="weight × reps, all sets"
        />
        <ProgressTile
          label="Est. 1RM"
          value={metricFormat.estimatedOneRepMax(latest.oneRm)}
          change={changeFromPrevious(points, (point) => point.oneRm)}
          caption={doubleWeight ? "Epley, per side" : "Epley"}
        />
      </div>
      <PeriodControl value={period} onChange={setPeriod} />
      <StrengthProgressChart points={shown} exerciseName={exerciseName} />
      <p className="text-[13px] text-muted-foreground">
        {doubleWeight
          ? "Volume doubles per-side weight."
          : "Volume is weight × reps across all sets."}
      </p>
    </DetailCard>
  );
}

/** One chart, volume (Chart 1, left) and Est. 1RM (Chart 2, right) starting level. */
function StrengthProgressChart({
  points,
  exerciseName,
}: {
  points: StrengthProgressPoint[];
  exerciseName: string;
}) {
  if (points.length === 0) {
    return <ProgressEmpty>No progress in this period.</ProgressEmpty>;
  }
  return (
    <TrendChart
      title={`${exerciseName} volume and estimated one-rep max`}
      period="session"
      xScale="index"
      height={220}
      series={[
        {
          id: "volume",
          name: "Volume",
          legendLabel: "Volume (kg)",
          color: "chart-1",
          points: points.map((point) => ({ date: point.date, value: point.volume })),
          format: metricFormat.volume,
        },
        {
          id: "e1rm",
          name: "Est. 1RM",
          legendLabel: "Est. 1RM (kg)",
          color: "chart-2",
          axis: "right",
          points: points.map((point) => ({ date: point.date, value: point.oneRm })),
          format: metricFormat.estimatedOneRepMax,
        },
      ]}
    />
  );
}

function ProgressEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border-[1.5px] border-input border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function CardioSchemaMissingNotice() {
  return (
    <p className="mx-5 mb-3 rounded-[10px] bg-surface-inset px-3 py-2.5 text-[13px] text-muted-foreground">
      This cardio exercise is missing its metrics schema, so there's nothing to show here. An admin
      needs to configure it before sessions can record entries.
    </p>
  );
}

function CardioProgress({
  history,
  primary,
}: {
  history: ExerciseHistoryEntry[];
  primary: CardioMetricSpec;
}) {
  const today = useLocalToday();
  const [period, setPeriod] = useState<ExerciseProgressPeriod>(DEFAULT_EXERCISE_PROGRESS_PERIOD);
  const points = useMemo(() => buildCardioProgress(history, primary), [history, primary]);
  const latest = points.at(-1);
  if (!latest) {
    return (
      <DetailCard title="Progress">
        <ProgressEmpty>Log a session to start tracking progress.</ProgressEmpty>
      </DetailCard>
    );
  }
  const average = aggregationForFormat(primary.format) === "average";
  const shown = pointsInPeriod(points, period, today);
  const format = (value: number) => formatMetricValue(value, primary);
  return (
    <DetailCard title="Progress" aside={sessionCount(points.length)}>
      <ProgressTile
        label={`${primary.label} per session`}
        value={format(latest.value)}
        change={changeFromPrevious(points, (point) => point.value)}
        caption={average ? "average across entries" : "total across entries"}
      />
      <PeriodControl value={period} onChange={setPeriod} />
      {shown.length === 0 ? (
        <ProgressEmpty>No progress in this period.</ProgressEmpty>
      ) : (
        <CardioProgressChart points={shown} primary={primary} format={format} />
      )}
    </DetailCard>
  );
}

function CardioProgressChart({
  points,
  primary,
  format,
}: {
  points: CardioProgressPoint[];
  primary: CardioMetricSpec;
  format: (value: number) => string;
}) {
  return (
    <TrendChart
      title={`${primary.label} per session`}
      period="session"
      xScale="index"
      height={200}
      legend={false}
      axes={{
        left: {
          ...(primary.format === "duration_seconds" ? { format: "duration" as const } : {}),
          ...(primary.unit ? { unit: primary.unit } : {}),
        },
      }}
      series={[
        {
          id: primary.key,
          name: primary.label,
          color: "chart-1",
          points: points.map((point) => ({ date: point.date, value: point.value })),
          format,
        },
      ]}
    />
  );
}

function CardioHistory({
  entries,
  schema,
  primary,
  exerciseName,
}: {
  entries: ExerciseHistoryEntry[];
  schema: CardioMetricsSchema;
  primary: CardioMetricSpec;
  exerciseName: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="px-5 pb-3 text-sm text-muted-foreground">
        You haven't logged this exercise yet.
      </p>
    );
  }
  const average = aggregationForFormat(primary.format) === "average";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th scope="col" className={cn(HISTORY_HEAD, "pl-5")}>
              Session
            </th>
            <th scope="col" className={cn(HISTORY_HEAD, "px-2")}>
              Entries
            </th>
            <th scope="col" className={cn(HISTORY_HEAD, "pr-5 text-right")}>
              {primary.label}
              {average ? " (avg)" : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const cardioEntries = (entry.workoutSessionCardioEntries ?? []).map((e) => ({
              metrics: (e.metrics ?? {}) as Record<string, unknown>,
            }));
            const [point] = buildCardioProgress([entry], primary);
            return (
              <tr key={entry.id} className="h-14 border-t">
                <SessionCell entry={entry} exerciseName={exerciseName} />
                <td className="px-2">{summarizeCardioEntries(cardioEntries, schema) ?? "—"}</td>
                <td className="pr-5 text-right font-semibold whitespace-nowrap">
                  {point ? formatMetricValue(point.value, primary) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-1.5">
          <Skeleton className="h-[22px] w-16 rounded-full" />
          <Skeleton className="h-[22px] w-20 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-5">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}
