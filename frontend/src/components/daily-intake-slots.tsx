import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, X } from "lucide-react";
import { type FocusEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import type { LogPlanFoodSlot, LogPlanSlot } from "@/components/log-intake-dialog";
import { MacroLine } from "@/components/macro-line";
import { KcalCell, LOG_ROW_GRID, MacroCells } from "@/components/nutrition-row-cells";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { KindTag } from "@/components/patterns/tag";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type AdHocLogEntryUpdateSet,
  type AdHocNutritionDraft,
  adHocNutritionDraftTotals,
  buildAdHocLogEntryUpdateSet,
  buildPlanLogInputs,
  createEmptyAdHocNutritionDraft,
  currentTimeInputValue,
  DECIMAL_INPUT_PATTERN,
  type IntakeTimeSlot,
  loggedEntryMacroTotals,
  type MacroTotals,
  macroTotalsSummary,
  NUTRIENT_FIELDS,
  normalizeNumeric,
  type PlanTimeSlot,
  parseMacroInput,
  planEntryMacroTotals,
  timeToInputValue,
} from "@/lib/nutrition";
import { logSelectedPlanMaterialization } from "@/lib/nutrition-plan-log";
import { formatRowGrams, formatRowKcal } from "@/lib/nutrition-rows";
import { cn } from "@/lib/utils";

export type DailyEntry = {
  id: string;
  source: string;
  nutritionLogMealId?: string | null;
  foodId?: string | null;
  grams: unknown;
  position: number;
  slotTime?: string | null;
  snapshotFoodName: string;
  snapshotKcalPer100g: unknown;
  snapshotFatPer100g: unknown;
  snapshotCarbsPer100g: unknown;
  snapshotProteinPer100g: unknown;
  snapshotFiberPer100g: unknown;
  snapshotSugarPer100g: unknown;
};

export type DailyLogMeal = {
  id: string;
  mealId?: string | null;
  nutritionPlanMealId?: string | null;
  name: string;
  slotTime?: string | null;
  position: number;
  nutritionLogEntries: DailyEntry[];
};

export type DailyPlan = {
  id: string;
  name: string;
  description?: string | null;
  nutritionPlanMeals: LogPlanSlot[];
  nutritionPlanFoods: LogPlanFoodSlot[];
};

export type DailyPlanEntry =
  | (LogPlanSlot & { kind: "meal" })
  | (LogPlanFoodSlot & { kind: "food" });
export type DailyPlanTimeSlot = PlanTimeSlot<DailyPlanEntry>;

export type EntryUpdateSet = { grams: number } | AdHocLogEntryUpdateSet;

/** Query keys every day-log write refreshes (the calorie history lives under the index key). */
export function invalidateDayLog(
  queryClient: ReturnType<typeof useQueryClient>,
  date: string,
): void {
  queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
  queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
  queryClient.invalidateQueries({ queryKey: ["today"] });
}

const ROW_CLASS = "min-h-11 border-t border-border pr-2 pl-4 text-sm tabular-nums";

/** Time, Logged/Planned pill, kcal and an optional action, then the slot's P · C · F line. */
function SlotHeader({
  label,
  status,
  totals,
  action,
}: {
  label: string;
  status: "Logged" | "Planned";
  totals: MacroTotals;
  action?: ReactNode;
}) {
  const planned = status === "Planned";
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 tabular-nums">
        <strong className="text-[15px] font-semibold">{label}</strong>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full px-2 text-[12px] font-semibold",
            planned ? "bg-muted text-muted-foreground" : "bg-positive-soft text-positive",
          )}
        >
          {status}
        </span>
        <span className="ml-auto text-[13px] text-muted-foreground">
          {formatRowKcal(totals.kcal)} kcal
        </span>
        {action}
      </header>
      <MacroLine totals={totals} dimmed={planned} className="px-4 pb-3" />
    </>
  );
}

