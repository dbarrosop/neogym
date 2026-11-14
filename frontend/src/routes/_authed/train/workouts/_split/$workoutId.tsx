import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { ExerciseThumbnail } from "@/components/exercise-thumbnail";
import { Markdown } from "@/components/markdown";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Tag } from "@/components/patterns/tag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import type { WorkoutDetailQuery as WorkoutDetailData } from "@/gql/graphql";
import { localTimeZone } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { useStartSession } from "@/lib/hooks/use-start-session";
import { useAuth } from "@/lib/nhost/auth-provider";
import { formatTopSet } from "@/lib/set-summary";
import { useLocalToday } from "@/lib/use-local-today";
import { cn, formatMuscle } from "@/lib/utils";
import { workoutDetailVariables } from "@/lib/workout-detail";

const WorkoutDetailQuery = graphql(`
  query WorkoutDetail($id: uuid!, $from: date!, $through: date!, $timeZone: String!) {
    workout(id: $id) {
      id
      name
      description
      isPublic
      userId
      workoutExercises(order_by: { position: asc }) {
        id
        position
        exercise {
          id
          name
          kind
          strength {
            doubleWeight
          }
          primaryMuscleGroup
          image1FileId
          image2FileId
        }
      }
      workoutLabels {
        labelId
        label {
          id
          name
        }
      }
    }
    workoutStrengthReport(
      args: { workout_id: $id, from_day: $from, through_day: $through, time_zone: $timeZone }
      where: { volume: { _gt: 0 } }
      order_by: { startedAt: desc }
      limit: 6
    ) {
      sessionId
      startedAt
      volume
    }
  }
`);

// Latest logged strength occurrence per exercise (`limit` applies per parent).
const WorkoutExerciseLastSetsQuery = graphql(`
  query WorkoutExerciseLastSets($exerciseIds: [uuid!]!) {
    exercises(where: { id: { _in: $exerciseIds } }) {
      id
      workoutSessionExercises(
        where: { workoutSessionStrengthSets: {} }
        order_by: { workoutSession: { startedAt: desc } }
        limit: 1
      ) {
        id
        workoutSessionStrengthSets {
          id
          reps
          weight
        }
      }
    }
  }
`);

export const Route = createFileRoute("/_authed/train/workouts/_split/$workoutId")({
  component: WorkoutDetailRoute,
});

type Workout = NonNullable<WorkoutDetailData["workout"]>;

const volumeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function WorkoutDetailRoute() {
  const { workoutId } = Route.useParams();
  const { user } = useAuth();
  const today = useLocalToday();
  const timeZone = localTimeZone();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["workouts", "detail", workoutId, today, timeZone, user?.id],
    queryFn: () =>
      gqlRequest(WorkoutDetailQuery, workoutDetailVariables(workoutId, today, timeZone)),
    enabled: !!user,
  });
  const startSession = useStartSession();

  if (isLoading) {
    return <DetailSkeleton />;
  }
  if (error) {
    return (
      <ErrorState
        title="Couldn't load this workout"
        message={error.message}
        onRetry={() => refetch()}
        isRetrying={isFetching}
      />
    );
  }
  const workout = data?.workout;
  if (!workout) {
    return (
      <EmptyState
        title="Workout not found"
        description="It may have been deleted or is not shared with you."
      />
    );
  }
  const canEdit = Boolean(user && workout.userId === user.id && !workout.isPublic);
  const history = data.workoutStrengthReport;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3.5 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="text-[22px] font-bold tracking-[-0.01em]">{workout.name}</h2>
            {workout.isPublic || workout.workoutLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {workout.isPublic ? <Tag>public</Tag> : null}
                {workout.workoutLabels.map((wl) => (
                  <Tag key={wl.labelId}>{wl.label.name}</Tag>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button asChild variant="outline">
                <Link to="/train/workouts/$workoutId/edit" params={{ workoutId: workout.id }}>
                  Edit
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={startSession.isPending || workout.workoutExercises.length === 0}
              onClick={() =>
                startSession.mutate({
                  workoutId: workout.id,
                  exercises: workout.workoutExercises.map((we) => ({
                    exerciseId: we.exercise.id,
                    position: we.position,
                  })),
                })
              }
            >
              {startSession.isPending ? <Loader2 className="animate-spin" /> : <Play />}
              Start session
            </Button>
          </div>
        </div>
        {history.length > 0 || workout.description ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-5">
            {history.length > 0 ? <VolumeBars rows={history} /> : null}
            {workout.description ? <Notes text={workout.description} /> : null}
          </div>
        ) : null}
      </section>
      <ExerciseTable workout={workout} />
    </div>
  );
}

function VolumeBars({ rows }: { rows: WorkoutDetailData["workoutStrengthReport"] }) {
  const points = [...rows].reverse().map((row) => ({
    id: row.sessionId,
    date: new Date(row.startedAt),
    volume: Number(row.volume ?? 0),
  }));
  const values = points.map((p) => p.volume);
  const max = Math.max(...values, 0) || 1;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-muted-foreground">
        Volume by session · past year
      </span>
      <ol
        className="grid h-36 auto-cols-[minmax(0,1fr)] grid-flow-col grid-rows-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1.5"
        aria-label={`Volume by session: ${points
          .map(
            (p) =>
              `${p.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${volumeFormat.format(p.volume)} kilograms`,
          )
          .join(", ")}`}
      >
        {points.map((point, index) => {
          const ratio = point.volume / max;
          const last = index === points.length - 1;
          return (
            <li
              key={point.id}
              className="row-span-3 grid min-w-0 grid-rows-subgrid justify-items-center"
            >
              <span className="max-w-full min-w-0 text-center text-[12px] font-semibold wrap-anywhere tabular-nums">
                {point.volume >= 1000
                  ? `${(point.volume / 1000).toFixed(1)}k`
                  : volumeFormat.format(point.volume)}
              </span>
              <div className="flex size-full items-end justify-center">
                <Link
                  to="/train/sessions/$sessionId"
                  params={{ sessionId: point.id }}
                  aria-hidden="true"
                  tabIndex={-1}
                  className={cn(
                    "w-full max-w-12 rounded-md transition-opacity hover:opacity-80",
                    last ? "bg-primary" : "bg-primary/50",
                  )}
                  style={{ height: `${ratio * 100}%` }}
                />
              </div>
              <span className="max-w-full min-w-0 text-center text-[12px] wrap-anywhere text-muted-foreground tabular-nums">
                {point.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Notes({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 320;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[13px] font-semibold text-muted-foreground">Notes</span>
      <div
        className={cn(
          "text-sm",
          long &&
            !expanded &&
            "max-h-36 overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)]",
        )}
      >
        <Markdown>{text}</Markdown>
      </div>
      {long ? (
        <button
          type="button"
          className="self-start text-sm font-medium text-link hover:underline"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show all notes"}
        </button>
      ) : null}
    </div>
  );
}

function ExerciseTable({ workout }: { workout: Workout }) {
  const exerciseIds = useMemo(
    () => workout.workoutExercises.map((we) => we.exercise.id),
    [workout.workoutExercises],
  );
  const { data } = useQuery({
    queryKey: ["workouts", "last-sets", workout.id, exerciseIds],
    queryFn: () => gqlRequest(WorkoutExerciseLastSetsQuery, { exerciseIds }),
    enabled: exerciseIds.length > 0,
  });
  const lastTop = useMemo(() => {
    const map = new Map<string, string>();
    for (const exercise of data?.exercises ?? []) {
      const latest = exercise.workoutSessionExercises[0];
      const label = latest ? formatTopSet(latest.workoutSessionStrengthSets) : null;
      if (label) {
        map.set(exercise.id, label);
      }
    }
    return map;
  }, [data]);

  if (workout.workoutExercises.length === 0) {
    return <EmptyState title="No exercises" description="Edit the workout to add exercises." />;
  }

  return (
    <section aria-label="Exercises" className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th scope="col" className="w-12 py-3 pl-4 font-semibold">
              <span className="sr-only">Image</span>
            </th>
            <th scope="col" className="px-3 font-semibold">
              Exercise
            </th>
            <th scope="col" className="hidden px-2 font-semibold sm:table-cell">
              Primary
            </th>
            <th scope="col" className="pr-4 text-right font-semibold">
              Last top set
            </th>
          </tr>
        </thead>
        <tbody>
          {workout.workoutExercises.map((we) => (
            <tr key={we.id} className="h-16 border-t">
              <td className="py-2 pl-4">
                <ExerciseThumbnail fileId={we.exercise.image1FileId} />
              </td>
              <td className="px-3 py-2">
                <Link
                  to="/train/exercises/$exerciseId"
                  params={{ exerciseId: we.exercise.id }}
                  className="flex min-w-0 flex-col font-medium hover:text-link"
                >
                  <span className="wrap-anywhere">{we.exercise.name}</span>
                  <span className="text-[12px] font-normal text-muted-foreground sm:hidden">
                    {formatMuscle(we.exercise.primaryMuscleGroup)}
                  </span>
                </Link>
              </td>
              <td className="hidden px-2 text-muted-foreground sm:table-cell">
                {formatMuscle(we.exercise.primaryMuscleGroup)}
                {we.exercise.strength?.doubleWeight ? " · per side" : ""}
              </td>
              <td className="pr-4 text-right font-semibold whitespace-nowrap">
                {we.exercise.kind === "cardio" ? "Cardio" : (lastTop.get(we.exercise.id) ?? "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-36 w-full" />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
