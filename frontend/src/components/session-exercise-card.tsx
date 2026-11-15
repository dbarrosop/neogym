import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronUp, History, Loader2 } from "lucide-react";
import { type ReactNode, type SubmitEvent, useState } from "react";
import { toast } from "sonner";
import { ExerciseThumbnail } from "@/components/exercise-thumbnail";
import { NumberStepper } from "@/components/patterns/number-stepper";
import { Tag } from "@/components/patterns/tag";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { AlternatingStorageImage } from "@/components/storage-image";
import { Button } from "@/components/ui/button";
import type { ExerciseStatus } from "@/lib/session-logging";
import { cn, formatMuscle } from "@/lib/utils";

const volumeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export interface SetRow {
  id: string;
  setNumber: number;
  reps: number;
  weight: number | string;
}

export interface CardHeaderInfo {
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  image1FileId: string | null | undefined;
  image2FileId: string | null | undefined;
  onRequestRemove: () => void;
}

/** "28 Oct" (with the year when it differs) for the Recent panel. */
export function formatRecentDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * Open card header: exercise name (links to its page), muscle tag, collapse,
 * and an options menu (as on iOS) so removing never sits one tap from collapse.
 */
export function OpenCardHeader({
  exerciseId,
  exerciseName,
  primaryMuscle,
  onRequestRemove,
  tags,
  onCollapse,
}: Omit<CardHeaderInfo, "image1FileId" | "image2FileId"> & {
  tags?: ReactNode;
  onCollapse?: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2.5 py-1.5 pr-1.5 pl-4">
      <Link
        to="/train/exercises/$exerciseId"
        params={{ exerciseId }}
        className="min-w-0 flex-1 truncate text-[15px] font-semibold underline-offset-2 hover:underline"
      >
        {exerciseName}
      </Link>
      <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
        <Tag>{formatMuscle(primaryMuscle)}</Tag>
        {tags}
      </span>
      <span className="flex shrink-0">
        {onCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-muted-foreground"
            aria-label={`Collapse ${exerciseName}`}
            aria-expanded="true"
            onClick={onCollapse}
          >
            <ChevronUp />
          </Button>
        ) : null}
        <RowActionsMenu
          label={`Options for ${exerciseName}`}
          buttonClassName="size-11 rounded-[9px]"
          items={[
            {
              label: "Exercise details",
              onSelect: () =>
                void navigate({ to: "/train/exercises/$exerciseId", params: { exerciseId } }),
            },
            { label: "Remove from session", destructive: true, onSelect: onRequestRemove },
          ]}
        />
      </span>
    </div>
  );
}

export interface RecentRow {
  id: string;
  startedAt: string;
  /** "95 × 12 · 11 · 10", or the cardio entries' first metric. */
  summary: string;
}

/**
 * The open card's media row (Web · Session): the alternating start/end photo
 * beside the three latest earlier sessions. Stacks below 760 px. Either half
 * is left out when there is nothing to show.
 */
export function ExerciseMedia({
  exerciseName,
  imageIds,
  recent,
}: {
  exerciseName: string;
  imageIds: (string | null | undefined)[];
  recent: RecentRow[];
}) {
  const hasImage = imageIds.some(Boolean);
  if (!hasImage && recent.length === 0) {
    return null;
  }
  return (
    <div
      className={cn(
        "grid gap-3 px-4 pt-1.5 pb-3",
        hasImage && recent.length > 0 && "min-[760px]:grid-cols-[200px_minmax(0,320px)]",
      )}
    >
      {hasImage ? (
        <AlternatingStorageImage
          fileIds={imageIds}
          alt={`${exerciseName}, form demo`}
          frame="session"
          pager
          className={cn(recent.length === 0 && "min-[760px]:w-[200px]")}
        />
      ) : null}
      {recent.length > 0 ? (
        <RecentPanel rows={recent} className={cn(!hasImage && "min-[760px]:max-w-[320px]")} />
      ) : null}
    </div>
  );
}

