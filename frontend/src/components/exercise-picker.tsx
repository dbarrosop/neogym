import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { cn } from "@/lib/utils";

const ExercisePickerQuery = graphql(`
  query ExercisePickerExercises {
    exercises(order_by: { name: asc }) {
      id
      name
      primaryMuscleGroup
      doubleWeight
    }
  }
`);

export interface PickerSelection {
  exerciseId: string;
  name: string;
  primaryMuscleGroup: string;
  doubleWeight: boolean;
}

interface ExercisePickerProps {
  alreadySelected: Set<string>;
  onConfirm: (picks: PickerSelection[]) => void;
  onCancel: () => void;
  confirmLabel?: string;
}

function formatMuscle(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ExercisePicker({
  alreadySelected,
  onConfirm,
  onCancel,
  confirmLabel = "Add",
}: ExercisePickerProps) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Map<string, PickerSelection>>(new Map());

  const { data, isLoading, error } = useQuery({
    queryKey: ["exercise-picker", "exercises"],
    queryFn: () => gqlRequest(ExercisePickerQuery),
  });

  const exercises = useMemo<PickerExercise[]>(
    () =>
      (data?.exercises ?? []).map((ex) => ({
        id: ex.id,
        name: ex.name,
        primaryMuscleGroup: ex.primaryMuscleGroup,
        doubleWeight: ex.doubleWeight,
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
          primaryMuscleGroup: ex.primaryMuscleGroup,
          doubleWeight: ex.doubleWeight,
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
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border/40">
        <PickerBody
          isLoading={isLoading}
          errorMessage={error?.message ?? null}
          exercises={filtered}
          alreadySelected={alreadySelected}
          picked={picked}
          onToggle={toggle}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={picked.size === 0}>
          {confirmLabel} {picked.size > 0 ? `(${picked.size})` : ""}
        </Button>
      </div>
    </div>
  );
}

interface PickerExercise {
  id: string;
  name: string;
  primaryMuscleGroup: string;
  doubleWeight: boolean;
}

interface PickerBodyProps {
  isLoading: boolean;
  errorMessage: string | null;
  exercises: PickerExercise[];
  alreadySelected: Set<string>;
  picked: Map<string, PickerSelection>;
  onToggle: (ex: PickerExercise) => void;
}

function PickerBody({
  isLoading,
  errorMessage,
  exercises,
  alreadySelected,
  picked,
  onToggle,
}: PickerBodyProps) {
  if (isLoading) {
    return (
      <div className="space-y-1 p-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (errorMessage) {
    return <p className="p-3 text-sm text-destructive">Failed to load: {errorMessage}</p>;
  }
  if (exercises.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">No matching exercises.</p>;
  }
  return (
    <ul className="divide-y divide-border/40">
      {exercises.map((ex) => {
        const isAlready = alreadySelected.has(ex.id);
        const isPicked = picked.has(ex.id);
        return (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => onToggle(ex)}
              disabled={isAlready}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                isAlready
                  ? "cursor-not-allowed opacity-60"
                  : "hover:bg-accent/40 focus:bg-accent/40",
                isPicked && "bg-primary/10",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] font-medium",
                  isPicked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70",
                  isAlready && "border-border/40",
                )}
              >
                {isPicked ? "✓" : ""}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{ex.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatMuscle(ex.primaryMuscleGroup)}
                </p>
              </div>
              {isAlready ? (
                <Badge variant="outline" className="text-[10px]">
                  Added
                </Badge>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
