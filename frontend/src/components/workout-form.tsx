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
import { ExercisePicker, type PickerSelection } from "@/components/exercise-picker";
import { LabelInput, type LabelSelection, type LabelSuggestion } from "@/components/label-input";
import { FormActions } from "@/components/patterns/form-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  primaryMuscleGroup: string;
  doubleWeight: boolean;
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
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium">
            Name
          </label>
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
        <div className="space-y-1.5">
          <label htmlFor={descId} className="text-sm font-medium">
            Description
            <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
          </label>
          <Textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this routine for?"
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            Markdown supported — use <code className="font-mono">**bold**</code>,{" "}
            <code className="font-mono">- lists</code>, headings, and more.
          </p>
        </div>
        <LabelInput
          value={labels}
          onChange={setLabels}
          suggestions={labelSuggestions}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Exercises</h2>
          <span className="text-xs text-muted-foreground">
            {exercises.length} added{exercises.length > 1 ? " · drag to reorder" : ""}
          </span>
        </div>

        {exercises.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-surface-inset px-4 py-6 text-center text-sm text-muted-foreground">
            No exercises yet. Add one to get started.
          </div>
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
              <ol className="space-y-1.5">
                {exercises.map((ex, idx) => (
                  <SortableExerciseRow
                    key={ex.rowId}
                    exercise={ex}
                    index={idx}
                    onRemove={() => removeExercise(ex.rowId)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              disabled={isSubmitting}
            >
              <Plus className="h-4 w-4" />
              Add exercise
            </Button>
          </DialogTrigger>
          <DialogContent className="md:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add exercises</DialogTitle>
            </DialogHeader>
            <ExercisePicker
              alreadySelected={selectedExerciseIds}
              onConfirm={addExercises}
              onCancel={() => setPickerOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

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
  index: number;
  onRemove: () => void;
}

function SortableExerciseRow({ exercise, index, onRemove }: SortableExerciseRowProps) {
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
        "flex items-center gap-2 rounded-md border border-border bg-card/80 px-2 py-2",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="grid h-9 w-7 shrink-0 cursor-grab touch-none place-items-center rounded text-muted-foreground hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{exercise.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatMuscle(exercise.primaryMuscleGroup)}
          {exercise.doubleWeight ? " · two-handed" : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${exercise.name}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
