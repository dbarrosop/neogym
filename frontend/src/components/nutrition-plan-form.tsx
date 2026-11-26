import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  type ReactNode,
  type SubmitEvent,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { FoodPickerOption } from "@/components/food-picker";
import type { MealPickerOption } from "@/components/meal-picker";
import {
  type PlanEntryDraft,
  type PlanSlotActions,
  PlanSlotsEditor,
  type PlanSlotView,
} from "@/components/nutrition-plan-slots";
import { FormActions } from "@/components/patterns/form-actions";
import { ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { QuickFoodDialog } from "@/components/quick-food-dialog";
import { QuickMealDialog } from "@/components/quick-meal-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { graphql } from "@/gql";
import { useFormPageFormId } from "@/lib/form-page-context";
import { gqlRequest } from "@/lib/graphql";
import { formatKcal } from "@/lib/metric-format";
import {
  EMPTY_MACRO_TOTALS,
  formatTimeOfDay,
  formatWholeGrams,
  groupPlanDraftEntriesByTimeSlot,
  type MacroTotals,
  movePlanDraftEntryWithinSlot,
  type PlanEntry,
  parseMacroInput,
  planEntriesMacroTotals,
  planEntryMacroTotals,
  sortAndRenumberPlanEntriesByTime,
  timeToInputValue,
} from "@/lib/nutrition";
import {
  movePlanDraftEntryToTime,
  planSlotTimeKey,
  reorderPlanDraftEntryWithinSlot,
  retimePlanDraftSlot,
  suggestedPlanSlotTime,
} from "@/lib/nutrition-plan-draft";

const NutritionPlanFormPickersQuery = graphql(`
  query NutritionPlanFormPickers {
    meals(order_by: [{ name: asc }]) {
      id
      name
      description
      mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
        id
        grams
        position
        food {
          id
          name
          kcalPer100g
          fatPer100g
          carbsPer100g
          proteinPer100g
          fiberPer100g
          sugarPer100g
        }
      }
    }
    foods(order_by: [{ isPublic: asc }, { name: asc }]) {
      id
      name
      userId
      isPublic
      kcalPer100g
      fatPer100g
      carbsPer100g
      proteinPer100g
      fiberPer100g
      sugarPer100g
    }
  }
`);

export type NutritionPlanFormEntryValues =
  | {
      kind: "meal";
      id?: string;
      mealId: string;
      slotTime: string;
      label: string;
      position: number;
    }
  | {
      kind: "food";
      id?: string;
      foodId: string;
      grams: number;
      slotTime: string;
      label: string;
      position: number;
    };

export interface NutritionPlanFormValues {
  name: string;
  description: string;
  entries: NutritionPlanFormEntryValues[];
}

interface NutritionPlanFormProps {
  initialValues: NutritionPlanFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: NutritionPlanFormValues) => void;
  onCancel: () => void;
  extraActions?: ReactNode;
}

type FoodDialogState =
  | { kind: "create"; clientId: string }
  | { kind: "edit"; clientId: string; food: FoodPickerOption };

type MealDialogState =
  | { kind: "create"; clientId: string }
  | { kind: "edit"; clientId: string; meal: MealPickerOption };

/** A one-field prompt for "Move to another time…" and "Edit label…". */
interface PromptRequest {
  entryId: string;
  title: string;
  description: string;
  field: string;
  type: "time" | "text";
  initialValue: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
}

interface PendingSlot {
  id: string;
  time: string;
}

let nextClientId = 0;

function createClientId(prefix = "plan-entry") {
  nextClientId += 1;
  return `${prefix}-${Date.now()}-${nextClientId}`;
}

function mergeById<TOption extends { id: string; name: string }>(
  base: TOption[],
  local: TOption[],
  compare: (left: TOption, right: TOption) => number,
) {
  const byId = new Map<string, TOption>();
  for (const option of [...base, ...local]) {
    byId.set(option.id, option);
  }
  return Array.from(byId.values()).toSorted(compare);
}

const compareFoods = (left: FoodPickerOption, right: FoodPickerOption) =>
  Number(left.isPublic) - Number(right.isPublic) || left.name.localeCompare(right.name);
const compareMeals = (left: MealPickerOption, right: MealPickerOption) =>
  left.name.localeCompare(right.name);

