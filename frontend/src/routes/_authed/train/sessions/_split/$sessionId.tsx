import type { ResultOf } from "@graphql-typed-document-node/core";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Dumbbell, Loader2, Plus, Trash2 } from "lucide-react";
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CardioEntriesList } from "@/components/cardio-entries-list";
import { CardioMetricsForm } from "@/components/cardio-metrics-form";
import { CardioTag } from "@/components/exercise-kind-tag";
import { ExercisePicker, type PickerSelection } from "@/components/exercise-picker";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Tag } from "@/components/patterns/tag";
import {
  CardFootnote,
  type CardHeaderInfo,
  CollapsedExercise,
  ExerciseMedia,
  LoggedSetsTable,
  NextSetForm,
  OpenCard,
  OpenCardHeader,
  type RecentRow,
  type SetRow,
} from "@/components/session-exercise-card";
import { StartRestButton } from "@/components/shell/rest-timer";
import { Button } from "@/components/ui/button";
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
} from "@/lib/cardio-schema";
import { gqlRequest } from "@/lib/graphql";
import { useRestTimer } from "@/lib/rest-timer";
import {
  addExercisesDescription,
  cardioLastTimeCaption,
  exerciseStatus,
  removeExerciseDescription,
  type SessionChildNoun,
  summarizeCardioEntries,
} from "@/lib/session-logging";
import { sessionDisplayName } from "@/lib/sessions";
import { formatLastTimeCaption, formatSetsSummary } from "@/lib/set-summary";

const SessionDetailQuery = graphql(`
  query SessionDetail($id: uuid!) {
    workoutSession(id: $id) {
      id
      startedAt
      workoutId
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

// Limits apply per exercise. Query the same workout separately so its last
// logged occurrence cannot be displaced by newer history from other workouts.
const PriorSessionsQuery = graphql(`
  query PriorSessionsPerExercise(
    $exerciseIds: [uuid!]!
    $before: timestamptz!
    $workoutId: uuid
    $hasWorkout: Boolean!
  ) {
    exercises(where: { id: { _in: $exerciseIds } }) {
      id
      workoutSessionExercises(
        limit: 3
        order_by: { workoutSession: { startedAt: desc } }
        where: {
          workoutSession: { startedAt: { _lt: $before } }
          _or: [{ workoutSessionStrengthSets: {} }, { workoutSessionCardioEntries: {} }]
        }
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
      sameWorkoutSessions: workoutSessionExercises(
        limit: 3
        order_by: { workoutSession: { startedAt: desc } }
        where: {
          workoutSession: { startedAt: { _lt: $before }, workoutId: { _eq: $workoutId } }
          _or: [{ workoutSessionStrengthSets: {} }, { workoutSessionCardioEntries: {} }]
        }
      ) @include(if: $hasWorkout) {
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

const EarlierWorkoutSessionsQuery = graphql(`
  query EarlierWorkoutSessions($workoutId: uuid!, $before: timestamptz!) {
    workoutSessions(
      where: { workoutId: { _eq: $workoutId }, startedAt: { _lt: $before } }
      order_by: { startedAt: desc }
      limit: 3
    ) {
      id
      startedAt
      workoutSessionExercises {
        id
        exercise {
          id
          strength {
            doubleWeight
          }
        }
        workoutSessionStrengthSets {
          id
          reps
          weight
        }
      }
    }
  }
`);

export const Route = createFileRoute("/_authed/train/sessions/_split/$sessionId")({
  component: SessionDetailRoute,
});

const volumeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function invalidateSessionReports(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["exercises", "detail"] });
  queryClient.invalidateQueries({ queryKey: ["workouts", "detail"] });
  queryClient.invalidateQueries({ queryKey: ["workouts", "last-sets"] });
  queryClient.invalidateQueries({ queryKey: ["today"] });
  queryClient.invalidateQueries({ queryKey: ["progress"] });
}

type SessionDetail = NonNullable<ResultOf<typeof SessionDetailQuery>["workoutSession"]>;
type SessionExerciseRow = SessionDetail["workoutSessionExercises"][number];

interface RemoveRequest {
  id: string;
  name: string;
  childCount: number;
  childNoun: SessionChildNoun;
}

function useSessionMutations(sessionId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["sessions", "index"] });
    invalidateSessionReports(queryClient);
    return queryClient.invalidateQueries({ queryKey: ["sessions", "detail", sessionId] });
  }

  const updateSession = useMutation({
    mutationFn: (vars: { startedAt: string }) =>
      gqlRequest(UpdateSessionMutation, { id: sessionId, startedAt: vars.startedAt }),
    onSuccess: () => void invalidateAll(),
    onError: (e) => toast.error(`Failed to update session: ${e.message}`),
  });

  const deleteSession = useMutation({
    mutationFn: () => gqlRequest(DeleteSessionMutation, { id: sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      invalidateSessionReports(queryClient);
      // Replace — the session no longer exists, so back must skip its detail page.
      navigate({ to: "/train/sessions", replace: true });
    },
    onError: (e) => toast.error(`Failed to delete: ${e.message}`),
  });

  const addExercises = useMutation({
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

  const removeExercise = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteSessionExerciseMutation, { id }),
    onSuccess: () => invalidateAll(),
    onError: (e) => toast.error(`Failed to remove: ${e.message}`),
  });

  return { invalidateAll, updateSession, deleteSession, addExercises, removeExercise };
}

