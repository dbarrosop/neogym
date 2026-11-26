import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { FoodPicker, type FoodPickerOption } from "@/components/food-picker";
import { MealPicker, type MealPickerOption } from "@/components/meal-picker";
import { KindTag } from "@/components/patterns/tag";
import { isEditablePrivateFood } from "@/components/quick-food-dialog";
import { RowActionsMenu, type RowMenuItem } from "@/components/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DECIMAL_INPUT_PATTERN, type MacroTotals } from "@/lib/nutrition";
import { planSlotTimeKey } from "@/lib/nutrition-plan-draft";
import { formatRowKcal, slotKcalProteinCaption } from "@/lib/nutrition-rows";
import { cn } from "@/lib/utils";

export type PlanEntryDraft =
  | {
      clientId: string;
      kind: "meal";
      id?: string;
      mealId: string;
      slotTime: string;
      label: string;
    }
  | {
      clientId: string;
      kind: "food";
      id?: string;
      foodId: string;
      grams: string;
      slotTime: string;
      label: string;
    };

/** One time slot as the editor shows it: saved entries, or an empty slot added with "Add time slot". */
export interface PlanSlotView {
  key: string;
  /** "HH:MM", or "" for legacy entries without a time. */
  time: string;
  label: string;
  /** Set for an empty slot that is not saved until it has an entry. */
  pendingId: string | null;
  entries: PlanEntryDraft[];
  totals: MacroTotals;
}

export interface PlanSlotActions {
  retimeSlot: (slot: PlanSlotView, time: string, focus?: { next?: HTMLElement }) => void;
  removePendingSlot: (pendingId: string) => void;
  addEntry: (slot: PlanSlotView, kind: PlanEntryDraft["kind"]) => void;
  updateEntry: (clientId: string, patch: Partial<PlanEntryDraft>) => void;
  removeEntry: (clientId: string) => void;
  moveEntry: (clientId: string, direction: -1 | 1) => void;
  reorderEntry: (activeId: string, overId: string) => void;
  moveEntryToTime: (entry: PlanEntryDraft, name: string) => void;
  editLabel: (entry: PlanEntryDraft, name: string) => void;
  createFood: (clientId: string) => void;
  editFood: (clientId: string, food: FoodPickerOption) => void;
  createMeal: (clientId: string) => void;
  editMeal: (clientId: string, meal: MealPickerOption) => void;
}

interface PlanSlotsEditorProps {
  slots: PlanSlotView[];
  foods: FoodPickerOption[];
  meals: MealPickerOption[];
  entryTotals: (entry: PlanEntryDraft) => MacroTotals | null;
  disabled: boolean;
  /** A row added with "+ Food"/"+ Meal" opens its picker once it renders. */
  openPickerFor: string | null;
  onPickerOpened: () => void;
  actions: PlanSlotActions;
}

/**
 * The plan editor's time slots (Web · Plan editor): a Time control per slot,
 * single-line FOOD/MEAL rows with select-like pickers, and "+ Food"/"+ Meal".
 * Rows reorder within their slot by dragging the handle (or with the keyboard
 * through the handle or the row menu); a slot's time moves all of its rows.
 */
export function PlanSlotsEditor({
  slots,
  foods,
  meals,
  entryTotals,
  disabled,
  openPickerFor,
  onPickerOpened,
  actions,
}: PlanSlotsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const names = new Map<string, string>();
  for (const slot of slots) {
    for (const entry of slot.entries) {
      names.set(entry.clientId, entryName(entry, foods, meals));
    }
  }
  const nameOf = (id: string | number | undefined) =>
    (id === undefined ? undefined : names.get(String(id))) ?? "entry";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${nameOf(over.id)}.` : `${nameOf(active.id)} moved.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} was dropped at the place of ${nameOf(over.id)}.`
        : `${nameOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      actions.reorderEntry(String(active.id), String(over.id));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements }}
    >
      {slots.map((slot) => (
        <PlanSlotCard
          key={slot.key}
          slot={slot}
          foods={foods}
          meals={meals}
          entryTotals={entryTotals}
          disabled={disabled}
          openPickerFor={openPickerFor}
          onPickerOpened={onPickerOpened}
          actions={actions}
        />
      ))}
    </DndContext>
  );
}

