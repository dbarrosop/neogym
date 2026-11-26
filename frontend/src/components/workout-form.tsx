import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { type SubmitEvent, useId, useMemo, useState } from "react";
import { CardioTag } from "@/components/exercise-kind-tag";
import { ExercisePicker, type PickerSelection } from "@/components/exercise-picker";
import { ExerciseThumbnail } from "@/components/exercise-thumbnail";
import { LabelInput, type LabelSelection, type LabelSuggestion } from "@/components/label-input";
import { FormActions } from "@/components/patterns/form-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormPageFormId } from "@/lib/form-page-context";
import { cn, formatMuscle } from "@/lib/utils";

export interface WorkoutFormExercise {
  /**
   * Stable client-side id for keying / sorting. For existing rows this is the
   * workoutExercises.id (uuid); for newly added rows it's a synthetic key.
   */
  rowId: string;
  exerciseId: string;
  name: string;
  kind: string;
  primaryMuscleGroup: string;
  doubleWeight: boolean;
  /** The exercise's first image, shown as the row thumbnail. */
  image1FileId?: string | null | undefined;
}

export interface WorkoutFormValues {
  name: string;
  description: string;
  exercises: WorkoutFormExercise[];
  labels: LabelSelection[];
}

interface WorkoutFormProps {
  initialValues: WorkoutFormValues;
  submitLabel: string;
  onSubmit: (values: WorkoutFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  /** Labels visible to the user (own + public) — fed to the LabelInput autocomplete. */
  labelSuggestions: LabelSuggestion[];
  /** Optional extra controls (e.g. delete button) rendered below submit. */
  extraActions?: React.ReactNode;
}

export function WorkoutForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting,
  labelSuggestions,
  extraActions,
}: WorkoutFormProps) {
  const formId = useFormPageFormId();
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const [exercises, setExercises] = useState<WorkoutFormExercise[]>(initialValues.exercises);
  const [labels, setLabels] = useState<LabelSelection[]>(initialValues.labels);
  const [pickerOpen, setPickerOpen] = useState(false);
  const nameId = useId();
  const descId = useId();
  const exercisesId = useId();

  const sensors = useSensors(
    // Require a small drag distance before activating so taps still register as
    // taps (especially important on mobile where the grip and the row coexist).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    setExercises((items) => {
      const oldIndex = items.findIndex((i) => i.rowId === active.id);
      const newIndex = items.findIndex((i) => i.rowId === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return items;
      }
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function removeExercise(rowId: string) {
    setExercises((items) => items.filter((i) => i.rowId !== rowId));
  }

  function addExercises(picks: PickerSelection[]) {
    setExercises((items) => [
      ...items,
      ...picks.map((p) => ({ ...p, rowId: `new-${crypto.randomUUID()}` })),
    ]);
    setPickerOpen(false);
  }

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;
  const selectedExerciseIds = useMemo(
    () => new Set(exercises.map((e) => e.exerciseId)),
    [exercises],
  );

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    onSubmit({ name: trimmedName, description: description.trim(), exercises, labels });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name and Labels side by side from 640 px, Notes full width (Web · WorkoutEditor). */}
      <div className="grid items-start gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Upper / push day"
            maxLength={120}
            autoFocus
            required
          />
        </div>
        <LabelInput
          value={labels}
          onChange={setLabels}
          suggestions={labelSuggestions}
          disabled={isSubmitting}
          optional={false}
          hint={null}
        />
        <div className="col-span-full flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={descId} className="gap-1.5">
            Notes
            <span className="font-medium text-muted-foreground">Markdown</span>
          </Label>
          <Textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What’s this routine for?"
            rows={3}
          />
        </div>
      </div>

      <section aria-labelledby={exercisesId} className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3.5">
          <h2 id={exercisesId} className="text-[15px] font-semibold">
            Exercises{" "}
            <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
              · {exercises.length}
            </span>
          </h2>
          {exercises.length > 1 ? (
            <span className="text-[13px] text-muted-foreground">
              Drag to change the session order
            </span>
          ) : null}
        </div>

        {exercises.length === 0 ? (
          <p className="border-t px-4 py-5 text-sm text-muted-foreground">
            No exercises yet. Add one to get started.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={exercises.map((e) => e.rowId)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="flex flex-col">
                {exercises.map((ex) => (
                  <SortableExerciseRow
                    key={ex.rowId}
                    exercise={ex}
                    onRemove={() => removeExercise(ex.rowId)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <div className="border-t px-4 py-3">
          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                <Plus />
                Add exercise
              </Button>
            </DialogTrigger>
            <DialogContent className="md:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Add exercises</DialogTitle>
                <DialogDescription>
                  Added to the end of the workout. Drag to reorder.
                </DialogDescription>
              </DialogHeader>
              <ExercisePicker
                alreadySelected={selectedExerciseIds}
                onConfirm={addExercises}
                onCancel={() => setPickerOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <FormActions
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        submitDisabled={trimmedName.length === 0}
        onCancel={onCancel}
        extraActions={extraActions}
      />
    </form>
  );
}

interface SortableExerciseRowProps {
  exercise: WorkoutFormExercise;
  onRemove: () => void;
}

/** Drag handle, photo, name over muscle, CARDIO tag and remove (64 px row). */
function SortableExerciseRow({ exercise, onRemove }: SortableExerciseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.rowId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid min-h-16 grid-cols-[36px_48px_minmax(0,1fr)_auto_36px] items-center gap-2.5 border-t bg-card py-2 pr-3 pl-2",
        isDragging && "relative z-10 rounded-lg shadow-lg ring-2 ring-primary/40",
      )}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${exercise.name}`}
        className="grid size-9 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <ExerciseThumbnail fileId={exercise.image1FileId} />
      <div className="flex min-w-0 flex-col">
        <p className="text-[15px] font-semibold wrap-break-word">{exercise.name}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {formatMuscle(exercise.primaryMuscleGroup)}
          {exercise.doubleWeight ? " · weight per side" : ""}
        </p>
      </div>
      <span>{exercise.kind === "cardio" ? <CardioTag /> : null}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${exercise.name}`}
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