function createDraftFromInitialEntry(entry: NutritionPlanFormEntryValues): PlanEntryDraft {
  const common = {
    slotTime: timeToInputValue(entry.slotTime),
    ...(entry.id ? { id: entry.id } : {}),
  };
  if (entry.kind === "meal") {
    return {
      clientId: `meal:${entry.id ?? createClientId()}`,
      kind: "meal",
      mealId: entry.mealId,
      label: entry.label,
      ...common,
    };
  }
  return {
    clientId: `food:${entry.id ?? createClientId()}`,
    kind: "food",
    foodId: entry.foodId,
    grams: String(entry.grams),
    label: "",
    ...common,
  };
}

function draftEntriesToFormValues(
  entries: Array<PlanEntryDraft & { position: number }>,
): NutritionPlanFormEntryValues[] {
  return entries.map((entry) => {
    const common = {
      slotTime: entry.slotTime,
      position: entry.position,
      ...(entry.id ? { id: entry.id } : {}),
    };
    if (entry.kind === "meal") {
      return { kind: "meal", mealId: entry.mealId, label: entry.label.trim(), ...common };
    }
    return {
      kind: "food",
      foodId: entry.foodId,
      grams: parseMacroInput(entry.grams) ?? 0,
      label: "",
      ...common,
    };
  });
}

/** The draft entries plus empty slots added with "Add time slot" (not saved until filled). */
function usePlanDraft(initialEntries: NutritionPlanFormEntryValues[]) {
  const [entries, setEntries] = useState<PlanEntryDraft[]>(() =>
    sortAndRenumberPlanEntriesByTime(initialEntries).map(createDraftFromInitialEntry),
  );
  const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>([]);
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

  const idOf = (entry: PlanEntryDraft) => entry.clientId;
  const announceMerge = (time: string) => toast.info(`Joined the ${formatTimeOfDay(time)} slot`);
  const clearOpenPicker = useCallback(() => setOpenPickerFor(null), []);

  function removePendingSlot(id: string) {
    setPendingSlots((current) => current.filter((slot) => slot.id !== id));
  }

  function updateEntry(clientId: string, patch: Partial<PlanEntryDraft>) {
    setEntries((current) =>
      current.map((entry) =>
        entry.clientId === clientId ? ({ ...entry, ...patch } as PlanEntryDraft) : entry,
      ),
    );
  }

  function addSlot(existingTimes: string[]) {
    const time = suggestedPlanSlotTime([
      ...existingTimes,
      ...pendingSlots.map((slot) => slot.time),
    ]);
    setPendingSlots((current) => [...current, { id: createClientId("slot"), time }]);
  }

  function retimeSlot(slot: PlanSlotView, time: string) {
    const pendingId = slot.pendingId;
    if (pendingId) {
      setPendingSlots((current) =>
        current.map((item) => (item.id === pendingId ? { id: pendingId, time } : item)),
      );
      return;
    }
    const result = retimePlanDraftSlot(entries, slot.time, time);
    setEntries(result.entries);
    if (result.merged) {
      announceMerge(time);
    }
  }

  function addEntry(slot: PlanSlotView, kind: PlanEntryDraft["kind"]) {
    const clientId = createClientId();
    const common = { clientId, slotTime: slot.time, label: "" };
    const entry: PlanEntryDraft =
      kind === "meal"
        ? { ...common, kind, mealId: "" }
        : { ...common, kind, foodId: "", grams: "100" };
    setEntries((current) => [...current, entry]);
    if (slot.pendingId) {
      removePendingSlot(slot.pendingId);
    }
    setOpenPickerFor(clientId);
  }

  function moveEntryToTime(clientId: string, time: string) {
    const result = movePlanDraftEntryToTime(entries, clientId, time, idOf);
    setEntries(result.entries);
    if (result.merged) {
      announceMerge(time);
    }
  }

  return {
    entries,
    pendingSlots,
    openPickerFor,
    clearOpenPicker,
    addSlot,
    removePendingSlot,
    retimeSlot,
    addEntry,
    updateEntry,
    removeEntry: (clientId: string) =>
      setEntries((current) => current.filter((entry) => entry.clientId !== clientId)),
    moveEntry: (clientId: string, direction: -1 | 1) =>
      setEntries((current) => movePlanDraftEntryWithinSlot(current, clientId, direction, idOf)),
    reorderEntry: (activeId: string, overId: string) =>
      setEntries((current) => reorderPlanDraftEntryWithinSlot(current, activeId, overId, idOf)),
    moveEntryToTime,
  };
}

