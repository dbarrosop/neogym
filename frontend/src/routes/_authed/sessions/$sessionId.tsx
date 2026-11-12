import type { ResultOf } from "@graphql-typed-document-node/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  CircleCheck,
  CircleDot,
  History,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Fragment,
  type ReactNode,
  type SubmitEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { CardioEntriesList } from "@/components/cardio-entries-list";
import { CardioMetricsForm } from "@/components/cardio-metrics-form";
import { ExercisePicker, type PickerSelection } from "@/components/exercise-picker";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { StartRestButton } from "@/components/shell/rest-timer";
import { AlternatingStorageImage } from "@/components/storage-image";
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
  formatMetricValue,
  iterateMetrics,
} from "@/lib/cardio-schema";
import { gqlRequest } from "@/lib/graphql";
import { useRestTimer } from "@/lib/rest-timer";
import { sessionDisplayName } from "@/lib/sessions";
import { cn, formatMuscle } from "@/lib/utils";

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

const EarlierWorkoutSessionsQuery = graphql(`
  query EarlierWorkoutSessions($workoutId: uuid!, $excludeSessionId: uuid!) {
    workoutSessions(
      where: { workoutId: { _eq: $workoutId }, id: { _neq: $excludeSessionId } }
      order_by: { startedAt: desc }
      limit: 5
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

export const Route = createFileRoute("/_authed/sessions/$sessionId")({
  component: SessionDetailRoute,
});

const volumeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

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
    queryClient.invalidateQueries({ queryKey: ["today"] });
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
      queryClient.invalidateQueries({ queryKey: ["today"] });
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

  const totals = useMemo(() => sessionTotals(session), [session]);
  // The exercise you are most likely working on opens by default: the first one
  // with fewer sets than last time (or no entries yet). Manual toggles win.
  const defaultActiveId = useMemo(
    () => defaultActiveExerciseId(session, priorSessionsByExercise),
    [session, priorSessionsByExercise],
  );
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});

  const [editingDate, setEditingDate] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingRemoveExercise, setConfirmingRemoveExercise] = useState<{
    id: string;
    name: string;
    childCount: number;
    childNoun: "set" | "entry";
  } | null>(null);

  const selectedExerciseIds = useMemo(
    () => new Set(session?.workoutSessionExercises.map((we) => we.exercise.id) ?? []),
    [session],
  );
  const maxPosition = useMemo(() => {
    const positions = session?.workoutSessionExercises.map((we) => we.position) ?? [];
    return positions.length > 0 ? Math.max(...positions) : 0;
  }, [session]);

  if (isLoading) {
    return <DetailSkeleton />;
  }
  if (error) {
    return <ErrorState title="Couldn't load this session" message={error.message} />;
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

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader
        name={name}
        startedAt={session.startedAt}
        workout={session.workout ?? null}
        onEditDate={() => setEditingDate(true)}
        onAddExercise={() => setPickerOpen(true)}
        isAdding={addExercisesMutation.isPending}
      />
      {totals.hasStrength ? <SessionTotals totals={totals} /> : null}

      <div className="flex flex-col gap-3">
        {session.workoutSessionExercises.map((we) => {
          const expanded = expandedOverrides[we.id] ?? we.id === defaultActiveId;
          return (
            <ExerciseRow
              key={we.id}
              sessionId={sessionId}
              we={we}
              expanded={expanded}
              onToggle={() =>
                setExpandedOverrides((current) => ({ ...current, [we.id]: !expanded }))
              }
              priorSessionsByExercise={priorSessionsByExercise}
              priorCardioByExercise={priorCardioByExercise}
              onMutated={invalidateAll}
              onConfirmRemove={setConfirmingRemoveExercise}
            />
          );
        })}
        {session.workoutSessionExercises.length === 0 ? (
          <EmptyState
            title="No exercises yet"
            description="Add exercises to this session to start logging sets."
          >
            <Button type="button" onClick={() => setPickerOpen(true)}>
              <Plus />
              Add exercise
            </Button>
          </EmptyState>
        ) : null}
      </div>

      {session.workout ? (
        <EarlierWorkoutSessions
          workoutId={session.workout.id}
          workoutName={session.workout.name}
          sessionId={sessionId}
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
          confirmingRemoveExercise ? `Remove ${confirmingRemoveExercise.name}?` : "Remove exercise?"
        }
        description={
          confirmingRemoveExercise && confirmingRemoveExercise.childCount > 0
            ? `${confirmingRemoveExercise.childCount} logged ${pluralChild(confirmingRemoveExercise.childNoun, confirmingRemoveExercise.childCount)} will be deleted with it. This can't be undone.`
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
    </div>
  );
}