function SessionDetailRoute() {
  const { sessionId } = Route.useParams();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["sessions", "detail", sessionId],
    queryFn: () => gqlRequest(SessionDetailQuery, { id: sessionId }),
  });
  const session = data?.workoutSession;

  const exerciseIds = useMemo(
    () => session?.workoutSessionExercises.map((we) => we.exercise.id) ?? [],
    [session],
  );

  // History provides logging hints, not a required target. Keep logging usable if it fails.
  const { startedAt: before, workoutId } = session ?? {};
  const { data: priorData } = useQuery({
    queryKey: ["sessions", "prior-per-exercise", sessionId, exerciseIds, before, workoutId],
    queryFn: () =>
      gqlRequest(PriorSessionsQuery, {
        exerciseIds,
        before: before ?? "",
        workoutId: workoutId ?? null,
        hasWorkout: !!workoutId,
      }),
    enabled: !!session && exerciseIds.length > 0,
  });

  const priorSessionsByExercise = useMemo(() => buildPriorSessionsMap(priorData), [priorData]);
  const priorCardioByExercise = useMemo(() => buildPriorCardioMap(priorData), [priorData]);
  const mutations = useSessionMutations(sessionId);

  const totals = useMemo(() => sessionTotals(session), [session]);
  // Open the first exercise below last time's count. Without a nonempty
  // reference, keep it open for repeated logging; manual toggles still win.
  const defaultActiveId = useMemo(
    () => defaultActiveExerciseId(session, priorSessionsByExercise, priorCardioByExercise),
    [session, priorSessionsByExercise, priorCardioByExercise],
  );
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});
  const [editingDate, setEditingDate] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<RemoveRequest | null>(null);

  if (isLoading) {
    return <DetailSkeleton />;
  }
  if (error) {
    return (
      <ErrorState
        title="Couldn't load this session"
        message={error.message}
        onRetry={() => refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!session) {
    return (
      <EmptyState
        title="Session not found"
        description="It may have been deleted. Pick another session from the list."
      />
    );
  }

  const name = sessionDisplayName({
    workoutName: session.workout?.name,
    exerciseNames: session.workoutSessionExercises.map((we) => we.exercise.name),
  });
  const fromWorkout = !!session.workoutId;

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader
        sessionId={sessionId}
        name={name}
        startedAt={session.startedAt}
        workout={session.workout ?? null}
        onEditDate={() => setEditingDate(true)}
        onAddExercise={() => setPickerOpen(true)}
        isAdding={mutations.addExercises.isPending}
      />
      {totals.hasStrength ? <SessionTotals totals={totals} /> : null}

      <div className="flex flex-col gap-3">
        {session.workoutSessionExercises.map((we) => {
          const expanded = expandedOverrides[we.id] ?? we.id === defaultActiveId;
          return (
            <ExerciseRow
              key={we.id}
              we={we}
              sessionId={sessionId}
              expanded={expanded}
              onToggle={() =>
                setExpandedOverrides((current) => ({ ...current, [we.id]: !expanded }))
              }
              priorSessionsByExercise={priorSessionsByExercise}
              priorCardioByExercise={priorCardioByExercise}
              onMutated={mutations.invalidateAll}
              onConfirmRemove={setConfirmingRemove}
            />
          );
        })}
        {session.workoutSessionExercises.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No exercises yet"
            description="Add exercises to this session to start logging sets."
            actions={
              <Button type="button" onClick={() => setPickerOpen(true)}>
                <Plus />
                Add exercise
              </Button>
            }
          />
        ) : null}
      </div>

      {session.workout ? (
        <EarlierWorkoutSessions
          workoutId={session.workout.id}
          workoutName={session.workout.name}
          sessionId={sessionId}
          before={session.startedAt}
        />
      ) : null}

      <div>
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 />
          Delete session
        </Button>
      </div>

      <AddExercisesDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        fromWorkout={fromWorkout}
        alreadySelected={new Set(exerciseIds)}
        onConfirm={(picks) => {
          if (picks.length === 0) {
            setPickerOpen(false);
            return;
          }
          mutations.addExercises.mutate(
            { picks, basePosition: maxPosition(session) },
            { onSuccess: () => setPickerOpen(false) },
          );
        }}
      />

      <ConfirmActionDialog
        open={!!confirmingRemove}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingRemove(null);
          }
        }}
        title={confirmingRemove ? `Remove ${confirmingRemove.name}?` : "Remove exercise?"}
        description={
          confirmingRemove ? removeExerciseDescription({ ...confirmingRemove, fromWorkout }) : null
        }
        confirmLabel="Remove exercise"
        pendingLabel="Removing…"
        destructive
        isPending={mutations.removeExercise.isPending}
        onConfirm={() => {
          if (confirmingRemove) {
            mutations.removeExercise.mutate(confirmingRemove.id, {
              onSuccess: () => setConfirmingRemove(null),
            });
          }
        }}
      />

      <EditDateDialog
        open={editingDate}
        onOpenChange={setEditingDate}
        startedAt={session.startedAt}
        onSave={(iso) => {
          mutations.updateSession.mutate(
            { startedAt: iso },
            { onSuccess: () => setEditingDate(false) },
          );
        }}
        isPending={mutations.updateSession.isPending}
      />

      <ConfirmActionDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this session?"
        description="All sets logged in this session will be permanently removed. This can't be undone."
        confirmLabel="Delete session"
        pendingLabel="Deleting…"
        destructive
        isPending={mutations.deleteSession.isPending}
        onConfirm={() => mutations.deleteSession.mutate()}
      />
    </div>
  );
}

