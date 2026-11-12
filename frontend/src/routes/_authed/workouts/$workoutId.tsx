import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Pencil, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { Markdown } from "@/components/markdown";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { AlternatingStorageImage } from "@/components/storage-image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import type { WorkoutDetailQuery as WorkoutDetailData } from "@/gql/graphql";
import { gqlRequest } from "@/lib/graphql";
import { useStartSession } from "@/lib/hooks/use-start-session";
import { useAuth } from "@/lib/nhost/auth-provider";
import { cn, formatMuscle } from "@/lib/utils";

const WorkoutDetailQuery = graphql(`
  query WorkoutDetail($id: uuid!) {
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
      strengthHistory(args: {}, order_by: { startedAt: desc }, limit: 6) {
        sessionId
        startedAt
        volume
        completedSets
      }
    }
  }
`);

// Latest sessions per exercise (Hasura applies `limit` per parent row).
const WorkoutExerciseLastSetsQuery = graphql(`
  query WorkoutExerciseLastSets($exerciseIds: [uuid!]!) {
    exercises(where: { id: { _in: $exerciseIds } }) {
      id
      workoutSessionExercises(limit: 3, order_by: { workoutSession: { startedAt: desc } }) {
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

export const Route = createFileRoute("/_authed/workouts/$workoutId")({
  component: WorkoutDetailRoute,
});

type Workout = NonNullable<WorkoutDetailData["workout"]>;

const volumeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function WorkoutDetailRoute() {
  const { workoutId } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["workouts", "detail", workoutId],
    queryFn: () => gqlRequest(WorkoutDetailQuery, { id: workoutId }),
  });
  const startSession = useStartSession();

  if (isLoading) {
    return <DetailSkeleton />;
  }
  if (error) {
    return <ErrorState title="Couldn't load this workout" message={error.message} />;
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
  const history = workout.strengthHistory ?? [];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="text-[22px] font-bold tracking-tight">{workout.name}</h2>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">
                {workout.isPublic ? "Public" : "Mine"}
              </span>
              {workout.workoutLabels.map((wl) => (
                <span
                  key={wl.labelId}
                  className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent-soft-foreground"
                >
                  {wl.label.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button asChild variant="outline">
                <Link to="/workouts/$workoutId/edit" params={{ workoutId: workout.id }}>
                  <Pencil />
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
          <div
            className={cn(
              "grid gap-5",
              history.length > 0 && workout.description && "md:grid-cols-2",
            )}
          >
            {history.length > 0 ? <VolumeBars rows={history} /> : null}
            {workout.description ? <Notes text={workout.description} /> : null}
          </div>
        ) : null}
      </section>
      <ExerciseTable workout={workout} />
    </div>
  );
}

function VolumeBars({ rows }: { rows: NonNullable<Workout["strengthHistory"]> }) {
  const points = [...rows].reverse().map((row) => ({
    id: row.sessionId,
    date: new Date(row.startedAt),
    volume: Number(row.volume ?? 0),
  }));
  const values = points.map((p) => p.volume);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = max - min || max;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-semibold text-muted-foreground">Volume by session</span>
      <ol
        className="flex h-36 items-end gap-3"
        aria-label={`Volume by session: ${points
          .map(
            (p) =>
              `${p.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${volumeFormat.format(p.volume)} kilograms`,
          )
          .join(", ")}`}
      >
        {points.map((point, index) => {
          const ratio = 0.3 + (0.7 * (point.volume - min)) / span;
          const last = index === points.length - 1;
          return (
            <li
              key={point.id}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="text-[12px] font-semibold tabular-nums">
                {point.volume >= 1000
                  ? `${(point.volume / 1000).toFixed(1)}k`
                  : volumeFormat.format(point.volume)}
              </span>
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: point.id }}
                aria-hidden="true"
                tabIndex={-1}
                className={cn(
                  "w-full max-w-12 rounded-md transition-opacity hover:opacity-80",
                  last ? "bg-primary" : "bg-primary/40",
                )}
                style={{ height: `${Math.round(ratio * 100)}%` }}
              />
              <span className="text-[12px] text-muted-foreground tabular-nums">
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

function topSetLabel(sets: { reps: number; weight: unknown }[]): string | null {
  let best: { reps: number; weight: number } | null = null;
  for (const set of sets) {
    const weight = Number(set.weight);
    if (!best || weight > best.weight || (weight === best.weight && set.reps > best.reps)) {
      best = { reps: set.reps, weight };
    }
  }
  if (!best) {
    return null;
  }
  return `${best.weight === 0 ? "BW" : `${best.weight} kg`} × ${best.reps}`;
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
      const latest = exercise.workoutSessionExercises.find(
        (row) => row.workoutSessionStrengthSets.length > 0,
      );
      const label = latest ? topSetLabel(latest.workoutSessionStrengthSets) : null;
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
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th scope="col" className="w-10 py-2.5 pl-4 font-medium">
              #
            </th>
            <th scope="col" className="font-medium">
              Exercise
            </th>
            <th scope="col" className="hidden font-medium sm:table-cell">
              Primary
            </th>
            <th scope="col" className="pr-4 text-right font-medium sm:text-left">
              Last top set
            </th>
          </tr>
        </thead>
        <tbody>
          {workout.workoutExercises.map((we, index) => (
            <tr key={we.id} className="border-t">
              <td className="py-2.5 pl-4 text-muted-foreground tabular-nums">{index + 1}</td>
              <td className="py-2 pr-3">
                <Link
                  to="/workouts/$workoutId/exercises/$exerciseId"
                  params={{ workoutId: workout.id, exerciseId: we.exercise.id }}
                  className="flex items-center gap-3 font-medium hover:text-link"
                >
                  <span className="block size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                    <AlternatingStorageImage
                      fileIds={[we.exercise.image1FileId, we.exercise.image2FileId]}
                      alt=""
                      className="h-full w-full"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{we.exercise.name}</span>
                    <span className="block text-[12px] font-normal text-muted-foreground sm:hidden">
                      {formatMuscle(we.exercise.primaryMuscleGroup)}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="hidden text-muted-foreground sm:table-cell">
                {formatMuscle(we.exercise.primaryMuscleGroup)}
                {we.exercise.strength?.doubleWeight ? " · per side" : ""}
              </td>
              <td className="pr-4 text-right whitespace-nowrap text-muted-foreground tabular-nums sm:text-left">
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