type SessionDetail = NonNullable<ResultOf<typeof SessionDetailQuery>["workoutSession"]>;

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
): string | null {
  for (const we of session?.workoutSessionExercises ?? []) {
    if (we.exercise.kind === "cardio") {
      if (we.workoutSessionCardioEntries.length === 0) {
        return we.id;
      }
      continue;
    }
    const lastTimeSets = priorSessionsByExercise.get(we.exercise.id)?.[0]?.sets.length ?? 0;
    if (we.workoutSessionStrengthSets.length < Math.max(lastTimeSets, 1)) {
      return we.id;
    }
  }
  return null;
}

function SessionHeader({
  name,
  startedAt,
  workout,
  onEditDate,
  onAddExercise,
  isAdding,
}: {
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
        <h2 className="text-[22px] font-bold tracking-tight">{name}</h2>
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
          <button
            type="button"
            onClick={onEditDate}
            className="font-medium text-link hover:underline"
          >
            Edit date
          </button>
          {workout ? (
            <>
              {" · from "}
              <Link
                to="/workouts/$workoutId"
                params={{ workoutId: workout.id }}
                className="font-medium text-link hover:underline"
              >
                {workout.name}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StartRestButton />
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
    ["Sets", String(totals.sets)],
    ["Reps", String(totals.reps)],
    ["Volume", `${volumeFormat.format(totals.volume)} kg`],
  ] as const;
  return (
    <dl className="grid grid-cols-3 rounded-xl border bg-card">
      {cells.map(([label, value], index) => (
        <div key={label} className={cn("flex flex-col gap-0.5 px-4 py-3", index > 0 && "border-l")}>
          <dt className="order-2 text-[13px] text-muted-foreground">{label}</dt>
          <dd className="whitespace-nowrap text-lg font-semibold tabular-nums sm:text-xl">
            {value}
          </dd>
        </div>
      ))}
    </dl>
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

type SessionExerciseRow = NonNullable<
  ResultOf<typeof SessionDetailQuery>["workoutSession"]
>["workoutSessionExercises"][number];

interface ExerciseRowProps {
  sessionId: string;
  we: SessionExerciseRow;
  expanded: boolean;
  onToggle: () => void;
  priorSessionsByExercise: Map<string, PriorEntry[]>;
  priorCardioByExercise: Map<string, PriorCardioEntry[]>;
  onMutated: () => void;
  onConfirmRemove: (info: {
    id: string;
    name: string;
    childCount: number;
    childNoun: "set" | "entry";
  }) => void;
}

function pluralChild(noun: "set" | "entry", count: number): string {
  if (count === 1) {
    return noun;
  }
  return noun === "entry" ? "entries" : "sets";
}

function ExerciseRow({
  sessionId,
  we,
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
  const onRequestRemove = () =>
    onConfirmRemove({
      id: we.id,
      name: we.exercise.name,
      childCount,
      childNoun: isCardio ? "entry" : "set",
    });

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

  const header = {
    sessionId,
    exerciseId: we.exercise.id,
    exerciseName: we.exercise.name,
    primaryMuscle: we.exercise.primaryMuscleGroup,
    image1FileId: we.exercise.image1FileId,
    image2FileId: we.exercise.image2FileId,
    onRequestRemove,
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
      <section aria-label={we.exercise.name} className="rounded-xl border bg-card">
        <ExerciseCardHeader {...header} meta="Cardio" />
        <p className="mx-4 mb-4 rounded-lg bg-surface-inset px-3 py-2 text-[13px] text-muted-foreground">
          This cardio exercise is missing its metrics schema, so entries can't be logged here. An
          admin needs to configure it before this exercise can be used.
        </p>
      </section>
    );
  }
  return (
    <ExerciseLog
      {...header}
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

interface ExerciseCardHeaderProps {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  image1FileId: string | null | undefined;
  image2FileId: string | null | undefined;
  onRequestRemove: () => void;
  meta?: ReactNode;
  onCollapse?: () => void;
}

function ExerciseCardHeader({
  sessionId,
  exerciseId,
  exerciseName,
  primaryMuscle,
  image1FileId,
  image2FileId,
  onRequestRemove,
  meta,
  onCollapse,
}: ExerciseCardHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-4 pb-3">
      <Link
        to="/sessions/$sessionId/exercises/$exerciseId"
        params={{ sessionId, exerciseId }}
        className="block size-12 shrink-0 overflow-hidden rounded-lg bg-muted"
        tabIndex={-1}
        aria-hidden="true"
      >
        <AlternatingStorageImage
          fileIds={[image1FileId, image2FileId]}
          alt=""
          className="h-full w-full"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to="/sessions/$sessionId/exercises/$exerciseId"
          params={{ sessionId, exerciseId }}
          className="truncate text-[15px] font-semibold underline-offset-2 hover:underline"
        >
          {exerciseName}
        </Link>
        <span className="truncate text-[13px] text-muted-foreground">
          {formatMuscle(primaryMuscle)}
          {meta ? <> · {meta}</> : null}
        </span>
      </div>
      {onCollapse ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          aria-label={`Collapse ${exerciseName}`}
          aria-expanded="true"
          onClick={onCollapse}
        >
          <ChevronUp />
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Remove ${exerciseName} from session`}
        onClick={onRequestRemove}
      >
        <X />
      </Button>
    </div>
  );
}

const STATUS_ICONS = {
  done: { Icon: CircleCheck, label: "Done", className: "text-positive" },
  started: { Icon: CircleDot, label: "In progress", className: "text-link" },
  todo: { Icon: Circle, label: "Not started", className: "text-muted-foreground/60" },
} as const;

type ExerciseStatus = keyof typeof STATUS_ICONS;

function StatusIcon({ status, className }: { status: ExerciseStatus; className?: string }) {
  const { Icon, label, className: tone } = STATUS_ICONS[status];
  return <Icon className={cn(tone, className)} aria-label={label} role="img" />;
}

/** Collapsed exercise: status, name and a one-line summary; click to open. */
function CollapsedExercise({
  exerciseName,
  summary,
  status,
  onToggle,
}: {
  exerciseName: string;
  summary: string;
  status: ExerciseStatus;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded="false"
      className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-surface-inset"
    >
      <StatusIcon className="size-5 shrink-0" status={status} />
      <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
        <strong className="truncate text-[15px] font-semibold">{exerciseName}</strong>
        <span className="truncate text-[13px] text-muted-foreground tabular-nums">{summary}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function weightLabel(weight: number): string {
  return weight === 0 ? "BW" : `${weight} kg`;
}

/** "80 kg × 6 · 6 · 5" when the weight is constant, otherwise one pair per set. */
function formatSetsSummary(sets: { reps: number; weight: number | string }[]): string {
  const weights = sets.map((set) => Number(set.weight));
  if (weights.every((weight) => weight === weights[0])) {
    return `${weightLabel(weights[0] ?? 0)} × ${sets.map((set) => set.reps).join(" · ")}`;
  }
  return sets.map((set) => `${weightLabel(Number(set.weight))} × ${set.reps}`).join(" · ");
}

function formatLastTimeSet(set: { reps: number; weight: number } | undefined): string {
  if (!set) {
    return "—";
  }
  return `${set.weight === 0 ? "BW" : set.weight} × ${set.reps}`;
}

function parseWeight(value: string): number | null {
  const weight = Number(value.replace(",", "."));
  return value.trim() !== "" && Number.isFinite(weight) && weight >= 0 ? weight : null;
}

function parseReps(value: string): number | null {
  const reps = Number(value);
  return value.trim() !== "" && Number.isInteger(reps) && reps >= 0 ? reps : null;
}

interface ExerciseLogProps extends Omit<ExerciseCardHeaderProps, "meta" | "onCollapse"> {
  workoutSessionExerciseId: string;
  expanded: boolean;
  onToggle: () => void;
  doubleWeight: boolean;
  sets: SetRow[];
  priorSessions: PriorEntry[];
  onMutated: () => void;
}

function strengthSummary(sets: SetRow[], lastTime: PriorEntry | undefined) {
  if (sets.length > 0) {
    return formatSetsSummary(sets);
  }
  if (lastTime && lastTime.sets.length > 0) {
    return `Last time ${formatSetsSummary(lastTime.sets)}`;
  }
  return "No sets yet";
}

function strengthStatus(sets: SetRow[], lastTime: PriorEntry | undefined): ExerciseStatus {
  if (sets.length === 0) {
    return "todo";
  }
  return sets.length >= (lastTime?.sets.length ?? 1) ? "done" : "started";
}

function ExerciseLog({
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
  const [dialog, setDialog] = useState<{ mode: "edit"; set: SetRow } | null>(null);

  const lastTime = priorSessions[0];
  const lastSet = sets.at(-1);
  const nextSetNumber = (lastSet?.setNumber ?? 0) + 1;

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
    onSuccess: (_result, vars) => {
      onMutated();
      restTimer.start({ label: `${exerciseName} · set ${vars.setNumber + 1} next` });
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

  if (!expanded) {
    return (
      <CollapsedExercise
        exerciseName={exerciseName}
        summary={strengthSummary(sets, lastTime)}
        status={strengthStatus(sets, lastTime)}
        onToggle={onToggle}
      />
    );
  }

  return (
    <section aria-label={exerciseName} className="rounded-xl border bg-card">
      <ExerciseCardHeader
        {...header}
        meta={doubleWeight ? "weight per side" : undefined}
        onCollapse={onToggle}
      />
      <StrengthSetTable
        sets={sets}
        lastTime={lastTime}
        multiplier={doubleWeight ? 2 : 1}
        nextSetNumber={nextSetNumber}
        isPending={isPending}
        isLogging={insertMutation.isPending}
        onEdit={(set) => setDialog({ mode: "edit", set })}
        onLog={(weight, reps) =>
          insertMutation.mutateAsync({ setNumber: nextSetNumber, reps, weight })
        }
      />
      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-4">
        <PriorSessionsSummary entries={priorSessions} doubleWeight={doubleWeight} />
        <p className="text-[12px] text-muted-foreground">
          Log starts the rest timer. Use the pencil to fix or delete a set.
        </p>
      </div>

      <SetDialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
          }
        }}
        mode="edit"
        editingSet={dialog?.set ?? null}
        previousSet={lastSet ?? null}
        doubleWeight={doubleWeight}
        exerciseName={exerciseName}
        nextSetNumber={nextSetNumber}
        isPending={isPending}
        onSubmit={({ reps, weight }) => {
          if (dialog) {
            updateMutation.mutate({ id: dialog.set.id, reps, weight });
          }
        }}
        onDelete={dialog ? () => deleteMutation.mutate(dialog.set.id) : undefined}
      />
    </section>
  );
}

interface StrengthSetTableProps {
  sets: SetRow[];
  lastTime: PriorEntry | undefined;
  multiplier: number;
  nextSetNumber: number;
  isPending: boolean;
  isLogging: boolean;
  onEdit: (set: SetRow) => void;
  onLog: (weight: number, reps: number) => Promise<unknown>;
}

/** Logged sets plus an inline row for the next set (Enter logs it). */
function StrengthSetTable({
  sets,
  lastTime,
  multiplier,
  nextSetNumber,
  isPending,
  isLogging,
  onEdit,
  onLog,
}: StrengthSetTableProps) {
  const [draft, setDraft] = useState<{ weight: string; reps: string } | null>(null);
  const lastSet = sets.at(-1);
  // Suggest this session's previous set, else the matching set from last time.
  const suggestion = lastSet
    ? { weight: Number(lastSet.weight), reps: lastSet.reps }
    : (lastTime?.sets[0] ?? null);
  const draftWeight = draft?.weight ?? (suggestion ? String(suggestion.weight) : "");
  const draftReps = draft?.reps ?? (suggestion ? String(suggestion.reps) : "");
  const previewWeight = parseWeight(draftWeight);
  const previewReps = parseReps(draftReps);
  const previewVolume =
    previewWeight !== null && previewReps !== null
      ? `${volumeFormat.format(previewWeight * previewReps * multiplier)} kg`
      : "—";

  function handleLog(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) {
      return;
    }
    if (previewWeight === null) {
      toast.error("Weight must be a number ≥ 0");
      return;
    }
    if (previewReps === null) {
      toast.error("Reps must be a whole number ≥ 0");
      return;
    }
    onLog(previewWeight, previewReps).then(
      () => setDraft(null),
      () => undefined,
    );
  }

  return (
    <form onSubmit={handleLog}>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th scope="col" className="w-12 py-2 pl-4 font-medium">
              Set
            </th>
            <th scope="col" className="font-medium">
              Weight
            </th>
            <th scope="col" className="font-medium">
              Reps
            </th>
            <th scope="col" className="hidden font-medium sm:table-cell">
              Volume
            </th>
            <th scope="col" className="font-medium">
              Last time
            </th>
            <th scope="col" className="pr-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sets.map((set, index) => {
            const weight = Number(set.weight);
            return (
              <tr key={set.id} className="border-t">
                <td className="py-2.5 pl-4 text-muted-foreground">{set.setNumber}</td>
                <td className="font-medium">{weightLabel(weight)}</td>
                <td className="font-medium">{set.reps}</td>
                <td className="hidden text-muted-foreground sm:table-cell">
                  {volumeFormat.format(weight * set.reps * multiplier)} kg
                </td>
                <td className="text-muted-foreground">
                  {formatLastTimeSet(lastTime?.sets[index])}
                </td>
                <td className="pr-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label={`Edit set ${set.setNumber}`}
                    onClick={() => onEdit(set)}
                  >
                    <Pencil />
                  </Button>
                </td>
              </tr>
            );
          })}
          <tr className="border-t bg-surface-inset/70">
            <td className="py-2 pl-4 font-semibold">{nextSetNumber}</td>
            <td>
              <div className="flex items-center gap-1.5">
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={draftWeight}
                  onChange={(e) => setDraft({ weight: e.target.value, reps: draftReps })}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 w-16 bg-card px-2 text-right tabular-nums sm:w-20"
                  aria-label={`Weight in kg for set ${nextSetNumber}`}
                  placeholder="0"
                />
                <span className="hidden text-[13px] text-muted-foreground sm:inline">kg</span>
              </div>
            </td>
            <td>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draftReps}
                onChange={(e) => setDraft({ weight: draftWeight, reps: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 w-14 bg-card px-2 text-right tabular-nums"
                aria-label={`Reps for set ${nextSetNumber}`}
                placeholder="0"
              />
            </td>
            <td className="hidden text-muted-foreground sm:table-cell">{previewVolume}</td>
            <td className="text-muted-foreground">
              {formatLastTimeSet(lastTime?.sets[sets.length])}
            </td>
            <td className="pr-3 text-right">
              <Button type="submit" size="sm" disabled={isPending}>
                {isLogging ? <Loader2 className="animate-spin" /> : null}
                Log
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </form>
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
    <div className="flex flex-col gap-1 rounded-lg bg-surface-inset px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <History className="size-3.5" />
        Recent sessions
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[13px] tabular-nums">
        {entries.map((entry) => {
          const hasWeight = entry.sets.some((s) => s.weight > 0);
          return (
            <Fragment key={entry.id}>
              <dt className="text-muted-foreground">{formatPriorDate(entry.startedAt)}</dt>
              <dd className="min-w-0 truncate">
                {entry.sets.length === 0 ? (
                  <span className="text-muted-foreground">no sets</span>
                ) : (
                  <>
                    {entry.sets.map(formatPriorSet).join(", ")}
                    {doubleWeight && hasWeight ? (
                      <span className="ml-1 text-muted-foreground">/side</span>
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

function EarlierWorkoutSessions({
  workoutId,
  workoutName,
  sessionId,
}: {
  workoutId: string;
  workoutName: string;
  sessionId: string;
}) {
  const { data } = useQuery({
    queryKey: ["sessions", "earlier", workoutId, sessionId],
    queryFn: () =>
      gqlRequest(EarlierWorkoutSessionsQuery, { workoutId, excludeSessionId: sessionId }),
  });
  const rows = data?.workoutSessions ?? [];
  if (rows.length === 0) {
    return null;
  }
  return (
    <section aria-label={`Other ${workoutName} sessions`} className="rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">Other {workoutName} sessions</h3>
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
            <li key={row.id} className="border-t first:border-t-0">
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: row.id }}
                className="flex min-h-10 items-center justify-between gap-3 text-sm hover:text-link"
              >
                <span>
                  {new Date(row.startedAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="text-muted-foreground tabular-nums">
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
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

interface CardioExerciseLogProps extends Omit<ExerciseCardHeaderProps, "meta" | "onCollapse"> {
  workoutSessionExerciseId: string;
  expanded: boolean;
  onToggle: () => void;
  schema: CardioMetricsSchema;
  entries: CardioEntryRow[];
  priorEntries: PriorCardioEntry[];
  onMutated: () => void;
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

  const form = (
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
  );

  if (!expanded) {
    const summary = cardioSummary(entries, schema);
    return (
      <CollapsedExercise
        exerciseName={exerciseName}
        summary={summary}
        status={entries.length > 0 ? "done" : "todo"}
        onToggle={onToggle}
      />
    );
  }

  return (
    <section aria-label={exerciseName} className="rounded-xl border bg-card">
      <ExerciseCardHeader {...header} meta="Cardio" onCollapse={onToggle} />
      <div className="flex flex-col gap-2.5 px-4 pb-4">
        <CardioEntriesList
          entries={entries}
          schema={schema}
          onSelect={(entry) => setDialog({ mode: "edit", entry })}
        />
        <CardioPriorSummary entries={priorEntries} schema={schema} />
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setDialog({ mode: "add" })}
          disabled={isPending}
        >
          <Plus />
          Add entry
        </Button>
      </div>
      {form}
    </section>
  );
}

function cardioSummary(entries: CardioEntryRow[], schema: CardioMetricsSchema): string {
  if (entries.length === 0) {
    return "No entries yet";
  }
  const primary = iterateMetrics(schema)[0];
  if (!primary) {
    return `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  }
  return entries.map((entry) => formatMetricValue(entry.metrics[primary.key], primary)).join(" · ");
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
    <div className="flex flex-col gap-1 rounded-lg bg-surface-inset px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <History className="size-3.5" />
        Recent sessions
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[13px] tabular-nums">
        {filtered.map((entry) => {
          const summary = entry.entries
            .map((e) => formatMetricValue(e.metrics[primary.key], primary))
            .join(", ");
          return (
            <Fragment key={entry.id}>
              <dt className="text-muted-foreground">{formatPriorDate(entry.startedAt)}</dt>
              <dd className="min-w-0 truncate">{summary}</dd>
            </Fragment>
          );
        })}
      </dl>
    </div>
  );
}