function PlanSlotCard({
  slot,
  foods,
  meals,
  entryTotals,
  disabled,
  openPickerFor,
  onPickerOpened,
  actions,
}: Omit<PlanSlotsEditorProps, "slots"> & { slot: PlanSlotView }) {
  const label = slot.time ? slot.label : "no time";
  return (
    <section
      aria-label={`Time slot ${slot.label}`}
      data-plan-slot={slot.time}
      className="@container/plan-slot rounded-[14px] border bg-card"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 tabular-nums">
        <SlotTimeControl
          time={slot.time}
          label={label}
          disabled={disabled}
          onCommit={(time, focus) => actions.retimeSlot(slot, time, focus)}
        />
        <span className="flex-1" />
        {slot.pendingId ? (
          <>
            <span className="text-[13px] text-muted-foreground">Empty, not saved</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-muted-foreground"
              aria-label={`Remove the empty ${label} slot`}
              onClick={() => actions.removePendingSlot(slot.pendingId as string)}
              disabled={disabled}
            >
              <X />
            </Button>
          </>
        ) : (
          <span className="text-[13px] text-muted-foreground">
            {slotKcalProteinCaption(slot.totals)}
          </span>
        )}
      </div>
      {slot.entries.length > 0 ? (
        <SortableContext
          items={slot.entries.map((entry) => entry.clientId)}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {slot.entries.map((entry, index) => (
              <PlanEntryRow
                key={entry.clientId}
                entry={entry}
                slotLabel={label}
                index={index}
                count={slot.entries.length}
                foods={foods}
                meals={meals}
                totals={entryTotals(entry)}
                disabled={disabled}
                autoOpenPicker={openPickerFor === entry.clientId}
                onPickerOpened={onPickerOpened}
                actions={actions}
              />
            ))}
          </ul>
        </SortableContext>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="h-[34px] text-[13px]"
          aria-label={`Add food at ${label}`}
          onClick={() => actions.addEntry(slot, "food")}
          disabled={disabled}
        >
          <Plus />
          Food
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-[34px] text-[13px]"
          aria-label={`Add meal at ${label}`}
          onClick={() => actions.addEntry(slot, "meal")}
          disabled={disabled}
        >
          <Plus />
          Meal
        </Button>
      </div>
    </section>
  );
}

/**
 * The slot's one Time control. It commits on blur or Enter (not while typing),
 * so passing through another slot's time on the way never merges the two.
 */
function SlotTimeControl({
  time,
  label,
  disabled,
  onCommit,
}: {
  time: string;
  label: string;
  disabled: boolean;
  onCommit: (time: string, focus?: { next?: HTMLElement }) => void;
}) {
  const id = useId();
  const hintId = useId();
  const [value, setValue] = useState(time);

  useEffect(() => {
    setValue(time);
  }, [time]);

  function commit(focus?: { next?: HTMLElement }) {
    const next = planSlotTimeKey(value);
    if (!next) {
      setValue(time);
      return;
    }
    if (next !== time) {
      onCommit(next, focus);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-soft-foreground">
        Time
      </label>
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => {
          const next = event.relatedTarget;
          const sameSlot =
            next instanceof HTMLElement &&
            event.currentTarget.closest("[data-plan-slot]")?.contains(next);
          // Restore focus only if the destination is about to be replaced with this card.
          commit(sameSlot ? { next } : undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit({});
          }
        }}
        disabled={disabled}
        aria-describedby={hintId}
        aria-invalid={time === "" ? true : undefined}
        className="w-auto min-w-[92px] tabular-nums"
      />
      <span id={hintId} className="sr-only">
        Changes the time of every entry in the {label} slot. A time another slot already uses joins
        the two.
      </span>
    </div>
  );
}

/**
 * Web-PlanEditor `.er`: handle | KIND | picker | grams | kcal | actions from
 * 600 px of slot width, not viewport width. Below that the picker takes its
 * own line, followed by grams | kcal | the row menu.
 */
const ROW_GRID =
  "grid min-h-[52px] grid-cols-[minmax(0,1fr)_60px_36px] items-center gap-x-2.5 gap-y-2 border-t px-4 py-2 @min-[600px]/plan-slot:grid-cols-[28px_60px_minmax(0,1fr)_100px_70px_76px] @min-[600px]/plan-slot:py-1.5";

function PlanEntryRow({
  entry,
  slotLabel,
  index,
  count,
  foods,
  meals,
  totals,
  disabled,
  autoOpenPicker,
  onPickerOpened,
  actions,
}: {
  entry: PlanEntryDraft;
  slotLabel: string;
  index: number;
  count: number;
  foods: FoodPickerOption[];
  meals: MealPickerOption[];
  totals: MacroTotals | null;
  disabled: boolean;
  autoOpenPicker: boolean;
  onPickerOpened: () => void;
  actions: PlanSlotActions;
}) {
  const sortable = useSortable({ id: entry.clientId, disabled });
  const pickerRef = useRef<HTMLDivElement>(null);
  const name = entryName(entry, foods, meals);

  useEffect(() => {
    if (!autoOpenPicker) {
      return;
    }
    const trigger = pickerRef.current?.querySelector<HTMLButtonElement>("[data-picker-trigger]");
    trigger?.focus();
    trigger?.click();
    onPickerOpened();
  }, [autoOpenPicker, onPickerOpened]);

  return (
    <li
      ref={sortable.setNodeRef}
      data-plan-entry={entry.clientId}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        ROW_GRID,
        sortable.isDragging && "relative z-10 rounded-[10px] bg-card shadow-lg",
      )}
    >
      <button
        ref={sortable.setActivatorNodeRef}
        type="button"
        aria-label={`Reorder ${name}`}
        className="hidden h-9 w-7 cursor-grab touch-none place-items-center rounded-[7px] text-tertiary-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing disabled:opacity-50 @min-[600px]/plan-slot:grid"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <KindTag kind={entry.kind} className="hidden @min-[600px]/plan-slot:block" />
      <div ref={pickerRef} className="col-span-full min-w-0 @min-[600px]/plan-slot:col-span-1">
        <EntryPicker
          entry={entry}
          slotLabel={slotLabel}
          name={name}
          foods={foods}
          meals={meals}
          disabled={disabled}
          onUpdate={actions.updateEntry}
        />
        {entry.kind === "meal" && entry.label.trim() ? (
          <span className="mt-1 block wrap-anywhere text-xs text-muted-foreground">
            {entry.label.trim()}
          </span>
        ) : null}
      </div>
      {entry.kind === "food" ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="text"
            inputMode="decimal"
            pattern={DECIMAL_INPUT_PATTERN}
            value={entry.grams}
            onChange={(event) => actions.updateEntry(entry.clientId, { grams: event.target.value })}
            placeholder="100"
            aria-label={`${name} grams`}
            disabled={disabled}
            className="w-[70px] px-2.5 text-right tabular-nums"
          />
          <span className="text-[13px] text-muted-foreground">g</span>
        </div>
      ) : (
        <span aria-hidden="true" className="text-muted-foreground">
          —
        </span>
      )}
      <span className="text-right text-sm font-semibold tabular-nums">
        {totals ? formatRowKcal(totals.kcal) : "—"}
        <span className="sr-only"> kcal</span>
      </span>
      <div className="flex items-center justify-end gap-1">
        <RowActionsMenu
          label={`More actions for ${name}`}
          items={entryMenuItems({ entry, name, index, count, foods, meals, actions })}
          disabled={disabled}
        />
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={() => actions.removeEntry(entry.clientId)}
          disabled={disabled}
          className="hidden size-9 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 @min-[600px]/plan-slot:grid"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </li>
  );
}