function buildSlotViews(
  entries: PlanEntryDraft[],
  pendingSlots: PendingSlot[],
  entryTotals: (entry: PlanEntryDraft) => MacroTotals | null,
): PlanSlotView[] {
  const saved = groupPlanDraftEntriesByTimeSlot(entries, {
    getEntryTotals: (entry) => entryTotals(entry) ?? EMPTY_MACRO_TOTALS,
  }).map((slot) => ({
    key: slot.key,
    time: planSlotTimeKey(slot.entries[0]?.slotTime),
    label: slot.label,
    pendingId: null,
    entries: slot.entries,
    totals: slot.totals,
    sortKey: slot.sortKey,
  }));
  const savedTimes = new Set(saved.map((slot) => slot.time));
  const pending = pendingSlots
    .filter((slot) => !savedTimes.has(slot.time))
    .map((slot) => ({
      key: `pending:${slot.id}`,
      time: slot.time,
      label: formatTimeOfDay(slot.time),
      pendingId: slot.id,
      entries: [],
      totals: EMPTY_MACRO_TOTALS,
      sortKey: slot.time,
    }));
  return [...saved, ...pending]
    .toSorted((left, right) => left.sortKey.localeCompare(right.sortKey))
    .map(({ sortKey: _sortKey, ...slot }) => slot);
}

function validationError(
  entries: PlanEntryDraft[],
  name: string,
  foodsById: Map<string, FoodPickerOption>,
  mealsById: Map<string, MealPickerOption>,
): string | null {
  if (name.length === 0) {
    return "Name is required.";
  }
  if (entries.length === 0) {
    return "Add at least one meal or food to this plan.";
  }
  if (entries.some((entry) => entry.kind === "meal" && !mealsById.has(entry.mealId))) {
    return "Every meal entry needs a selected meal.";
  }
  if (entries.some((entry) => entry.kind === "food" && !foodsById.has(entry.foodId))) {
    return "Every food entry needs a selected food.";
  }
  if (
    entries.some((entry) => {
      const grams = entry.kind === "food" ? parseMacroInput(entry.grams) : 1;
      return grams === null || grams <= 0;
    })
  ) {
    return "Every food entry needs grams greater than zero.";
  }
  if (entries.some((entry) => planSlotTimeKey(entry.slotTime) === "")) {
    return "Every time slot needs a time of day.";
  }
  return null;
}