function RecentPanel({ rows, className }: { rows: RecentRow[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between gap-2 rounded-xl bg-surface-inset px-3.5 py-2.5 tabular-nums",
        className,
      )}
    >
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.04em] text-muted-foreground uppercase">
        <History aria-hidden="true" className="size-3" />
        Recent
      </h3>
      <dl className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.id} className="flex min-w-0 items-baseline gap-2.5">
            <dt className="min-w-12 shrink-0 text-[12px] text-tertiary-foreground">
              {formatRecentDate(row.startedAt)}
            </dt>
            <dd className="min-w-0 truncate text-[13px] font-medium text-muted-foreground">
              {row.summary}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const STATUS_LABEL: Record<ExerciseStatus, string> = {
  done: "Done",
  started: "In progress",
  todo: "Not started",
};

/** 22 px status disc at the end of a collapsed card. */
function StatusDisc({ status }: { status: ExerciseStatus }) {
  const label = STATUS_LABEL[status];
  if (status === "done") {
    return (
      <span
        role="img"
        aria-label={label}
        className="grid size-[22px] shrink-0 place-items-center rounded-full bg-positive-soft text-positive"
      >
        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "started") {
    return (
      <span
        role="img"
        aria-label={label}
        className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent-soft"
      >
        <span className="size-2 rounded-full bg-link" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      className="size-[22px] shrink-0 rounded-full border-[1.5px] border-muted-foreground border-dashed"
    />
  );
}

/**
 * Collapsed exercise (Web · Session): photo, name over muscle, this session's
 * logged summary, last time's reference and the status disc; click to open.
 */
export function CollapsedExercise({
  exerciseName,
  primaryMuscle,
  image1FileId,
  summary,
  caption,
  status,
  onToggle,
}: {
  exerciseName: string;
  primaryMuscle: string;
  image1FileId: string | null | undefined;
  summary: string | null;
  /** Last time's reference ("last 135 × 10 · 9 · 8"), or what to say without one. */
  caption: string | null;
  status: ExerciseStatus;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded="false"
      className="flex w-full flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left tabular-nums transition-colors hover:bg-surface-inset"
    >
      <ExerciseThumbnail fileId={image1FileId} />
      <span className="flex min-w-[180px] flex-1 flex-col gap-0.5">
        <strong className="text-[15px] font-semibold">{exerciseName}</strong>
        <span className="text-[13px] text-muted-foreground">{formatMuscle(primaryMuscle)}</span>
      </span>
      {summary ? <span className="text-sm font-semibold">{summary}</span> : null}
      {caption ? (
        <span className="min-w-[150px] flex-1 text-right text-[13px] text-muted-foreground sm:flex-none">
          {caption}
        </span>
      ) : null}
      <StatusDisc status={status} />
    </button>
  );
}

export function parseWeight(value: string): number | null {
  const weight = Number(value.replace(",", "."));
  return value.trim() !== "" && Number.isFinite(weight) && weight >= 0 ? weight : null;
}

export function parseReps(value: string): number | null {
  const reps = Number(value);
  return value.trim() !== "" && Number.isInteger(reps) && reps >= 0 ? reps : null;
}

function weightLabel(weight: number): string {
  return weight === 0 ? "BW" : `${weight} kg`;
}

/** This session's logged sets; each row is one native button that opens the set. */
export function LoggedSetsTable({
  sets,
  multiplier,
  onEdit,
}: {
  sets: SetRow[];
  multiplier: number;
  onEdit: (set: SetRow) => void;
}) {
  if (sets.length === 0) {
    return null;
  }
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="border-b text-left text-[12px] text-muted-foreground">
          <th scope="col" className="w-12 py-2 pl-4 font-semibold">
            Set
          </th>
          <th scope="col" className="px-3 font-semibold">
            Weight
          </th>
          <th scope="col" className="px-3 font-semibold">
            Reps
          </th>
          <th scope="col" className="hidden px-3 font-semibold sm:table-cell">
            Volume
          </th>
          <th scope="col" className="w-14 pr-4">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sets.map((set) => {
          const weight = Number(set.weight);
          return (
            <tr
              key={set.id}
              className="relative h-11 border-b border-border/70 focus-within:bg-surface-inset hover:bg-surface-inset"
            >
              <td className="pl-4 font-semibold text-muted-foreground">{set.setNumber}</td>
              <td className="px-3 font-semibold">{weightLabel(weight)}</td>
              <td className="px-3 font-semibold">{set.reps}</td>
              <td className="hidden px-3 sm:table-cell">
                {volumeFormat.format(weight * set.reps * multiplier)} kg
              </td>
              <td className="w-14">
                {/* One native button spans the row without replacing its table semantics. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-0 size-full justify-end rounded-none px-4 text-positive hover:bg-transparent hover:text-positive dark:hover:bg-transparent"
                  aria-label={`Edit set ${set.setNumber}`}
                  onClick={() => onEdit(set)}
                >
                  <Check strokeWidth={2.6} aria-hidden="true" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface NextSetFormProps {
  sets: SetRow[];
  /** Last time's sets: the first one prefills an exercise's first set. */
  lastTimeSets: { reps: number; weight: number }[] | undefined;
  multiplier: number;
  nextSetNumber: number;
  isPending: boolean;
  isLogging: boolean;
  onLog: (weight: number, reps: number) => Promise<unknown>;
}

/** The next set with steppers on an accent-soft panel (Enter or "Log set" logs it). */
export function NextSetForm({
  sets,
  lastTimeSets,
  multiplier,
  nextSetNumber,
  isPending,
  isLogging,
  onLog,
}: NextSetFormProps) {
  const [draft, setDraft] = useState<{ weight: string; reps: string } | null>(null);
  const lastSet = sets.at(-1);
  // Suggest this session's previous set, else the first set from last time.
  const suggestion = lastSet
    ? { weight: Number(lastSet.weight), reps: lastSet.reps }
    : (lastTimeSets?.[0] ?? null);
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
    const submitted = { weight: draftWeight, reps: draftReps };
    onLog(previewWeight, previewReps).then(
      () =>
        setDraft((current) =>
          current === null ||
          (current.weight === submitted.weight && current.reps === submitted.reps)
            ? null
            : current,
        ),
      () => undefined,
    );
  }

  return (
    <form
      onSubmit={handleLog}
      aria-label={`Log set ${nextSetNumber}`}
      className="mx-3 mt-1 flex flex-wrap items-center gap-3 rounded-[10px] bg-accent-soft/60 p-3 tabular-nums"
    >
      <strong className="min-w-[90px] text-sm font-semibold">Set {nextSetNumber}</strong>
      <NumberStepper
        label={`Weight in kg for set ${nextSetNumber}`}
        value={draftWeight}
        onChange={(weight) => setDraft({ weight, reps: draftReps })}
        step={2.5}
        suffix="kg"
        className="rounded-[10px] border-input"
      />
      <NumberStepper
        label={`Reps for set ${nextSetNumber}`}
        value={draftReps}
        onChange={(reps) => setDraft({ weight: draftWeight, reps })}
        step={1}
        decimals={0}
        inputMode="numeric"
        className="rounded-[10px] border-input"
      />
      <span className="hidden flex-1 text-[13px] text-muted-foreground sm:inline">
        {previewVolume}
      </span>
      <Button type="submit" className="ml-auto h-11" disabled={isPending}>
        {isLogging ? <Loader2 className="animate-spin" /> : null}
        Log set
      </Button>
    </form>
  );
}

/** Caption under an open card's logging controls. */
export function CardFootnote({ children }: { children: ReactNode }) {
  return <p className="px-4 pt-2.5 pb-3.5 text-[13px] text-muted-foreground">{children}</p>;
}

/** Wraps an open card: `aria-label` names the exercise (tests and screen readers rely on it). */
export function OpenCard({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section aria-label={name} className="rounded-xl border bg-card">
      {children}
    </section>
  );
}