function maxPosition(session: SessionDetail): number {
  const positions = session.workoutSessionExercises.map((we) => we.position);
  return positions.length > 0 ? Math.max(...positions) : 0;
}

function sessionTotals(session: SessionDetail | null | undefined) {
  let sets = 0;
  let reps = 0;
  let volume = 0;
  let hasStrength = false;
  for (const e of session?.workoutSessionExercises ?? []) {
    if (e.exercise.kind === "cardio") {
      continue;
    }
    hasStrength = true;
    const m = e.exercise.strength?.doubleWeight ? 2 : 1;
    for (const s of e.workoutSessionStrengthSets) {
      sets += 1;
      reps += s.reps;
      volume += s.reps * Number(s.weight) * m;
    }
  }
  return { sets, reps, volume, hasStrength };
}

function defaultActiveExerciseId(
  session: SessionDetail | null | undefined,
  priorSessionsByExercise: Map<string, PriorEntry[]>,
  priorCardioByExercise: Map<string, PriorCardioEntry[]>,
): string | null {
  for (const we of session?.workoutSessionExercises ?? []) {
    const isCardio = we.exercise.kind === "cardio";
    const count = isCardio
      ? we.workoutSessionCardioEntries.length
      : we.workoutSessionStrengthSets.length;
    const referenceCount = isCardio
      ? priorCardioByExercise.get(we.exercise.id)?.[0]?.entries.length
      : priorSessionsByExercise.get(we.exercise.id)?.[0]?.sets.length;
    if (exerciseStatus(count, referenceCount) !== "done") {
      return we.id;
    }
  }
  return null;
}

