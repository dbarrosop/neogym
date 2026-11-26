import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CardioTag } from "@/components/exercise-kind-tag";
import { ExerciseThumbnail } from "@/components/exercise-thumbnail";
import { ErrorState } from "@/components/patterns/query-states";
import { Tag } from "@/components/patterns/tag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { cn, formatMuscle } from "@/lib/utils";

const ExercisePickerQuery = graphql(`
  query ExercisePickerExercises {
    exercises(order_by: { name: asc }) {
      id
      name
      kind
      primaryMuscleGroup
      image1FileId
      isPublic
      strength { doubleWeight }
    }
  }
`);

export interface PickerSelection {
  exerciseId: string;
  name: string;
  kind: string;
  primaryMuscleGroup: string;
  doubleWeight: boolean;
  image1FileId: string | null;
}

interface ExercisePickerProps {
  alreadySelected: Set<string>;
  onConfirm: (picks: PickerSelection[]) => void;
  onCancel: () => void;
  confirmLabel?: string;
}

/**
 * Multi-select checklist for the Add exercises dialog (Web · Dialogs): search,
 * then 60 px rows with a checkbox, the exercise photo, name and muscle
 * ("· Mine" for private exercises) and a CARDIO tag.
 */
export function ExercisePicker({
  alreadySelected,
  onConfirm,
  onCancel,
  confirmLabel = "Add",
}: ExercisePickerProps) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Map<string, PickerSelection>>(new Map());

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["exercise-picker", "exercises"],
    queryFn: () => gqlRequest(ExercisePickerQuery),
  });

  const exercises = useMemo<PickerExercise[]>(
    () =>
      (data?.exercises ?? []).map((ex) => ({
        id: ex.id,
        name: ex.name,
        // `kind` is a generated column, so the API marks it nullable.
        kind: ex.kind ?? "strength",
        primaryMuscleGroup: ex.primaryMuscleGroup,
        doubleWeight: ex.strength?.doubleWeight ?? false,
        image1FileId: ex.image1FileId ?? null,
        isPublic: ex.isPublic,
      })),
    [data],
  );

  const fuse = useMemo(
    () =>
      new Fuse(exercises, {
        keys: ["name"],
        ignoreLocation: true,
        threshold: 0.4,
      }),
    [exercises],
  );

  const filtered = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      return exercises;
    }
    return fuse.search(trimmed).map((r) => r.item);
  }, [exercises, fuse, search]);

  function toggle(ex: PickerExercise) {
    if (alreadySelected.has(ex.id)) {
      return;
    }
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(ex.id)) {
        next.delete(ex.id);
      } else {
        next.set(ex.id, {
          exerciseId: ex.id,
          name: ex.name,
          kind: ex.kind,
          primaryMuscleGroup: ex.primaryMuscleGroup,
          doubleWeight: ex.doubleWeight,
          image1FileId: ex.image1FileId,
        });
      }
      return next;
    });
  }

  function handleConfirm() {
    onConfirm([...picked.values()]);
    setPicked(new Map());
    setSearch("");
  }

  return (
    <div className="flex min-w-0 flex-col gap-4.5">
      <label className="flex h-10 items-center gap-2 rounded-[10px] border border-input bg-background px-3 focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          aria-label="Search exercises"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-[15px]"
          // biome-ignore lint/a11y/noAutofocus: the dialog opens to search, as on iOS.
          autoFocus
        />
      </label>

      {error ? (
        <ErrorState
          title="Couldn't load exercises"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      ) : (
        <div className="-mx-3 max-h-[50vh] overflow-y-auto border-b">
          <PickerBody
            isLoading={isLoading}
            exercises={filtered}
            alreadySelected={alreadySelected}
            picked={picked}
            onToggle={toggle}
          />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={picked.size === 0}>
          {confirmLabel}
          {picked.size > 0 ? ` (${picked.size})` : ""}
        </Button>
      </div>
    </div>
  );
}

interface PickerExercise {
  id: string;
  name: string;
  kind: string;
  primaryMuscleGroup: string;
  doubleWeight: boolean;
  image1FileId: string | null;
  isPublic: boolean;
}

interface PickerBodyProps {
  isLoading: boolean;
  exercises: PickerExercise[];
  alreadySelected: Set<string>;
  picked: Map<string, PickerSelection>;
  onToggle: (ex: PickerExercise) => void;
}

function PickerBody({ isLoading, exercises, alreadySelected, picked, onToggle }: PickerBodyProps) {
  if (isLoading) {
    return (
      <ul aria-label="Loading exercises" className="flex flex-col">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="flex min-h-[60px] items-center gap-3 border-t px-3">
            <Skeleton className="size-5 rounded-md" />
            <Skeleton className="size-12 rounded-xl" />
            <Skeleton className="h-4 w-40" />
          </li>
        ))}
      </ul>
    );
  }
  if (exercises.length === 0) {
    return (
      <p className="border-t px-3 py-6 text-center text-sm text-muted-foreground">
        No matching exercises.
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {exercises.map((ex) => (
        <PickerRow
          key={ex.id}
          exercise={ex}
          isAlready={alreadySelected.has(ex.id)}
          isPicked={picked.has(ex.id)}
          onToggle={() => onToggle(ex)}
        />
      ))}
    </ul>
  );
}

function PickerRow({
  exercise,
  isAlready,
  isPicked,
  onToggle,
}: {
  exercise: PickerExercise;
  isAlready: boolean;
  isPicked: boolean;
  onToggle: () => void;
}) {
  const checked = isPicked || isAlready;
  return (
    <li>
      <label
        className={cn(
          "flex min-h-[60px] items-center gap-3 border-t px-3 transition-colors",
          isAlready ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-inset",
        )}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={isAlready}
          onChange={onToggle}
          aria-label={exercise.name}
        />
        <span
          aria-hidden="true"
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/70",
          )}
        >
          {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        <ExerciseThumbnail fileId={exercise.image1FileId} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{exercise.name}</span>
          <span className="truncate text-[13px] text-muted-foreground">
            {formatMuscle(exercise.primaryMuscleGroup)}
            {exercise.isPublic ? "" : " · Mine"}
          </span>
        </span>
        {exercise.kind === "cardio" ? <CardioTag /> : null}
        {isAlready ? <Tag>Added</Tag> : null}
      </label>
    </li>
  );
}