export function NutritionPlanForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  extraActions,
}: NutritionPlanFormProps) {
  const formId = useFormPageFormId();
  const formRef = useRef<HTMLFormElement>(null);
  const retimeFocus = useRef<{ time: string; next?: HTMLElement } | null>(null);
  const errorId = useId();
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const draft = usePlanDraft(initialValues.entries);
  const [submitted, setSubmitted] = useState(false);
  const [localFoods, setLocalFoods] = useState<FoodPickerOption[]>([]);
  const [localMeals, setLocalMeals] = useState<MealPickerOption[]>([]);
  const [foodDialog, setFoodDialog] = useState<FoodDialogState | null>(null);
  const [mealDialog, setMealDialog] = useState<MealDialogState | null>(null);
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);

  const pickers = useQuery({
    queryKey: ["nutrition", "plan-form", "pickers"],
    queryFn: () => gqlRequest(NutritionPlanFormPickersQuery),
  });
  const meals = useMemo(
    () => mergeById<MealPickerOption>(pickers.data?.meals ?? [], localMeals, compareMeals),
    [pickers.data, localMeals],
  );
  const foods = useMemo(
    () => mergeById<FoodPickerOption>(pickers.data?.foods ?? [], localFoods, compareFoods),
    [pickers.data, localFoods],
  );
  const mealsById = useMemo(() => new Map(meals.map((meal) => [meal.id, meal])), [meals]);
  const foodsById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);

  const entryTotals = (entry: PlanEntryDraft): MacroTotals | null => {
    const planEntry = toPlanEntry(entry, foodsById, mealsById);
    return planEntry ? planEntryMacroTotals(planEntry) : null;
  };
  const totals = planEntriesMacroTotals(
    draft.entries.flatMap((entry) => toPlanEntry(entry, foodsById, mealsById) ?? []),
  );
  const slots = buildSlotViews(draft.entries, draft.pendingSlots, entryTotals);
  useLayoutEffect(() => {
    const focus = retimeFocus.current;
    retimeFocus.current = null;
    if (focus && !focus.next?.isConnected) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[data-plan-slot="${focus.time}"] input[type="time"]`)
        ?.focus();
    }
  });
  const error = validationError(draft.entries, name.trim(), foodsById, mealsById);
  const formError = submitted ? error : null;

  const actions: PlanSlotActions = {
    ...draft,
    retimeSlot: (slot, time, focus) => {
      retimeFocus.current = focus ? { time, ...focus } : null;
      draft.retimeSlot(slot, time);
    },
    moveEntryToTime: (entry, entryName) =>
      setPrompt({
        entryId: entry.clientId,
        title: `Move ${entryName}`,
        description: "Pick a time. If a slot already uses it, the entry joins that slot.",
        field: "Time",
        type: "time",
        initialValue: planSlotTimeKey(entry.slotTime),
        confirmLabel: "Move",
        onConfirm: (time) => draft.moveEntryToTime(entry.clientId, time),
      }),
    editLabel: (entry, entryName) =>
      setPrompt({
        entryId: entry.clientId,
        title: `Label for ${entryName}`,
        description: "Optional. The meal's name shows when it is empty.",
        field: "Label",
        type: "text",
        initialValue: entry.label,
        confirmLabel: "Save",
        onConfirm: (label) => draft.updateEntry(entry.clientId, { label: label.slice(0, 160) }),
      }),
    createFood: (clientId) => setFoodDialog({ kind: "create", clientId }),
    editFood: (clientId, food) => setFoodDialog({ kind: "edit", clientId, food }),
    createMeal: (clientId) => setMealDialog({ kind: "create", clientId }),
    editMeal: (clientId, meal) => setMealDialog({ kind: "edit", clientId, meal }),
  };

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (isSubmitting || pickers.isLoading || error) {
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      entries: draftEntriesToFormValues(sortAndRenumberPlanEntriesByTime(draft.entries)),
    });
  }

  return (
    <>
      <form ref={formRef} id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <PlanDetailsCard
          name={name}
          description={description}
          totals={totals}
          nameInvalid={submitted && name.trim().length === 0}
          errorId={formError ? errorId : undefined}
          onNameChange={setName}
          onDescriptionChange={setDescription}
        />
        {pickers.isLoading ? <PlanSlotsSkeleton /> : null}
        {pickers.error ? (
          <ErrorState
            title="Couldn't load your foods and meals"
            message={pickers.error.message}
            onRetry={() => pickers.refetch()}
            isRetrying={pickers.isFetching}
          />
        ) : null}
        {!pickers.isLoading && slots.length === 0 ? (
          <p className="rounded-[14px] border-[1.5px] border-border-strong border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
            Add a time slot, then the foods and meals you plan to eat at that time.
          </p>
        ) : null}
        <PlanSlotsEditor
          slots={slots}
          foods={foods}
          meals={meals}
          entryTotals={entryTotals}
          disabled={isSubmitting}
          openPickerFor={draft.openPickerFor}
          onPickerOpened={draft.clearOpenPicker}
          actions={actions}
        />
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => draft.addSlot(slots.map((slot) => slot.time))}
          disabled={isSubmitting || pickers.isLoading}
        >
          <Plus />
          Add time slot
        </Button>
        {formError ? (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <FormActions
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          submitDisabled={pickers.isLoading}
          onCancel={onCancel}
          extraActions={extraActions}
        />
      </form>
      <PlanPromptDialog
        request={prompt}
        onClose={() => setPrompt(null)}
        onReturnFocus={(id) => {
          const rows = formRef.current?.querySelectorAll<HTMLElement>("[data-plan-entry]") ?? [];
          const row = Array.from(rows).find((element) => element.dataset["planEntry"] === id);
          row?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.focus();
        }}
      />
      <NutritionPlanInlineDialogs
        foodDialog={foodDialog}
        mealDialog={mealDialog}
        onFoodSaved={(food) => {
          setLocalFoods((current) => mergeById(current, [food], compareFoods));
          if (foodDialog?.kind === "create") {
            draft.updateEntry(foodDialog.clientId, { foodId: food.id });
          }
        }}
        onMealSaved={(meal) => {
          setLocalMeals((current) => mergeById(current, [meal], compareMeals));
          if (mealDialog?.kind === "create") {
            draft.updateEntry(mealDialog.clientId, { mealId: meal.id });
          }
        }}
        onCloseFood={() => setFoodDialog(null)}
        onCloseMeal={() => setMealDialog(null)}
      />
    </>
  );
}

function toPlanEntry(
  entry: PlanEntryDraft,
  foodsById: Map<string, FoodPickerOption>,
  mealsById: Map<string, MealPickerOption>,
): PlanEntry | null {
  const common = { id: entry.clientId, slotTime: entry.slotTime, label: entry.label, position: 0 };
  if (entry.kind === "meal") {
    const meal = mealsById.get(entry.mealId);
    return meal ? { ...common, kind: "meal", meal } : null;
  }
  const food = foodsById.get(entry.foodId);
  return food ? { ...common, kind: "food", food, grams: parseMacroInput(entry.grams) ?? 0 } : null;
}

/** Name, the live planned total and the Markdown description (Web · Plan editor). */
function PlanDetailsCard({
  name,
  description,
  totals,
  nameInvalid,
  errorId,
  onNameChange,
  onDescriptionChange,
}: {
  name: string;
  description: string;
  totals: MacroTotals;
  nameInvalid: boolean;
  errorId: string | undefined;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
}) {
  const nameId = useId();
  const descriptionId = useId();
  return (
    <section
      aria-label="Plan details"
      className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4 rounded-[14px] border bg-card p-5"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g. Training day"
          maxLength={160}
          aria-invalid={nameInvalid}
          aria-describedby={errorId}
          autoFocus
          required
        />
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1 tabular-nums">
        <div className="flex flex-col">
          <span className="text-[13px] text-muted-foreground">Planned total</span>
          <strong className="text-[22px] font-bold">{formatKcal(totals.kcal)}</strong>
        </div>
        <span className="pb-1 text-sm">
          P <strong>{formatWholeGrams(totals.protein)}</strong> · C{" "}
          <strong>{formatWholeGrams(totals.carbs)}</strong> · F{" "}
          <strong>{formatWholeGrams(totals.fat)}</strong> g
        </span>
      </div>
      <div className="col-span-full flex flex-col gap-1.5">
        <Label htmlFor={descriptionId}>
          Description <span className="font-medium text-muted-foreground">· Markdown</span>
        </Label>
        <Textarea
          id={descriptionId}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="When you use this one-day template, or any prep notes."
          maxLength={1000}
          rows={3}
        />
      </div>
    </section>
  );
}

function PlanPromptDialog({
  request,
  onClose,
  onReturnFocus,
}: {
  request: PromptRequest | null;
  onClose: () => void;
  onReturnFocus: (entryId: string) => void;
}) {
  const fieldId = useId();
  const closingEntry = useRef<string | null>(null);
  const [value, setValue] = useState("");
  const [shown, setShown] = useState<PromptRequest | null>(null);
  if (request !== shown) {
    setShown(request);
    setValue(request?.initialValue ?? "");
  }
  const invalid = request?.type === "time" && planSlotTimeKey(value) === "";

  function close() {
    closingEntry.current = request?.entryId ?? null;
    onClose();
  }

  return (
    <Dialog open={request !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent
        className="md:max-w-[420px]"
        onCloseAutoFocus={(event) => {
          const entryId = closingEntry.current;
          closingEntry.current = null;
          if (entryId) {
            // The old trigger can be detached after moving the row to a new slot.
            event.preventDefault();
            onReturnFocus(entryId);
          }
        }}
      >
        <form
          className="flex flex-col gap-[18px]"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (request && !invalid) {
              request.onConfirm(value);
              close();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            <DialogDescription>{request?.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId}>{request?.field}</Label>
            <Input
              id={fieldId}
              type={request?.type ?? "text"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={request?.type === "text" ? 160 : undefined}
              className="tabular-nums"
              required={request?.type === "time"}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={invalid}>
              {request?.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NutritionPlanInlineDialogs({
  foodDialog,
  mealDialog,
  onCloseFood,
  onCloseMeal,
  onFoodSaved,
  onMealSaved,
}: {
  foodDialog: FoodDialogState | null;
  mealDialog: MealDialogState | null;
  onCloseFood: () => void;
  onCloseMeal: () => void;
  onFoodSaved: (food: FoodPickerOption) => void;
  onMealSaved: (meal: MealPickerOption) => void;
}) {
  return (
    <>
      {foodDialog ? (
        <QuickFoodDialog
          open={true}
          mode={
            foodDialog.kind === "create"
              ? { kind: "create" }
              : { kind: "edit", food: foodDialog.food }
          }
          onOpenChange={(open) => {
            if (!open) {
              onCloseFood();
            }
          }}
          onSaved={onFoodSaved}
        />
      ) : null}
      {mealDialog ? (
        <QuickMealDialog
          open={true}
          mode={
            mealDialog.kind === "create"
              ? { kind: "create" }
              : { kind: "edit", meal: mealDialog.meal }
          }
          onOpenChange={(open) => {
            if (!open) {
              onCloseMeal();
            }
          }}
          onSaved={onMealSaved}
        />
      ) : null}
    </>
  );
}

function PlanSlotsSkeleton() {
  return (
    <SkeletonState className="flex flex-col gap-3 rounded-[14px] border bg-card p-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-[52px] w-full" />
      <Skeleton className="h-[52px] w-full" />
    </SkeletonState>
  );
}