function EntryPicker({
  entry,
  slotLabel,
  name,
  foods,
  meals,
  disabled,
  onUpdate,
}: {
  entry: PlanEntryDraft;
  slotLabel: string;
  name: string;
  foods: FoodPickerOption[];
  meals: MealPickerOption[];
  disabled: boolean;
  onUpdate: (clientId: string, patch: Partial<PlanEntryDraft>) => void;
}) {
  if (entry.kind === "meal") {
    return (
      <MealPicker
        mode="select"
        aria-label={entry.mealId ? `Meal at ${slotLabel}, ${name}` : `Meal at ${slotLabel}`}
        meals={meals}
        value={entry.mealId}
        onChange={(mealId) => onUpdate(entry.clientId, { mealId })}
        disabled={disabled}
      />
    );
  }
  return (
    <FoodPicker
      mode="select"
      aria-label={entry.foodId ? `Food at ${slotLabel}, ${name}` : `Food at ${slotLabel}`}
      foods={foods}
      value={entry.foodId}
      onChange={(foodId) => onUpdate(entry.clientId, { foodId })}
      disabled={disabled}
    />
  );
}

/** The row's spoken name: the meal's label or name, the food's name, or its kind until chosen. */
export function entryName(
  entry: PlanEntryDraft,
  foods: readonly FoodPickerOption[],
  meals: readonly MealPickerOption[],
): string {
  if (entry.kind === "meal") {
    const label = entry.label.trim();
    return label || meals.find((meal) => meal.id === entry.mealId)?.name || "new meal";
  }
  return foods.find((food) => food.id === entry.foodId)?.name ?? "new food";
}

function entryMenuItems({
  entry,
  name,
  index,
  count,
  foods,
  meals,
  actions,
}: {
  entry: PlanEntryDraft;
  name: string;
  index: number;
  count: number;
  foods: FoodPickerOption[];
  meals: MealPickerOption[];
  actions: PlanSlotActions;
}): RowMenuItem[] {
  const { clientId } = entry;
  const items: RowMenuItem[] = [
    { label: "Move up", onSelect: () => actions.moveEntry(clientId, -1), disabled: index === 0 },
    {
      label: "Move down",
      onSelect: () => actions.moveEntry(clientId, 1),
      disabled: index === count - 1,
    },
    { label: "Move to another time…", onSelect: () => actions.moveEntryToTime(entry, name) },
  ];
  if (entry.kind === "meal") {
    const meal = meals.find((candidate) => candidate.id === entry.mealId);
    const label = entry.label.trim();
    items.push({
      label: label ? `Edit label “${label}”…` : "Add label…",
      onSelect: () => actions.editLabel(entry, name),
    });
    if (meal) {
      items.push({ label: "Edit meal…", onSelect: () => actions.editMeal(clientId, meal) });
    }
    items.push({ label: "New meal…", onSelect: () => actions.createMeal(clientId) });
  } else {
    const food = foods.find((candidate) => candidate.id === entry.foodId) ?? null;
    if (food && isEditablePrivateFood(food)) {
      items.push({ label: "Edit food…", onSelect: () => actions.editFood(clientId, food) });
    }
    items.push({ label: "New private food…", onSelect: () => actions.createFood(clientId) });
  }
  items.push({ label: "Remove", destructive: true, onSelect: () => actions.removeEntry(clientId) });
  return items;
}