export function LoggedSlotCard({
  slot,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteGroup,
  disabled,
}: {
  slot: IntakeTimeSlot<DailyEntry>;
  onUpdateEntry: (entryId: string, set: EntryUpdateSet) => void;
  onDeleteEntry: (entryId: string, onSuccess: () => void) => void;
  onDeleteGroup: (groupId: string, onSuccess: () => void) => void;
  disabled: boolean;
}) {
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const entryToDelete = slot.entries.find(({ entry }) => entry.id === deleteEntryId)?.entry;
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const groupToDelete = slot.mealGroups.find((group) => group.id === deleteGroupId);

  return (
    <section aria-label={`${slot.label}, logged`} className="rounded-[14px] border bg-card">
      <SlotHeader label={slot.label} status="Logged" totals={slot.totals} />
      {slot.mealGroups.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {slot.mealGroups.map((group) => (
            <span
              key={group.id}
              className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-full bg-surface-inset pl-3 text-[13px]"
            >
              <span className="min-w-0 break-words font-medium">{group.name}</span>
              <span className="shrink-0 text-muted-foreground">
                · {formatEntryCount(group.entryCount)}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setDeleteGroupId(group.id)}
                disabled={disabled}
                className="size-11 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${group.name} and its entries`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          ))}
        </div>
      ) : null}
      {slot.entries.length === 0 ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">No entries.</p>
      ) : (
        <ul>
          {slot.entries.map((slotEntry) => (
            <EntryRow
              key={slotEntry.entry.id}
              entry={slotEntry.entry}
              onUpdate={(set) => onUpdateEntry(slotEntry.entry.id, set)}
              onDelete={() => setDeleteEntryId(slotEntry.entry.id)}
              disabled={disabled}
              provenance={slotEntry.mealName ? `From ${slotEntry.mealName}` : undefined}
            />
          ))}
        </ul>
      )}
      {entryToDelete ? (
        <ConfirmActionDialog
          open={true}
          onOpenChange={(open) => {
            if (!open && !disabled) {
              setDeleteEntryId(null);
            }
          }}
          title={`Delete ${entryToDelete.snapshotFoodName}?`}
          description="This logged entry will be deleted. This can't be undone."
          confirmLabel="Delete entry"
          pendingLabel="Deleting…"
          onConfirm={() => onDeleteEntry(entryToDelete.id, () => setDeleteEntryId(null))}
          isPending={disabled}
          destructive={true}
        />
      ) : null}
      {groupToDelete ? (
        <ConfirmActionDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteGroupId(null);
            }
          }}
          title={`Delete ${groupToDelete.name}?`}
          description={`This logged meal and its ${formatEntryCount(groupToDelete.entryCount)} will be deleted. This can't be undone.`}
          confirmLabel="Delete meal"
          pendingLabel="Deleting…"
          onConfirm={() => onDeleteGroup(groupToDelete.id, () => setDeleteGroupId(null))}
          isPending={disabled}
          destructive={true}
        />
      ) : null}
    </section>
  );
}

function formatEntryCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "item" : "items"}`;
}

/** "3 planned items" (the Log slot confirmation and toast never say "all"). */
export function formatPlannedItemCount(count: number): string {
  return `${count.toLocaleString()} planned ${count === 1 ? "item" : "items"}`;
}

/**
 * A selected-plan slot; each Log appends all its entries, including on re-log.
 * When intake is already logged at the same time the action steps back to an
 * outline button and asks first, so a stray tap cannot duplicate the slot. Matching
 * times do not prove the plan was followed, so the card never claims it was.
 */
export function PlannedSlotCard({
  plan,
  slot,
  ensureDay,
  date,
  existingMealGroups,
  existingStandaloneEntries,
  hasLoggedIntake,
  disabled,
}: {
  plan: DailyPlan;
  slot: DailyPlanTimeSlot;
  ensureDay: () => Promise<string>;
  date: string;
  existingMealGroups: DailyLogMeal[];
  existingStandaloneEntries: DailyEntry[];
  hasLoggedIntake: boolean;
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const timed = timeToInputValue(slot.key) !== "";
  const itemCount = slot.entries.length;
  const slotMutation = useMutation({
    mutationFn: async () => {
      const dayId = await ensureDay();
      const nutritionPlanMeals: LogPlanSlot[] = [];
      const nutritionPlanFoods: LogPlanFoodSlot[] = [];

      for (const entry of slot.entries) {
        if (entry.kind === "meal") {
          const { kind: _kind, ...mealSlot } = entry;
          nutritionPlanMeals.push(mealSlot);
        } else {
          const { kind: _kind, ...foodSlot } = entry;
          nutritionPlanFoods.push(foodSlot);
        }
      }

      const slotTime = timeToInputValue(slot.key) || currentTimeInputValue();
      const materialization = buildPlanLogInputs({
        selectedPlan: { ...plan, nutritionPlanMeals, nutritionPlanFoods },
        nutritionDayId: dayId,
        existingMealGroups,
        existingStandaloneEntries,
        slotTimeByKey: { [slot.key]: slotTime },
      });
      return logSelectedPlanMaterialization(materialization);
    },
    onSuccess: () => {
      invalidateDayLog(queryClient, date);
      setConfirming(false);
      toast.success(`Logged ${slot.label} · ${formatEntryCount(itemCount)}`);
    },
    onError: (error) => {
      toast.error(`Failed to log ${slot.label}: ${error.message}`);
    },
  });

  return (
    <section
      aria-label={`${slot.label}, planned`}
      className="rounded-[14px] border-[1.5px] border-border-strong border-dashed"
    >
      <SlotHeader
        label={slot.label}
        status="Planned"
        totals={slot.totals}
        action={
          <Button
            type="button"
            size="sm"
            variant={hasLoggedIntake ? "outline" : "default"}
            onClick={() => (hasLoggedIntake ? setConfirming(true) : slotMutation.mutate())}
            disabled={disabled || slotMutation.isPending || itemCount === 0}
          >
            {slotMutation.isPending ? "Logging…" : "Log slot"}
          </Button>
        }
      />
      <ul>
        {slot.entries.map((entry) => (
          <PlannedEntryRow key={sourceKeyForDailyPlanEntry(entry)} entry={entry} />
        ))}
      </ul>
      {confirming ? (
        <ConfirmActionDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setConfirming(false);
            }
          }}
          title="Log this planned slot?"
          description={`${timed ? `Food is already logged at ${slot.label}.` : "Food without a time is already logged."} This adds ${formatPlannedItemCount(itemCount)} ${timed ? `at ${slot.label}` : "at the current time"}; nothing already logged changes.`}
          confirmLabel="Log slot"
          pendingLabel="Logging…"
          onConfirm={() => slotMutation.mutate()}
          isPending={disabled || slotMutation.isPending}
        />
      ) : null}
    </section>
  );
}

function PlannedEntryRow({ entry }: { entry: DailyPlanEntry }) {
  const totals = planEntryMacroTotals(entry);
  const title = entry.kind === "meal" ? entry.label || entry.meal.name : entry.food.name;
  const templateName = entry.kind === "meal" && entry.label ? entry.meal.name : null;

  return (
    <li className={cn(LOG_ROW_GRID, ROW_CLASS, "text-muted-foreground")}>
      <span className="flex min-w-0 items-center gap-1.5">
        {entry.kind === "meal" ? <KindTag kind="meal" /> : null}
        <span className="truncate" title={templateName ? `${title} (${templateName})` : title}>
          {title}
          {templateName ? <span> · {templateName}</span> : null}
        </span>
      </span>
      <span className="text-right">{entry.kind === "food" ? formatRowGrams(entry.grams) : ""}</span>
      <MacroCells totals={totals} />
      <KcalCell kcal={totals.kcal} />
    </li>
  );
}

function sourceKeyForDailyPlanEntry(entry: DailyPlanEntry): string {
  return entry.kind === "meal" ? `meal:${entry.id}` : `food:${entry.id}`;
}

function EntryRow({
  entry,
  onUpdate,
  onDelete,
  disabled,
  provenance,
}: {
  entry: DailyEntry;
  onUpdate: (set: EntryUpdateSet) => void;
  onDelete: () => void;
  disabled: boolean;
  provenance?: string | undefined;
}) {
  // The edit closes itself once the saved grams come back from the server.
  const [editingGrams, setEditingGrams] = useState<string | null>(null);
  const isEditingGrams = editingGrams === String(entry.grams);
  const totals = loggedEntryMacroTotals(entry);
  const isAdHoc = entry.source === "ad_hoc";
  const name = entry.snapshotFoodName;
  const gramsLabel = (
    <>
      {formatRowGrams(entry.grams)}
      <span className="sr-only">, edit {isAdHoc ? name : `grams for ${name}`}</span>
    </>
  );
  // The negative margin lines the button's text up with the plain grams of planned rows.
  const gramsButtonClass = "-mr-1.5 h-11 min-w-11 justify-self-end px-1.5 font-normal tabular-nums";

  return (
    <li className={cn(LOG_ROW_GRID, ROW_CLASS)}>
      <span className="min-w-0">
        <span className="block truncate" title={`Per 100 g: ${snapshotMacroSummary(entry)}`}>
          {name}
        </span>
        {provenance || isAdHoc ? (
          <span className="block truncate text-[12px] text-muted-foreground">
            {provenance ?? "Quick entry"}
          </span>
        ) : null}
      </span>
      {isAdHoc ? (
        <AdHocEntryEditDialog entry={entry} onSave={onUpdate} disabled={disabled}>
          <Button type="button" size="sm" variant="ghost" className={gramsButtonClass}>
            {gramsLabel}
          </Button>
        </AdHocEntryEditDialog>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={gramsButtonClass}
          onClick={() => setEditingGrams(String(entry.grams))}
          disabled={disabled || isEditingGrams}
          aria-expanded={isEditingGrams}
        >
          {gramsLabel}
        </Button>
      )}
      <MacroCells totals={totals} />
      <KcalCell kcal={totals.kcal} />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-11 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
        disabled={disabled}
        aria-label={`Delete ${name}`}
      >
        <Trash2 />
      </Button>
      {isEditingGrams ? (
        <GramsEditor
          entry={entry}
          disabled={disabled}
          onSave={(grams) => onUpdate({ grams })}
          onClose={() => setEditingGrams(null)}
        />
      ) : null}
    </li>
  );
}

/** Inline grams editor under a logged food row: Enter or Save updates, Escape cancels. */
function GramsEditor({
  entry,
  disabled,
  onSave,
  onClose,
}: {
  entry: DailyEntry;
  disabled: boolean;
  onSave: (grams: number) => void;
  onClose: () => void;
}) {
  const [grams, setGrams] = useState(String(entry.grams));
  const helpId = `grams-${entry.id}-help`;

  function save() {
    const parsed = parseMacroInput(grams);
    if (parsed === null || parsed <= 0) {
      toast.error("Enter grams greater than zero.");
      return;
    }
    if (parsed !== normalizeNumeric(entry.grams)) {
      onSave(parsed);
      return;
    }
    onClose();
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof HTMLElement &&
      nextTarget.dataset["gramsEditorActionFor"] === entry.id
    ) {
      return;
    }
    save();
  }

  return (
    <div className="col-span-full flex flex-wrap items-center justify-end gap-1 pb-2">
      <Input
        id={`grams-${entry.id}`}
        type="text"
        inputMode="decimal"
        pattern={DECIMAL_INPUT_PATTERN}
        value={grams}
        onChange={(event) => setGrams(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            onClose();
          }
        }}
        onBlur={handleBlur}
        disabled={disabled}
        className="h-9 w-24 text-right"
        aria-label={`Grams for ${entry.snapshotFoodName}`}
        aria-describedby={helpId}
        autoFocus
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 gap-1 px-2"
        onClick={save}
        disabled={disabled}
        data-grams-editor-action-for={entry.id}
      >
        <Check className="h-4 w-4" />
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-9 px-2"
        onClick={onClose}
        disabled={disabled}
        data-grams-editor-action-for={entry.id}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Cancel editing grams</span>
      </Button>
      <span id={helpId} className="sr-only">
        Press Enter or Save to update grams. Press Escape to cancel.
      </span>
    </div>
  );
}

function AdHocEntryEditDialog({
  entry,
  onSave,
  disabled,
  children,
}: {
  entry: DailyEntry;
  onSave: (set: AdHocLogEntryUpdateSet) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdHocNutritionDraft>(() => adHocDraftFromEntry(entry));
  const [slotTime, setSlotTime] = useState(() => timeToInputValue(entry.slotTime));
  const previewTotals = adHocNutritionDraftTotals(draft);

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(adHocDraftFromEntry(entry));
      setSlotTime(timeToInputValue(entry.slotTime));
    }
    setOpen(next);
  }

  function updateDraft(key: keyof AdHocNutritionDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    try {
      onSave(buildAdHocLogEntryUpdateSet({ draft, slotTime }));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid custom food details.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild disabled={disabled}>
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Edit custom food</DialogTitle>
          <DialogDescription>
            Update the one-off snapshot for this log entry. This does not create or modify a
            reusable food.
          </DialogDescription>
        </DialogHeader>
        <AdHocEditFields
          entryId={entry.id}
          draft={draft}
          slotTime={slotTime}
          previewSummary={macroTotalsSummary(previewTotals)}
          onDraftChange={updateDraft}
          onSlotTimeChange={setSlotTime}
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdHocEditFields({
  entryId,
  draft,
  slotTime,
  previewSummary,
  onDraftChange,
  onSlotTimeChange,
}: {
  entryId: string;
  draft: AdHocNutritionDraft;
  slotTime: string;
  previewSummary: string;
  onDraftChange: (key: keyof AdHocNutritionDraft, value: string) => void;
  onSlotTimeChange: (value: string) => void;
}) {
  const fieldClass = "flex flex-col gap-1.5";
  const labelClass = "text-[13px] font-semibold text-soft-foreground";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className={fieldClass}>
          <label htmlFor={`ad-hoc-edit-name-${entryId}`} className={labelClass}>
            Food name
          </label>
          <Input
            id={`ad-hoc-edit-name-${entryId}`}
            value={draft.name}
            onChange={(event) => onDraftChange("name", event.target.value)}
            maxLength={160}
            required
          />
        </div>
        <div className={fieldClass}>
          <label htmlFor={`ad-hoc-edit-grams-${entryId}`} className={labelClass}>
            Grams eaten
          </label>
          <Input
            id={`ad-hoc-edit-grams-${entryId}`}
            type="text"
            inputMode="decimal"
            pattern={DECIMAL_INPUT_PATTERN}
            value={draft.grams}
            onChange={(event) => onDraftChange("grams", event.target.value)}
            className="text-right tabular-nums"
            required
          />
        </div>
      </div>
      <div className={fieldClass}>
        <label htmlFor={`ad-hoc-edit-time-${entryId}`} className={labelClass}>
          Time eaten
        </label>
        <Input
          id={`ad-hoc-edit-time-${entryId}`}
          type="time"
          value={slotTime}
          onChange={(event) => onSlotTimeChange(event.target.value)}
          className="tabular-nums"
          required
        />
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-soft-foreground">Nutrition per 100 g</h3>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            Totals preview: {previewSummary}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {NUTRIENT_FIELDS.map((field) => (
            <div key={field.key} className={fieldClass}>
              <label htmlFor={`ad-hoc-edit-${entryId}-${field.key}`} className={labelClass}>
                {field.label}{" "}
                <span className="font-medium text-muted-foreground">{field.suffix}</span>
              </label>
              <Input
                id={`ad-hoc-edit-${entryId}-${field.key}`}
                type="text"
                inputMode="decimal"
                pattern={DECIMAL_INPUT_PATTERN}
                value={draft[field.key]}
                onChange={(event) => onDraftChange(field.key, event.target.value)}
                className="text-right tabular-nums"
                required
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function adHocDraftFromEntry(entry: DailyEntry): AdHocNutritionDraft {
  return {
    ...createEmptyAdHocNutritionDraft(),
    name: entry.snapshotFoodName,
    grams: String(entry.grams),
    kcalPer100g: String(entry.snapshotKcalPer100g),
    fatPer100g: String(entry.snapshotFatPer100g),
    carbsPer100g: String(entry.snapshotCarbsPer100g),
    proteinPer100g: String(entry.snapshotProteinPer100g),
    fiberPer100g: String(entry.snapshotFiberPer100g),
    sugarPer100g: String(entry.snapshotSugarPer100g),
  };
}

function snapshotMacroSummary(entry: DailyEntry): string {
  return macroTotalsSummary({
    kcal: normalizeNumeric(entry.snapshotKcalPer100g),
    fat: normalizeNumeric(entry.snapshotFatPer100g),
    carbs: normalizeNumeric(entry.snapshotCarbsPer100g),
    protein: normalizeNumeric(entry.snapshotProteinPer100g),
    fiber: normalizeNumeric(entry.snapshotFiberPer100g),
    sugar: normalizeNumeric(entry.snapshotSugarPer100g),
  });
}
