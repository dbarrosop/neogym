import type { ResultOf } from "@graphql-typed-document-node/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flame, Hash, History, Loader2, Plus, Repeat2, Trash2, X } from "lucide-react";
import { Fragment, type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CardioEntriesList } from "@/components/cardio-entries-list";
import { CardioMetricsForm } from "@/components/cardio-metrics-form";
import { ExercisePicker, type PickerSelection } from "@/components/exercise-picker";
import { AlternatingStorageImage } from "@/components/storage-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import {
  asCardioMetricsSchema,
  type CardioMetrics,
  type CardioMetricsSchema,
  formatMetricValue,
  iterateMetrics,
} from "@/lib/cardio-schema";
import { gqlRequest } from "@/lib/graphql";
import { sessionDisplayName } from "@/lib/sessions";
import { formatMuscle } from "@/lib/utils";

const SessionDetailQuery = graphql(`
  query SessionDetail($id: uuid!) {
    workoutSession(id: $id) {
      id
      startedAt
      workout {
        id
        name
      }
      workoutSessionExercises(order_by: { position: asc }) {
        id
        position
        exercise {
          id
          name
          kind
          primaryMuscleGroup
          image1FileId
          image2FileId
          strength {
            doubleWeight
          }
          cardio {
            metricsSchema
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

// Hasura compiles nested array relationships with a lateral join, so `limit: 3`
// applies *per parent exercise*, not globally — exactly what we want here.
const PriorSessionsQuery = graphql(`
  query PriorSessionsPerExercise($exerciseIds: [uuid!]!, $excludeSessionId: uuid!) {
    exercises(where: { id: { _in: $exerciseIds } }) {
      id
      workoutSessionExercises(
        limit: 3
        order_by: { workoutSession: { startedAt: desc } }
        where: { workoutSessionId: { _neq: $excludeSessionId } }
      ) {
        id
        workoutSession {
          id
          startedAt
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

const InsertSetMutation = graphql(`
  mutation InsertWorkoutSessionStrengthSet($obj: workoutSessionStrengthSets_insert_input!) {
    insertWorkoutSessionStrengthSet(object: $obj) {
      id
    }
  }
`);

const UpdateSetMutation = graphql(`
  mutation UpdateWorkoutSessionStrengthSet(
    $id: uuid!
    $set: workoutSessionStrengthSets_set_input!
  ) {
    updateWorkoutSessionStrengthSet(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`);

const DeleteSetMutation = graphql(`
  mutation DeleteWorkoutSessionStrengthSet($id: uuid!) {
    deleteWorkoutSessionStrengthSet(id: $id) {
      id
    }
  }
`);

const InsertCardioEntryMutation = graphql(`
  mutation InsertWorkoutSessionCardioEntry($obj: workoutSessionCardioEntries_insert_input!) {
    insertWorkoutSessionCardioEntry(object: $obj) {
      id
    }
  }
`);

const UpdateCardioEntryMutation = graphql(`
  mutation UpdateWorkoutSessionCardioEntry(
    $id: uuid!
    $set: workoutSessionCardioEntries_set_input!
  ) {
    updateWorkoutSessionCardioEntry(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`);

const DeleteCardioEntryMutation = graphql(`
  mutation DeleteWorkoutSessionCardioEntry($id: uuid!) {
    deleteWorkoutSessionCardioEntry(id: $id) {
      id
    }
  }
`);

const UpdateSessionMutation = graphql(`
  mutation UpdateSessionStartedAt($id: uuid!, $startedAt: timestamptz!) {
    updateWorkoutSession(pk_columns: { id: $id }, _set: { startedAt: $startedAt }) {
      id
    }
  }
`);

const DeleteSessionMutation = graphql(`
  mutation DeleteWorkoutSession($id: uuid!) {
    deleteWorkoutSession(id: $id) {
      id
    }
  }
`);

const InsertSessionExercisesMutation = graphql(`
  mutation InsertWorkoutSessionExercises(
    $objs: [workoutSessionExercises_insert_input!]!
  ) {
    insertWorkoutSessionExercises(objects: $objs) {
      affected_rows
    }
  }
`);

const DeleteSessionExerciseMutation = graphql(`
  mutation DeleteWorkoutSessionExercise($id: uuid!) {
    deleteWorkoutSessionExercise(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/sessions/$sessionId")({
  component: SessionDetailRoute,
});

function SessionDetailRoute() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const queryKey = ["sessions", "detail", sessionId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => gqlRequest(SessionDetailQuery, { id: sessionId }),
  });

  const session = data?.workoutSession;

  const exerciseIds = useMemo(
    () => session?.workoutSessionExercises.map((we) => we.exercise.id) ?? [],
    [session],
  );

  // Prior history is decorative — silently degrade if it fails so the rest of the page stays usable.
  const { data: priorData } = useQuery({
    queryKey: ["sessions", "prior-per-exercise", sessionId, exerciseIds],
    queryFn: () =>
      gqlRequest(PriorSessionsQuery, {
        exerciseIds,
        excludeSessionId: sessionId,
      }),
    enabled: exerciseIds.length > 0,
  });

  const priorSessionsByExercise = useMemo(() => buildPriorSessionsMap(priorData), [priorData]);
  const priorCardioByExercise = useMemo(() => buildPriorCardioMap(priorData), [priorData]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["sessions", "index"] });
    queryClient.invalidateQueries({ queryKey: ["exercises", "detail"] });
  }

  const updateSessionMutation = useMutation({
    mutationFn: (vars: { startedAt: string }) =>
      gqlRequest(UpdateSessionMutation, { id: sessionId, startedAt: vars.startedAt }),
    onSuccess: () => {
      invalidateAll();
    },
    onError: (e) => toast.error(`Failed to update session: ${e.message}`),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteSessionMutation, { id: sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["exercises", "detail"] });
      // Replace — the session no longer exists, so back must skip its detail page.
      navigate({ to: "/sessions", replace: true });
    },
    onError: (e) => toast.error(`Failed to delete: ${e.message}`),
  });

  const addExercisesMutation = useMutation({
    mutationFn: (vars: { picks: PickerSelection[]; basePosition: number }) =>
      gqlRequest(InsertSessionExercisesMutation, {
        objs: vars.picks.map((p, i) => ({
          workoutSessionId: sessionId,
          exerciseId: p.exerciseId,
          position: vars.basePosition + i + 1,
        })),
      }),
    onSuccess: () => invalidateAll(),
    onError: (e) => toast.error(`Failed to add: ${e.message}`),
  });

  const removeExerciseMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteSessionExerciseMutation, { id }),
    onSuccess: () => invalidateAll(),
    onError: (e) => toast.error(`Failed to remove: ${e.message}`),
  });

  const totals = useMemo(() => {
    if (!session) {
      return { sets: 0, reps: 0, volume: 0 };
    }
    let sets = 0;
    let reps = 0;
    let volume = 0;
    for (const e of session.workoutSessionExercises) {
      if (e.exercise.kind === "cardio") {
        continue;
      }
      const m = e.exercise.strength?.doubleWeight ? 2 : 1;
      for (const s of e.workoutSessionStrengthSets) {
        sets += 1;
        reps += s.reps;
        volume += s.reps * Number(s.weight) * m;
      }
    }
    return { sets, reps, volume };
  }, [session]);

  const [editingDate, setEditingDate] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingRemoveExercise, setConfirmingRemoveExercise] = useState<{
    id: string;
    name: string;
    setCount: number;
  } | null>(null);

  const selectedExerciseIds = useMemo(
    () => new Set(session?.workoutSessionExercises.map((we) => we.exercise.id) ?? []),
    [session],
  );
  const maxPosition = useMemo(() => {
    const positions = session?.workoutSessionExercises.map((we) => we.position) ?? [];
    return positions.length > 0 ? Math.max(...positions) : 0;
  }, [session]);

  function renderContent() {
    if (isLoading) {
      return <DetailSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!session) {
      return <p className="text-sm text-muted-foreground">Session not found.</p>;
    }
    return (
      <>
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {sessionDisplayName({
              workoutName: session.workout?.name,
              exerciseNames: session.workoutSessionExercises.map((we) => we.exercise.name),
            })}
          </h1>
          <button
            type="button"
            onClick={() => setEditingDate(true)}
            className="text-left text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {new Date(session.startedAt).toLocaleString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </button>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Hash className="h-4 w-4" />} label="Sets" value={totals.sets} />
          <Stat icon={<Repeat2 className="h-4 w-4" />} label="Reps" value={totals.reps} />
          <Stat
            icon={<Flame className="h-4 w-4" />}
            label="Volume"
            value={`${formatVolume(totals.volume)} kg`}
          />
        </div>

        <div className="space-y-3">
          {session.workoutSessionExercises.map((we) => (
            <ExerciseRow
              key={we.id}
              sessionId={sessionId}
              we={we}
              priorSessionsByExercise={priorSessionsByExercise}
              priorCardioByExercise={priorCardioByExercise}
              onMutated={invalidateAll}
              onConfirmRemove={setConfirmingRemoveExercise}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setPickerOpen(true)}
            disabled={addExercisesMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            Add exercise
          </Button>
        </div>

        <div className="pt-4">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete session
          </Button>
        </div>

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="md:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add exercises</DialogTitle>
              <DialogDescription>
                Add to this session only. The original workout isn't changed.
              </DialogDescription>
            </DialogHeader>
            <ExercisePicker
              alreadySelected={selectedExerciseIds}
              onConfirm={(picks) => {
                if (picks.length === 0) {
                  setPickerOpen(false);
                  return;
                }
                addExercisesMutation.mutate(
                  { picks, basePosition: maxPosition },
                  { onSuccess: () => setPickerOpen(false) },
                );
              }}
              onCancel={() => setPickerOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!confirmingRemoveExercise}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmingRemoveExercise(null);
            }
          }}
          title={
            confirmingRemoveExercise
              ? `Remove ${confirmingRemoveExercise.name}?`
              : "Remove exercise?"
          }
          description={
            confirmingRemoveExercise && confirmingRemoveExercise.setCount > 0
              ? `${confirmingRemoveExercise.setCount} logged set${confirmingRemoveExercise.setCount === 1 ? "" : "s"} will be deleted with it. This can't be undone.`
              : "It will be removed from this session only."
          }
          confirmLabel="Remove"
          destructive
          isPending={removeExerciseMutation.isPending}
          onConfirm={() => {
            if (!confirmingRemoveExercise) {
              return;
            }
            removeExerciseMutation.mutate(confirmingRemoveExercise.id, {
              onSuccess: () => setConfirmingRemoveExercise(null),
            });
          }}
        />

        <EditDateDialog
          open={editingDate}
          onOpenChange={setEditingDate}
          startedAt={session.startedAt}
          onSave={(iso) => {
            updateSessionMutation.mutate(
              { startedAt: iso },
              { onSuccess: () => setEditingDate(false) },
            );
          }}
          isPending={updateSessionMutation.isPending}
        />

        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title="Delete this session?"
          description="All sets logged in this session will be permanently removed. This can't be undone."
          confirmLabel="Delete session"
          destructive
          isPending={deleteSessionMutation.isPending}
          onConfirm={() => deleteSessionMutation.mutate()}
        />
      </>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Session
        </p>
        {renderContent()}
      </div>
    </section>
  );
}

interface SetRow {
  id: string;
  setNumber: number;
  reps: number;
  weight: number | string;
}

interface PriorEntry {
  id: string;
  startedAt: string;
  sets: { reps: number; weight: number }[];
}

interface CardioEntryRow {
  id: string;
  entryNumber: number;
  metrics: CardioMetrics;
}

interface PriorCardioEntry {
  id: string;
  startedAt: string;
  entries: { entryNumber: number; metrics: CardioMetrics }[];
}

interface ExerciseLogProps {
  sessionId: string;
  workoutSessionExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  doubleWeight: boolean;
  image1FileId: string | null | undefined;
  image2FileId: string | null | undefined;
  sets: SetRow[];
  priorSessions: PriorEntry[];
  onMutated: () => void;
  onRequestRemove: () => void;
}

type SessionExerciseRow = NonNullable<
  ResultOf<typeof SessionDetailQuery>["workoutSession"]
>["workoutSessionExercises"][number];

interface ExerciseRowProps {
  sessionId: string;
  we: SessionExerciseRow;
  priorSessionsByExercise: Map<string, PriorEntry[]>;
  priorCardioByExercise: Map<string, PriorCardioEntry[]>;
  onMutated: () => void;
  onConfirmRemove: (info: { id: string; name: string; setCount: number }) => void;
}

function ExerciseRow({
  sessionId,
  we,
  priorSessionsByExercise,
  priorCardioByExercise,
  onMutated,
  onConfirmRemove,
}: ExerciseRowProps) {
  const isCardio = we.exercise.kind === "cardio";
  const cardioSchema = isCardio ? asCardioMetricsSchema(we.exercise.cardio?.metricsSchema) : null;
  const entryCount = isCardio
    ? we.workoutSessionCardioEntries.length
    : we.workoutSessionStrengthSets.length;
  const onRequestRemove = () =>
    onConfirmRemove({ id: we.id, name: we.exercise.name, setCount: entryCount });

  // Memoize on the raw query slice so the reference stays stable when
  // react-query's structural sharing returns the same data — without this,
  // every parent rerender (window-focus refetch on PWA resume, mutation
  // invalidation) produces a fresh array, which propagates into
  // CardioMetricsForm's seeding effect and wipes in-flight input.
  const cardioEntries = useMemo<CardioEntryRow[]>(
    () =>
      we.workoutSessionCardioEntries.map((e) => ({
        id: e.id,
        entryNumber: e.entryNumber,
        metrics: (e.metrics ?? {}) as CardioMetrics,
      })),
    [we.workoutSessionCardioEntries],
  );

  if (isCardio && cardioSchema) {
    return (
      <CardioExerciseLog
        sessionId={sessionId}
        workoutSessionExerciseId={we.id}
        exerciseId={we.exercise.id}
        exerciseName={we.exercise.name}
        primaryMuscle={we.exercise.primaryMuscleGroup}
        image1FileId={we.exercise.image1FileId}
        image2FileId={we.exercise.image2FileId}
        schema={cardioSchema}
        entries={cardioEntries}
        priorEntries={priorCardioByExercise.get(we.exercise.id) ?? []}
        onMutated={onMutated}
        onRequestRemove={onRequestRemove}
      />
    );
  }
  // Cardio exercise with a missing/malformed metrics schema. Falling through to
  // <ExerciseLog> would render a strength UI whose "Add set" insert FK-fails
  // (parent_kind='strength' cannot attach to a cardio session-exercise). Show a
  // friendly placeholder + the remove control instead.
  if (isCardio) {
    return (
      <CardioMissingSchema
        sessionId={sessionId}
        exerciseId={we.exercise.id}
        exerciseName={we.exercise.name}
        primaryMuscle={we.exercise.primaryMuscleGroup}
        image1FileId={we.exercise.image1FileId}
        image2FileId={we.exercise.image2FileId}
        onRequestRemove={onRequestRemove}
      />
    );
  }
  return (
    <ExerciseLog
      sessionId={sessionId}
      workoutSessionExerciseId={we.id}
      exerciseId={we.exercise.id}
      exerciseName={we.exercise.name}
      primaryMuscle={we.exercise.primaryMuscleGroup}
      doubleWeight={we.exercise.strength?.doubleWeight ?? false}
      image1FileId={we.exercise.image1FileId}
      image2FileId={we.exercise.image2FileId}
      sets={we.workoutSessionStrengthSets}
      priorSessions={priorSessionsByExercise.get(we.exercise.id) ?? []}
      onMutated={onMutated}
      onRequestRemove={onRequestRemove}
    />
  );
}

interface CardioMissingSchemaProps {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  image1FileId: string | null | undefined;
  image2FileId: string | null | undefined;
  onRequestRemove: () => void;
}

function CardioMissingSchema({
  sessionId,
  exerciseId,
  exerciseName,
  primaryMuscle,
  image1FileId,
  image2FileId,
  onRequestRemove,
}: CardioMissingSchemaProps) {
  return (
    <Card className="border-border/60 supports-[backdrop-filter]:bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <Link
          to="/sessions/$sessionId/exercises/$exerciseId"
          params={{ sessionId, exerciseId }}
          className="border-border/60 bg-muted block h-12 w-12 shrink-0 overflow-hidden rounded-md border"
        >
          <AlternatingStorageImage
            fileIds={[image1FileId, image2FileId]}
            alt={exerciseName}
            className="h-full w-full"
          />
        </Link>
        <div className="min-w-0 flex-1 space-y-0.5">
          <Link
            to="/sessions/$sessionId/exercises/$exerciseId"
            params={{ sessionId, exerciseId }}
            className="block truncate font-medium underline-offset-2 hover:underline"
          >
            {exerciseName}
          </Link>
          <p className="text-muted-foreground text-xs">{formatMuscle(primaryMuscle)}</p>
        </div>
        <Badge variant="outline">Cardio</Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0"
          aria-label={`Remove ${exerciseName} from session`}
          onClick={onRequestRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <p className="text-muted-foreground rounded-md border border-dashed border-border/40 bg-muted/30 px-3 py-2 text-xs">
          This cardio exercise is missing its metrics schema, so entries can't be logged here. An
          admin needs to configure it before this exercise can be used.
        </p>
      </CardContent>
    </Card>
  );
}

function ExerciseLog({
  sessionId,
  workoutSessionExerciseId,
  exerciseId,
  exerciseName,
  primaryMuscle,
  doubleWeight,
  image1FileId,
  image2FileId,
  sets,
  priorSessions,
  onMutated,
  onRequestRemove,
}: ExerciseLogProps) {
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; set: SetRow } | null>(
    null,
  );

  const insertMutation = useMutation({
    mutationFn: (vars: { setNumber: number; reps: number; weight: number }) =>
      gqlRequest(InsertSetMutation, {
        obj: {
          workoutSessionExerciseId,
          setNumber: vars.setNumber,
          reps: vars.reps,
          weight: vars.weight,
        },
      }),
    onSuccess: () => {
      onMutated();
      setDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; reps: number; weight: number }) =>
      gqlRequest(UpdateSetMutation, {
        id: vars.id,
        set: { reps: vars.reps, weight: vars.weight },
      }),
    onSuccess: () => {
      onMutated();
      setDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteSetMutation, { id }),
    onSuccess: () => {
      onMutated();
      setDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const isPending =
    insertMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const lastSet = sets[sets.length - 1];

  return (
    <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <Link
          to="/sessions/$sessionId/exercises/$exerciseId"
          params={{ sessionId, exerciseId }}
          className="block h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted"
        >
          <AlternatingStorageImage
            fileIds={[image1FileId, image2FileId]}
            alt={exerciseName}
            className="h-full w-full"
          />
        </Link>
        <div className="min-w-0 flex-1 space-y-0.5">
          <Link
            to="/sessions/$sessionId/exercises/$exerciseId"
            params={{ sessionId, exerciseId }}
            className="block truncate font-medium underline-offset-2 hover:underline"
          >
            {exerciseName}
          </Link>
          <p className="text-xs text-muted-foreground">{formatMuscle(primaryMuscle)}</p>
        </div>
        {doubleWeight ? <Badge variant="outline">Two-handed</Badge> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${exerciseName} from session`}
          onClick={onRequestRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {sets.length === 0 ? (
          <p className="px-1 text-xs italic text-muted-foreground">No sets logged yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {sets.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setDialog({ mode: "edit", set: s })}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/50"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground">
                    {s.setNumber}
                  </span>
                  <span className="flex-1 text-sm tabular-nums">
                    <span className="font-medium">
                      {Number(s.weight) === 0 ? "BW" : `${Number(s.weight)} kg`}
                    </span>
                    <span className="px-2 text-muted-foreground">×</span>
                    <span className="font-medium">{s.reps}</span>
                    {doubleWeight && Number(s.weight) > 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">/side</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <PriorSessionsSummary entries={priorSessions} doubleWeight={doubleWeight} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setDialog({ mode: "add" })}
          disabled={isPending}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add set
        </Button>
      </CardContent>

      <SetDialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
          }
        }}
        mode={dialog?.mode ?? "add"}
        editingSet={dialog?.mode === "edit" ? dialog.set : null}
        previousSet={lastSet ?? null}
        doubleWeight={doubleWeight}
        exerciseName={exerciseName}
        nextSetNumber={(lastSet?.setNumber ?? 0) + 1}
        isPending={isPending}
        onSubmit={({ reps, weight }) => {
          if (dialog?.mode === "edit") {
            updateMutation.mutate({ id: dialog.set.id, reps, weight });
          } else {
            const setNumber = (lastSet?.setNumber ?? 0) + 1;
            insertMutation.mutate({ setNumber, reps, weight });
          }
        }}
        onDelete={dialog?.mode === "edit" ? () => deleteMutation.mutate(dialog.set.id) : undefined}
      />
    </Card>
  );
}

function PriorSessionsSummary({
  entries,
  doubleWeight,
}: {
  entries: PriorEntry[];
  doubleWeight: boolean;
}) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="mt-1 space-y-1 rounded-md border border-border/40 bg-muted/30 px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        <History className="h-3 w-3" />
        Recent
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
        {entries.map((entry) => {
          const hasWeight = entry.sets.some((s) => s.weight > 0);
          return (
            <Fragment key={entry.id}>
              <dt className="text-muted-foreground/70">{formatPriorDate(entry.startedAt)}</dt>
              <dd className="min-w-0 truncate">
                {entry.sets.length === 0 ? (
                  <span className="italic text-muted-foreground/60">no sets</span>
                ) : (
                  <>
                    {entry.sets.map(formatPriorSet).join(", ")}
                    {doubleWeight && hasWeight ? (
                      <span className="ml-1 text-muted-foreground/60">/side</span>
                    ) : null}
                  </>
                )}
              </dd>
            </Fragment>
          );
        })}
      </dl>
    </div>
  );
}

function buildPriorSessionsMap(
  data: ResultOf<typeof PriorSessionsQuery> | undefined,
): Map<string, PriorEntry[]> {
  const map = new Map<string, PriorEntry[]>();
  for (const e of data?.exercises ?? []) {
    map.set(
      e.id,
      e.workoutSessionExercises.map((wse) => ({
        id: wse.id,
        startedAt: wse.workoutSession.startedAt,
        sets: wse.workoutSessionStrengthSets.map((s) => ({
          reps: s.reps,
          weight: Number(s.weight),
        })),
      })),
    );
  }
  return map;
}

function buildPriorCardioMap(
  data: ResultOf<typeof PriorSessionsQuery> | undefined,
): Map<string, PriorCardioEntry[]> {
  const map = new Map<string, PriorCardioEntry[]>();
  for (const e of data?.exercises ?? []) {
    map.set(
      e.id,
      e.workoutSessionExercises.map((wse) => ({
        id: wse.id,
        startedAt: wse.workoutSession.startedAt,
        entries: wse.workoutSessionCardioEntries.map((entry) => ({
          entryNumber: entry.entryNumber,
          metrics: (entry.metrics ?? {}) as CardioMetrics,
        })),
      })),
    );
  }
  return map;
}

function formatPriorDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function formatPriorSet(s: { reps: number; weight: number }): string {
  if (s.weight === 0) {
    return `${s.reps}×BW`;
  }
  return `${s.reps}×${s.weight}kg`;
}

interface SetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  editingSet: SetRow | null;
  previousSet: SetRow | null;
  doubleWeight: boolean;
  exerciseName: string;
  nextSetNumber: number;
  isPending: boolean;
  onSubmit: (vars: { reps: number; weight: number }) => void;
  onDelete: (() => void) | undefined;
}

function SetDialog({
  open,
  onOpenChange,
  mode,
  editingSet,
  previousSet,
  doubleWeight,
  exerciseName,
  nextSetNumber,
  isPending,
  onSubmit,
  onDelete,
}: SetDialogProps) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const weightInputRef = useRef<HTMLInputElement | null>(null);

  // Reset values when dialog opens.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === "edit" && editingSet) {
      setWeight(String(Number(editingSet.weight)));
      setReps(String(editingSet.reps));
    } else if (previousSet) {
      setWeight(String(Number(previousSet.weight)));
      setReps(String(previousSet.reps));
    } else {
      setWeight("");
      setReps("");
    }
    // Focus weight input after dialog mounts
    requestAnimationFrame(() => weightInputRef.current?.select());
  }, [open, mode, editingSet, previousSet]);

  const submitLabel = mode === "edit" ? "Save" : "Log set";

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const w = Number(weight.replace(",", "."));
    const r = Number(reps);
    if (!Number.isFinite(w) || w < 0) {
      toast.error("Weight must be a number ≥ 0");
      return;
    }
    if (!Number.isFinite(r) || r < 0 || !Number.isInteger(r)) {
      toast.error("Reps must be a whole number ≥ 0");
      return;
    }
    onSubmit({ weight: w, reps: r });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit"
              ? `Edit set ${editingSet?.setNumber ?? ""}`
              : `Add set ${nextSetNumber}`}
          </DialogTitle>
          <DialogDescription>{exerciseName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="set-weight" className="text-xs">
                Weight (kg){doubleWeight ? " · per side" : ""}
              </Label>
              <Input
                id="set-weight"
                ref={weightInputRef}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="text-right tabular-nums"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-reps" className="text-xs">
                Reps
              </Label>
              <Input
                id="set-reps"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="text-right tabular-nums"
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                onClick={onDelete}
                disabled={isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startedAt: string;
  onSave: (iso: string) => void;
  isPending: boolean;
}

function EditDateDialog({ open, onOpenChange, startedAt, onSave, isPending }: EditDateDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      setValue(toLocalInput(new Date(startedAt)));
    }
  }, [open, startedAt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit session date</DialogTitle>
          <DialogDescription>Adjust when this session started.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="started-at" className="text-xs">
            Started at
          </Label>
          <Input
            id="started-at"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onSave(new Date(value).toISOString())}
            disabled={isPending || !value}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  isPending,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <CardContent className="space-y-1 px-3 py-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatVolume(v: number) {
  if (v >= 1000) {
    return `${(v / 1000).toFixed(1)}k`;
  }
  return v.toFixed(0);
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DetailSkeleton() {
  return (
    <>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </>
  );
}

interface CardioExerciseLogProps {
  sessionId: string;
  workoutSessionExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  image1FileId: string | null | undefined;
  image2FileId: string | null | undefined;
  schema: CardioMetricsSchema;
  entries: CardioEntryRow[];
  priorEntries: PriorCardioEntry[];
  onMutated: () => void;
  onRequestRemove: () => void;
}

function CardioExerciseLog({
  sessionId,
  workoutSessionExerciseId,
  exerciseId,
  exerciseName,
  primaryMuscle,
  image1FileId,
  image2FileId,
  schema,
  entries,
  priorEntries,
  onMutated,
  onRequestRemove,
}: CardioExerciseLogProps) {
  const [dialog, setDialog] = useState<
    { mode: "add" } | { mode: "edit"; entry: CardioEntryRow } | null
  >(null);

  const insertMutation = useMutation({
    mutationFn: (vars: { entryNumber: number; metrics: CardioMetrics }) =>
      gqlRequest(InsertCardioEntryMutation, {
        obj: {
          workoutSessionExerciseId,
          entryNumber: vars.entryNumber,
          metrics: vars.metrics,
        },
      }),
    onSuccess: () => {
      onMutated();
      setDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; metrics: CardioMetrics }) =>
      gqlRequest(UpdateCardioEntryMutation, {
        id: vars.id,
        set: { metrics: vars.metrics },
      }),
    onSuccess: () => {
      onMutated();
      setDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteCardioEntryMutation, { id }),
    onSuccess: () => {
      onMutated();
      setDialog(null);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const isPending =
    insertMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const lastEntry = entries[entries.length - 1];
  const previousMetrics = lastEntry?.metrics ?? null;
  const nextEntryNumber = (lastEntry?.entryNumber ?? 0) + 1;

  return (
    <Card className="border-border/60 supports-[backdrop-filter]:bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <Link
          to="/sessions/$sessionId/exercises/$exerciseId"
          params={{ sessionId, exerciseId }}
          className="border-border/60 bg-muted block h-12 w-12 shrink-0 overflow-hidden rounded-md border"
        >
          <AlternatingStorageImage
            fileIds={[image1FileId, image2FileId]}
            alt={exerciseName}
            className="h-full w-full"
          />
        </Link>
        <div className="min-w-0 flex-1 space-y-0.5">
          <Link
            to="/sessions/$sessionId/exercises/$exerciseId"
            params={{ sessionId, exerciseId }}
            className="block truncate font-medium underline-offset-2 hover:underline"
          >
            {exerciseName}
          </Link>
          <p className="text-muted-foreground text-xs">{formatMuscle(primaryMuscle)}</p>
        </div>
        <Badge variant="outline">Cardio</Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0"
          aria-label={`Remove ${exerciseName} from session`}
          onClick={onRequestRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        <CardioEntriesList
          entries={entries}
          schema={schema}
          onSelect={(entry) => setDialog({ mode: "edit", entry })}
        />
        <CardioPriorSummary entries={priorEntries} schema={schema} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setDialog({ mode: "add" })}
          disabled={isPending}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add entry
        </Button>
      </CardContent>

      <CardioMetricsForm
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
          }
        }}
        mode={dialog?.mode ?? "add"}
        schema={schema}
        exerciseName={exerciseName}
        nextEntryNumber={nextEntryNumber}
        editingEntryNumber={dialog?.mode === "edit" ? dialog.entry.entryNumber : null}
        initialMetrics={dialog?.mode === "edit" ? dialog.entry.metrics : null}
        previousMetrics={previousMetrics}
        isPending={isPending}
        onSubmit={(metrics) => {
          if (dialog?.mode === "edit") {
            updateMutation.mutate({ id: dialog.entry.id, metrics });
          } else {
            insertMutation.mutate({ entryNumber: nextEntryNumber, metrics });
          }
        }}
        {...(dialog?.mode === "edit"
          ? { onDelete: () => deleteMutation.mutate(dialog.entry.id) }
          : {})}
      />
    </Card>
  );
}

function CardioPriorSummary({
  entries,
  schema,
}: {
  entries: PriorCardioEntry[];
  schema: CardioMetricsSchema;
}) {
  const filtered = entries.filter((e) => e.entries.length > 0);
  if (filtered.length === 0) {
    return null;
  }
  const specs = iterateMetrics(schema);
  const primary = specs[0];
  if (!primary) {
    return null;
  }
  return (
    <div className="border-border/40 bg-muted/30 mt-1 space-y-1 rounded-md border px-2.5 py-2">
      <p className="text-muted-foreground/70 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
        <History className="h-3 w-3" />
        Recent
      </p>
      <dl className="text-muted-foreground grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs tabular-nums">
        {filtered.map((entry) => {
          const summary = entry.entries
            .map((e) => formatMetricValue(e.metrics[primary.key], primary))
            .join(", ");
          return (
            <Fragment key={entry.id}>
              <dt className="text-muted-foreground/70">{formatPriorDate(entry.startedAt)}</dt>
              <dd className="min-w-0 truncate">{summary}</dd>
            </Fragment>
          );
        })}
      </dl>
    </div>
  );
}