function SessionHeader({
  sessionId,
  name,
  startedAt,
  workout,
  onEditDate,
  onAddExercise,
  isAdding,
}: {
  sessionId: string;
  name: string;
  startedAt: string;
  workout: { id: string; name: string } | null;
  onEditDate: () => void;
  onAddExercise: () => void;
  isAdding: boolean;
}) {
  const started = new Date(startedAt);
  const sameYear = started.getFullYear() === new Date().getFullYear();
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[22px] font-bold tracking-[-0.01em]">{name}</h2>
        <p className="text-[13px] text-muted-foreground">
          <span className="tabular-nums">
            {started.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
              ...(sameYear ? {} : { year: "numeric" }),
            })}{" "}
            · started{" "}
            {started.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
          {" · "}
          <button type="button" onClick={onEditDate} className="text-link hover:underline">
            Edit date
          </button>
          {workout ? (
            <>
              {" · from workout "}
              <Link
                to="/train/workouts/$workoutId"
                params={{ workoutId: workout.id }}
                className="text-link hover:underline"
              >
                {workout.name}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StartRestButton sessionId={sessionId} />
        <Button type="button" variant="outline" onClick={onAddExercise} disabled={isAdding}>
          <Plus />
          Add exercise
        </Button>
      </div>
    </header>
  );
}

function SessionTotals({ totals }: { totals: { sets: number; reps: number; volume: number } }) {
  const cells = [
    ["sets", String(totals.sets)],
    ["reps", String(totals.reps)],
    ["volume", `${volumeFormat.format(totals.volume)} kg`],
  ] as const;
  return (
    <dl className="grid grid-cols-3 rounded-xl border bg-card py-3.5">
      {cells.map(([label, value]) => (
        <div
          key={label}
          className="flex min-w-0 flex-col items-center px-2 [&:nth-child(2)]:border-x"
        >
          <dt className="order-2 text-[13px] text-muted-foreground">{label}</dt>
          <dd className="text-lg font-bold whitespace-nowrap tabular-nums sm:text-xl">{value}</dd>
        </div>
      ))}
    </dl>
  );
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

interface ExerciseRowProps {
  we: SessionExerciseRow;
  sessionId: string;
  expanded: boolean;
  onToggle: () => void;
  priorSessionsByExercise: Map<string, PriorEntry[]>;
  priorCardioByExercise: Map<string, PriorCardioEntry[]>;
  onMutated: () => Promise<void>;
  onConfirmRemove: (info: RemoveRequest) => void;
}

function ExerciseRow({
  we,
  sessionId,
  expanded,
  onToggle,
  priorSessionsByExercise,
  priorCardioByExercise,
  onMutated,
  onConfirmRemove,
}: ExerciseRowProps) {
  const isCardio = we.exercise.kind === "cardio";
  const cardioSchema = isCardio ? asCardioMetricsSchema(we.exercise.cardio?.metricsSchema) : null;
  const childCount = isCardio
    ? we.workoutSessionCardioEntries.length
    : we.workoutSessionStrengthSets.length;

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

  const header: CardHeaderInfo = {
    exerciseId: we.exercise.id,
    exerciseName: we.exercise.name,
    primaryMuscle: we.exercise.primaryMuscleGroup,
    image1FileId: we.exercise.image1FileId,
    image2FileId: we.exercise.image2FileId,
    onRequestRemove: () =>
      onConfirmRemove({
        id: we.id,
        name: we.exercise.name,
        childCount,
        childNoun: isCardio ? "entry" : "set",
      }),
  };

  if (isCardio && cardioSchema) {
    return (
      <CardioExerciseLog
        {...header}
        workoutSessionExerciseId={we.id}
        expanded={expanded}
        onToggle={onToggle}
        schema={cardioSchema}
        entries={cardioEntries}
        priorEntries={priorCardioByExercise.get(we.exercise.id) ?? []}
        onMutated={onMutated}
      />
    );
  }
  // Cardio exercise with a missing/malformed metrics schema. Falling through to
  // <ExerciseLog> would render a strength UI whose "Add set" insert FK-fails
  // (parent_kind='strength' cannot attach to a cardio session-exercise). Show a
  // friendly placeholder + the remove control instead.
  if (isCardio) {
    return (
      <OpenCard name={we.exercise.name}>
        <OpenCardHeader {...header} tags={<CardioTag />} />
        <p className="mx-4 mb-4 rounded-lg bg-surface-inset px-3 py-2 text-[13px] text-muted-foreground">
          This cardio exercise is missing its metrics schema, so entries can't be logged here. An
          admin needs to configure it before this exercise can be used.
        </p>
      </OpenCard>
    );
  }
  return (
    <ExerciseLog
      {...header}
      sessionId={sessionId}
      workoutSessionExerciseId={we.id}
      expanded={expanded}
      onToggle={onToggle}
      doubleWeight={we.exercise.strength?.doubleWeight ?? false}
      sets={we.workoutSessionStrengthSets}
      priorSessions={priorSessionsByExercise.get(we.exercise.id) ?? []}
      onMutated={onMutated}
    />
  );
}

interface ExerciseLogProps extends CardHeaderInfo {
  sessionId: string;
  workoutSessionExerciseId: string;
  expanded: boolean;
  onToggle: () => void;
  doubleWeight: boolean;
  sets: SetRow[];
  priorSessions: PriorEntry[];
  onMutated: () => Promise<void>;
}

function useStrengthSetMutations(
  workoutSessionExerciseId: string,
  onMutated: () => Promise<void>,
  onSaved: () => void,
  onInserted: (setNumber: number) => void,
) {
  const insert = useMutation({
    mutationFn: (vars: { setNumber: number; reps: number; weight: number }) =>
      gqlRequest(InsertSetMutation, {
        obj: {
          workoutSessionExerciseId,
          setNumber: vars.setNumber,
          reps: vars.reps,
          weight: vars.weight,
        },
      }),
    onSuccess: (_result, vars) => {
      onInserted(vars.setNumber);
      return onMutated();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; reps: number; weight: number }) =>
      gqlRequest(UpdateSetMutation, {
        id: vars.id,
        set: { reps: vars.reps, weight: vars.weight },
      }),
    onSuccess: async () => {
      await onMutated();
      onSaved();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteSetMutation, { id }),
    onSuccess: async () => {
      await onMutated();
      onSaved();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return { insert, update, remove };
}

function ExerciseLog({
  sessionId,
  workoutSessionExerciseId,
  expanded,
  onToggle,
  doubleWeight,
  sets,
  priorSessions,
  onMutated,
  ...header
}: ExerciseLogProps) {
  const { exerciseName } = header;
  const restTimer = useRestTimer();
  const [editing, setEditing] = useState<SetRow | null>(null);

  const lastTime = priorSessions[0];
  const lastSet = sets.at(-1);
  const nextSetNumber = (lastSet?.setNumber ?? 0) + 1;

  const { insert, update, remove } = useStrengthSetMutations(
    workoutSessionExerciseId,
    onMutated,
    () => setEditing(null),
    (setNumber) =>
      restTimer.start({ sessionId, label: `${exerciseName} · set ${setNumber + 1} next` }),
  );
  const isPending = insert.isPending || update.isPending || remove.isPending;

  if (!expanded) {
    return (
      <CollapsedExercise
        exerciseName={exerciseName}
        primaryMuscle={header.primaryMuscle}
        image1FileId={header.image1FileId}
        summary={formatSetsSummary(sets)}
        caption={
          formatLastTimeCaption(lastTime?.sets, { hasLoggedSets: sets.length > 0 }) ??
          (sets.length > 0 ? null : "No sets yet")
        }
        status={exerciseStatus(sets.length, lastTime?.sets.length)}
        onToggle={onToggle}
      />
    );
  }

  const recent: RecentRow[] = priorSessions.map((entry) => ({
    id: entry.id,
    startedAt: entry.startedAt,
    summary: formatSetsSummary(entry.sets, { style: "compact" }) ?? "—",
  }));

  return (
    <OpenCard name={exerciseName}>
      <OpenCardHeader
        {...header}
        tags={doubleWeight ? <Tag>per side</Tag> : null}
        onCollapse={onToggle}
      />
      <ExerciseMedia
        exerciseName={exerciseName}
        imageIds={[header.image1FileId, header.image2FileId]}
        recent={recent}
      />
      <LoggedSetsTable sets={sets} multiplier={doubleWeight ? 2 : 1} onEdit={setEditing} />
      <NextSetForm
        sets={sets}
        lastTimeSets={lastTime?.sets}
        multiplier={doubleWeight ? 2 : 1}
        nextSetNumber={nextSetNumber}
        isPending={isPending}
        isLogging={insert.isPending}
        onLog={(weight, reps) => insert.mutateAsync({ setNumber: nextSetNumber, reps, weight })}
      />
      <CardFootnote>
        Logging a set starts the rest timer. Tap a logged set to edit or delete it.
      </CardFootnote>

      <SetDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        editingSet={editing}
        doubleWeight={doubleWeight}
        exerciseName={exerciseName}
        isPending={isPending}
        onSubmit={({ reps, weight }) => {
          if (editing) {
            update.mutate({ id: editing.id, reps, weight });
          }
        }}
        onDelete={() => {
          if (editing) {
            remove.mutate(editing.id);
          }
        }}
      />
    </OpenCard>
  );
}

function EarlierWorkoutSessions({
  workoutId,
  workoutName,
  sessionId,
  before,
}: {
  workoutId: string;
  workoutName: string;
  sessionId: string;
  before: string;
}) {
  const { data } = useQuery({
    queryKey: ["sessions", "earlier", workoutId, sessionId, before],
    queryFn: () => gqlRequest(EarlierWorkoutSessionsQuery, { workoutId, before }),
  });
  const rows = data?.workoutSessions ?? [];
  if (rows.length === 0) {
    return null;
  }
  const title = `Earlier ${workoutName} sessions`;
  return (
    <section aria-label={title} className="rounded-xl border bg-card px-4 py-1.5">
      <h3 className="py-2 text-[13px] font-semibold text-muted-foreground">{title}</h3>
      <ul className="flex flex-col">
        {rows.map((row) => {
          let sets = 0;
          let volume = 0;
          for (const exercise of row.workoutSessionExercises) {
            const m = exercise.exercise.strength?.doubleWeight ? 2 : 1;
            for (const set of exercise.workoutSessionStrengthSets) {
              sets += 1;
              volume += Number(set.weight) * set.reps * m;
            }
          }
          return (
            <li key={row.id} className="border-t">
              <Link
                to="/train/sessions/$sessionId"
                params={{ sessionId: row.id }}
                className="flex min-h-10 items-center justify-between gap-3 text-sm tabular-nums hover:text-link"
              >
                <span>
                  {new Date(row.startedAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="text-muted-foreground">
                  {sets} {sets === 1 ? "set" : "sets"} · {volumeFormat.format(volume)} kg
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function priorExercises(exercise: ResultOf<typeof PriorSessionsQuery>["exercises"][number]) {
  const sameWorkout = exercise.sameWorkoutSessions ?? [];
  return sameWorkout.length > 0 ? sameWorkout : exercise.workoutSessionExercises;
}

function buildPriorSessionsMap(
  data: ResultOf<typeof PriorSessionsQuery> | undefined,
): Map<string, PriorEntry[]> {
  const map = new Map<string, PriorEntry[]>();
  for (const e of data?.exercises ?? []) {
    map.set(
      e.id,
      priorExercises(e).map((wse) => ({
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
      priorExercises(e).map((wse) => ({
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

function AddExercisesDialog({
  open,
  onOpenChange,
  fromWorkout,
  alreadySelected,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromWorkout: boolean;
  alreadySelected: Set<string>;
  onConfirm: (picks: PickerSelection[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add exercises</DialogTitle>
          <DialogDescription>{addExercisesDescription(fromWorkout)}</DialogDescription>
        </DialogHeader>
        <ExercisePicker
          alreadySelected={alreadySelected}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface SetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSet: SetRow | null;
  doubleWeight: boolean;
  exerciseName: string;
  isPending: boolean;
  onSubmit: (vars: { reps: number; weight: number }) => void;
  onDelete: () => void;
}

/** Tap a logged set (Web · Dialogs): weight and reps, Delete, Cancel and Save. */
function SetDialog({
  open,
  onOpenChange,
  editingSet,
  doubleWeight,
  exerciseName,
  isPending,
  onSubmit,
  onDelete,
}: SetDialogProps) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const weightInputRef = useRef<HTMLInputElement | null>(null);

  // Reset values when the dialog opens.
  useEffect(() => {
    if (!(open && editingSet)) {
      return;
    }
    setWeight(String(Number(editingSet.weight)));
    setReps(String(editingSet.reps));
    requestAnimationFrame(() => weightInputRef.current?.select());
  }, [open, editingSet]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) {
      return;
    }
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
      <DialogContent className="md:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Edit set {editingSet?.setNumber ?? ""}</DialogTitle>
          <DialogDescription>{exerciseName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="set-weight">Weight (kg){doubleWeight ? " · per side" : ""}</Label>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="set-reps">Reps</Label>
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
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              onClick={onDelete}
              disabled={isPending}
            >
              <Trash2 />
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
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
      <DialogContent className="md:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Edit session start</DialogTitle>
          <DialogDescription>
            Moves the session in history and in every “Last time” comparison.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="started-at">Started</Label>
          <Input
            id="started-at"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
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
                <Loader2 className="animate-spin" />
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

function toLocalInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-[70px] w-full rounded-xl" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
      ))}
    </div>
  );
}

interface CardioExerciseLogProps extends CardHeaderInfo {
  workoutSessionExerciseId: string;
  expanded: boolean;
  onToggle: () => void;
  schema: CardioMetricsSchema;
  entries: CardioEntryRow[];
  priorEntries: PriorCardioEntry[];
  onMutated: () => Promise<void>;
}

function useCardioEntryMutations(
  workoutSessionExerciseId: string,
  onMutated: () => Promise<void>,
  onDone: () => void,
) {
  const insert = useMutation({
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
      onDone();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; metrics: CardioMetrics }) =>
      gqlRequest(UpdateCardioEntryMutation, {
        id: vars.id,
        set: { metrics: vars.metrics },
      }),
    onSuccess: () => {
      onMutated();
      onDone();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteCardioEntryMutation, { id }),
    onSuccess: () => {
      onMutated();
      onDone();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return { insert, update, remove };
}

function CardioExerciseLog({
  workoutSessionExerciseId,
  expanded,
  onToggle,
  schema,
  entries,
  priorEntries,
  onMutated,
  ...header
}: CardioExerciseLogProps) {
  const { exerciseName } = header;
  const [dialog, setDialog] = useState<
    { mode: "add" } | { mode: "edit"; entry: CardioEntryRow } | null
  >(null);
  const { insert, update, remove } = useCardioEntryMutations(
    workoutSessionExerciseId,
    onMutated,
    () => setDialog(null),
  );
  const isPending = insert.isPending || update.isPending || remove.isPending;

  const lastEntry = entries.at(-1);
  const nextEntryNumber = (lastEntry?.entryNumber ?? 0) + 1;
  const loggedPrior = priorEntries.filter((entry) => entry.entries.length > 0);

  if (!expanded) {
    const hasLoggedEntries = entries.length > 0;
    return (
      <CollapsedExercise
        exerciseName={exerciseName}
        primaryMuscle={header.primaryMuscle}
        image1FileId={header.image1FileId}
        summary={summarizeCardioEntries(entries, schema)}
        caption={
          cardioLastTimeCaption(loggedPrior[0]?.entries, schema, { hasLoggedEntries }) ??
          (hasLoggedEntries ? null : "No entries yet")
        }
        status={exerciseStatus(entries.length, priorEntries[0]?.entries.length)}
        onToggle={onToggle}
      />
    );
  }

  const recent: RecentRow[] = loggedPrior.map((entry) => ({
    id: entry.id,
    startedAt: entry.startedAt,
    summary: summarizeCardioEntries(entry.entries, schema) ?? "—",
  }));

  return (
    <OpenCard name={exerciseName}>
      <OpenCardHeader {...header} tags={<CardioTag />} onCollapse={onToggle} />
      <ExerciseMedia
        exerciseName={exerciseName}
        imageIds={[header.image1FileId, header.image2FileId]}
        recent={recent}
      />
      <CardioEntriesList
        entries={entries}
        schema={schema}
        onSelect={(entry) => setDialog({ mode: "edit", entry })}
      />
      <div className="px-4 pt-3 pb-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialog({ mode: "add" })}
          disabled={isPending}
        >
          <Plus />
          Add entry
        </Button>
      </div>
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
        previousMetrics={lastEntry?.metrics ?? null}
        isPending={isPending}
        onSubmit={(metrics) => {
          if (dialog?.mode === "edit") {
            update.mutate({ id: dialog.entry.id, metrics });
          } else {
            insert.mutate({ entryNumber: nextEntryNumber, metrics });
          }
        }}
        {...(dialog?.mode === "edit" ? { onDelete: () => remove.mutate(dialog.entry.id) } : {})}
      />
    </OpenCard>
  );
}
