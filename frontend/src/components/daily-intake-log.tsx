import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Trash2, X } from "lucide-react";
import { type FocusEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LogIntakeDialog,
  type LogMealOption,
  type LogPlanFoodSlot,
  type LogPlanSlot,
} from "@/components/log-intake-dialog";
import { MacroSummary } from "@/components/macro-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  addLocalDateDays,
  DECIMAL_INPUT_PATTERN,
  formatLocalDateLabel,
  formatMacro,
  formatTimeOfDay,
  groupIntakeByTimeSlot,
  type IntakeTimeSlot,
  loggedEntryMacroTotals,
  loggedMacroTotals,
  macroTotalsSummary,
  mergePlanEntriesByTime,
  normalizeNumeric,
  parseMacroInput,
  planEntriesMacroTotals,
  planEntryMacroTotals,
} from "@/lib/nutrition";

const DailyIntakeLogQuery = graphql(`
  query DailyIntakeLog($date: date!) {
    nutritionDays(where: { logDate: { _eq: $date } }, limit: 1) {
      id
      logDate
      nutritionPlanId
      nutritionLogMeals(order_by: [{ slotTime: asc }, { position: asc }, { createdAt: asc }]) {
        id
        mealId
        nutritionPlanMealId
        name
        slotTime
        position
        nutritionLogEntries(order_by: [{ position: asc }, { createdAt: asc }]) {
          id
          nutritionLogMealId
          foodId
          grams
          position
          slotTime
          snapshotFoodName
          snapshotKcalPer100g
          snapshotFatPer100g
          snapshotCarbsPer100g
          snapshotProteinPer100g
          snapshotFiberPer100g
          snapshotSugarPer100g
        }
      }
      nutritionLogEntries(
        where: { nutritionLogMealId: { _is_null: true } }
        order_by: [{ slotTime: asc }, { position: asc }, { createdAt: asc }]
      ) {
        id
        nutritionLogMealId
        foodId
        grams
        position
        slotTime
        snapshotFoodName
        snapshotKcalPer100g
        snapshotFatPer100g
        snapshotCarbsPer100g
        snapshotProteinPer100g
        snapshotFiberPer100g
        snapshotSugarPer100g
      }
    }
    nutritionPlans(order_by: [{ name: asc }]) {
      id
      name
      description
      nutritionPlanMeals(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
        id
        slotTime
        label
        position
        meal {
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
      }
      nutritionPlanFoods(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
        id
        slotTime
        label
        position
        grams
        food {
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
    }
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

const CreateNutritionDayMutation = graphql(`
  mutation CreateNutritionDay($object: nutritionDays_insert_input!) {
    insertNutritionDay(object: $object) {
      id
    }
  }
`);

const UpdateNutritionDayPlanMutation = graphql(`
  mutation UpdateNutritionDayPlan($id: uuid!, $nutritionPlanId: uuid) {
    updateNutritionDay(pk_columns: { id: $id }, _set: { nutritionPlanId: $nutritionPlanId }) {
      id
      nutritionPlanId
    }
  }
`);

const UpdateNutritionLogEntryMutation = graphql(`
  mutation UpdateNutritionLogEntry($id: uuid!, $set: nutritionLogEntries_set_input!) {
    updateNutritionLogEntry(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`);

const DeleteNutritionLogEntryMutation = graphql(`
  mutation DeleteNutritionLogEntry($id: uuid!) {
    deleteNutritionLogEntry(id: $id) {
      id
    }
  }
`);

const DeleteNutritionLogMealMutation = graphql(`
  mutation DeleteNutritionLogMeal($id: uuid!) {
    deleteNutritionLogMeal(id: $id) {
      id
    }
  }
`);

const DeleteNutritionDayMutation = graphql(`
  mutation DeleteNutritionDay($id: uuid!) {
    deleteNutritionDay(id: $id) {
      id
    }
  }
`);

type DailyFood = {
  id: string;
  name: string;
  userId?: string | null;
  isPublic: boolean;
  kcalPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
  proteinPer100g: unknown;
  fiberPer100g: unknown;
  sugarPer100g: unknown;
};

type DailyEntry = {
  id: string;
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

type DailyLogMeal = {
  id: string;
  mealId?: string | null;
  nutritionPlanMealId?: string | null;
  name: string;
  slotTime?: string | null;
  position: number;
  nutritionLogEntries: DailyEntry[];
};

type DailyPlan = {
  id: string;
  name: string;
  description?: string | null;
  nutritionPlanMeals: LogPlanSlot[];
  nutritionPlanFoods: LogPlanFoodSlot[];
};

type DailyDay = {
  id: string;
  logDate: string;
  nutritionPlanId?: string | null;
  nutritionLogMeals: DailyLogMeal[];
  nutritionLogEntries: DailyEntry[];
};

type DailyIntakeLogData = {
  day: DailyDay | null;
  nutritionPlans: DailyPlan[];
  meals: LogMealOption[];
  foods: DailyFood[];
};

type DailyIntakeLogQueryData = Omit<DailyIntakeLogData, "day"> & {
  nutritionDays: DailyDay[];
};

interface DailyIntakeLogProps {
  date: string;
}

export function DailyIntakeLog({ date }: DailyIntakeLogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (date) {
      setExpandedSlots(new Set());
    }
  }, [date]);

  const toggleSlot = (slotKey: string) => {
    setExpandedSlots((current) => {
      const next = new Set(current);
      if (next.has(slotKey)) {
        next.delete(slotKey);
      } else {
        next.add(slotKey);
      }
      return next;
    });
  };

  const query = useQuery({
    queryKey: ["nutrition", "days", date],
    queryFn: () => openDay(date),
  });

  const ensureDay = () => {
    const cachedDay = queryClient.getQueryData<DailyIntakeLogData>([
      "nutrition",
      "days",
      date,
    ])?.day;
    if (cachedDay) {
      return Promise.resolve(cachedDay.id);
    }

    return createDay(date);
  };

  const updatePlanMutation = useMutation({
    mutationFn: async (nutritionPlanId: string | null) => {
      const dayId = nutritionPlanId ? await ensureDay() : query.data?.day?.id;
      if (!dayId) {
        return null;
      }

      return gqlRequest(UpdateNutritionDayPlanMutation, {
        id: dayId,
        nutritionPlanId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
      toast.success("Day plan updated");
    },
    onError: (error) => {
      toast.error(`Failed to update plan: ${error.message}`);
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, grams }: { id: string; grams: number }) =>
      gqlRequest(UpdateNutritionLogEntryMutation, { id, set: { grams } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      toast.success("Entry updated");
    },
    onError: (error) => {
      toast.error(`Failed to update entry: ${error.message}`);
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteNutritionLogEntryMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
      toast.success("Entry deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete entry: ${error.message}`);
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteNutritionLogMealMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
      toast.success("Logged meal deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete logged meal: ${error.message}`);
    },
  });

  const deleteDayMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteNutritionDayMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days"] });
      toast.success("Day log cleared");
      navigate({ to: "/nutrition/days", replace: true });
    },
    onError: (error) => {
      toast.error(`Failed to clear day: ${error.message}`);
    },
  });

  if (query.isLoading) {
    return <DailyIntakeLogSkeleton />;
  }
  if (query.error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-4">
          <p className="text-sm text-destructive">Failed to load day: {query.error.message}</p>
        </CardContent>
      </Card>
    );
  }
  if (!query.data) {
    return null;
  }

  const { day, nutritionPlans, meals, foods } = query.data;
  const standaloneEntries = day?.nutritionLogEntries ?? [];
  const loggedMeals = day?.nutritionLogMeals ?? [];
  const allEntries = [
    ...standaloneEntries,
    ...loggedMeals.flatMap((meal) => meal.nutritionLogEntries),
  ];
  const totals = loggedMacroTotals(allEntries);
  const selectedPlan = day?.nutritionPlanId
    ? (nutritionPlans.find((plan) => plan.id === day.nutritionPlanId) ?? null)
    : null;
  const selectedPlanEntries = selectedPlan
    ? mergePlanEntriesByTime(selectedPlan.nutritionPlanMeals, selectedPlan.nutritionPlanFoods)
    : [];
  const targetTotals = selectedPlan ? planEntriesMacroTotals(selectedPlanEntries) : null;
  const nextEntryPosition = allEntries.length;
  const nextGroupPosition = loggedMeals.length;
  const isMutating =
    updatePlanMutation.isPending ||
    updateEntryMutation.isPending ||
    deleteEntryMutation.isPending ||
    deleteGroupMutation.isPending ||
    deleteDayMutation.isPending;
  const intakeSlots = groupIntakeByTimeSlot(loggedMeals, standaloneEntries);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Daily log
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">{formatLocalDateLabel(date)}</h2>
          <p className="text-sm text-muted-foreground">
            Totals use logged snapshot nutrition, so later food or template edits do not rewrite
            this day.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild size="icon" variant="ghost" aria-label="Previous day">
            <Link to="/nutrition/days/$date" params={{ date: addLocalDateDays(date, -1) }}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="icon" variant="ghost" aria-label="Next day">
            <Link to="/nutrition/days/$date" params={{ date: addLocalDateDays(date, 1) }}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <MacroSummary totals={totals} targetTotals={targetTotals} />

      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardContent className="space-y-4 p-4 sm:p-6">
          {intakeSlots.length === 0 ? (
            <p className="rounded-md border border-border/60 border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No food has been logged for this day yet.
            </p>
          ) : null}

          {intakeSlots.map((slot) => (
            <TimeSlotSection
              key={slot.key}
              slot={slot}
              isExpanded={expandedSlots.has(slot.key)}
              onToggle={() => toggleSlot(slot.key)}
              onUpdateEntry={(entryId, grams) => updateEntryMutation.mutate({ id: entryId, grams })}
              onDeleteEntry={(entryId) => deleteEntryMutation.mutate(entryId)}
              onDeleteGroup={(groupId) => deleteGroupMutation.mutate(groupId)}
              disabled={isMutating}
            />
          ))}

          <div className="flex flex-wrap justify-end gap-2">
            <LogIntakeDialog
              ensureDay={ensureDay}
              date={date}
              foods={foods}
              meals={meals}
              selectedPlan={selectedPlan}
              nextEntryPosition={nextEntryPosition}
              nextGroupPosition={nextGroupPosition}
              disabled={isMutating}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-lg tracking-tight">Plan suggestions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a reusable daily plan for suggestions. This does not schedule or bind the day.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={day?.nutritionPlanId ?? ""}
              onChange={(event) => updatePlanMutation.mutate(event.target.value || null)}
              disabled={updatePlanMutation.isPending}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Selected nutrition plan"
            >
              <option value="">No plan selected</option>
              {nutritionPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => updatePlanMutation.mutate(null)}
              disabled={!day?.nutritionPlanId || updatePlanMutation.isPending}
            >
              Clear plan
            </Button>
          </div>

          {selectedPlan ? (
            <PlanSuggestions
              plan={selectedPlan}
              ensureDay={ensureDay}
              date={date}
              foods={foods}
              meals={meals}
              nextGroupPosition={nextGroupPosition}
              nextEntryPosition={nextEntryPosition}
              disabled={isMutating}
            />
          ) : (
            <p className="rounded-md border border-border/60 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Pick a plan to show timed meal suggestions, or log meals and foods ad hoc below.
            </p>
          )}
        </CardContent>
      </Card>

      {day ? (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDeleteDay(true)}
              disabled={deleteDayMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Clear day log
            </Button>
          </div>

          <Dialog open={confirmDeleteDay} onOpenChange={setConfirmDeleteDay}>
            <DialogContent className="md:max-w-md">
              <DialogHeader>
                <DialogTitle>Clear this day?</DialogTitle>
                <DialogDescription>
                  This deletes the nutrition day row for {formatLocalDateLabel(date)}. Logged meal
                  groups and entries cascade and cannot be recovered.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDeleteDay(false)}
                  disabled={deleteDayMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => deleteDayMutation.mutate(day.id)}
                  disabled={deleteDayMutation.isPending}
                >
                  {deleteDayMutation.isPending ? "Clearing…" : "Clear day"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

async function openDay(date: string): Promise<DailyIntakeLogData> {
  const data = (await gqlRequest(DailyIntakeLogQuery, { date })) as DailyIntakeLogQueryData;
  return { ...data, day: data.nutritionDays[0] ?? null };
}

async function createDay(date: string): Promise<string> {
  try {
    const created = await gqlRequest(CreateNutritionDayMutation, { object: { logDate: date } });
    const createdId = created.insertNutritionDay?.id;
    if (createdId) {
      return createdId;
    }
  } catch (error) {
    if (!isUniqueConflictError(error)) {
      throw error;
    }
  }

  const data = await openDay(date);
  if (!data.day) {
    throw new Error("Nutrition day could not be opened after creation.");
  }
  return data.day.id;
}

function isUniqueConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("unique") ||
    message.includes("duplicate key") ||
    message.includes("nutrition_days_user_date_uq")
  );
}

function TimeSlotSection({
  slot,
  isExpanded,
  onToggle,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteGroup,
  disabled,
}: {
  slot: IntakeTimeSlot<DailyEntry>;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateEntry: (entryId: string, grams: number) => void;
  onDeleteEntry: (entryId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  disabled: boolean;
}) {
  const slotPanelId = `intake-slot-${slot.key.replaceAll(":", "-")}`;
  return (
    <section className="overflow-hidden rounded-md border border-border/60">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-expanded={isExpanded}
        aria-controls={slotPanelId}
        onClick={onToggle}
      >
        <span className="min-w-0 space-y-1">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {slot.label}
          </span>
          <span className="block text-xs text-muted-foreground">
            {macroTotalsSummary(slot.totals)}
          </span>
          <span className="block text-xs text-muted-foreground">
            {formatSlotCounts(slot.entries.length, slot.mealGroups.length)}
          </span>
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isExpanded ? (
        <div id={slotPanelId} className="space-y-3 border-t border-border/60 p-3">
          {slot.mealGroups.length > 0 ? (
            <div className="rounded-md bg-muted/40 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Logged meal groups
              </p>
              <ul className="mt-2 space-y-2">
                {slot.mealGroups.map((group) => (
                  <li key={group.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatEntryCount(group.entryCount)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDeleteGroup(group.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete group
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {slot.entries.length === 0 ? (
            <p className="rounded-md border border-border/60 border-dashed px-3 py-4 text-sm text-muted-foreground">
              This time slot has no food entries.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border/60">
              <ul className="divide-y divide-border/50">
                {slot.entries.map((slotEntry) => (
                  <EntryRow
                    key={slotEntry.entry.id}
                    entry={slotEntry.entry}
                    onUpdate={(grams) => onUpdateEntry(slotEntry.entry.id, grams)}
                    onDelete={() => onDeleteEntry(slotEntry.entry.id)}
                    disabled={disabled}
                    showTime={false}
                    provenance={slotEntry.mealName ? `From ${slotEntry.mealName}` : undefined}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function formatSlotCounts(entryCount: number, groupCount: number): string {
  return [formatEntryCount(entryCount), formatGroupCount(groupCount)].join(" · ");
}

function formatEntryCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "entry" : "entries"}`;
}

function formatGroupCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "meal group" : "meal groups"}`;
}

type DailyPlanEntry = (LogPlanSlot & { kind: "meal" }) | (LogPlanFoodSlot & { kind: "food" });

function PlanSuggestions({
  plan,
  ensureDay,
  date,
  foods,
  meals,
  nextGroupPosition,
  nextEntryPosition,
  disabled,
}: {
  plan: DailyPlan;
  ensureDay: () => Promise<string>;
  date: string;
  foods: DailyFood[];
  meals: LogMealOption[];
  nextGroupPosition: number;
  nextEntryPosition: number;
  disabled: boolean;
}) {
  const entries = mergePlanEntriesByTime(
    plan.nutritionPlanMeals,
    plan.nutritionPlanFoods,
  ) as DailyPlanEntry[];
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-border/60 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        This selected plan does not have meal or food entries yet.
      </p>
    );
  }

  let mealOffset = 0;
  let foodOffset = 0;

  return (
    <div className="overflow-hidden rounded-md border border-border/60">
      <ul className="divide-y divide-border/50">
        {entries.map((entry) => {
          if (entry.kind === "meal") {
            const nextPosition = nextGroupPosition + mealOffset;
            mealOffset += 1;
            return (
              <PlanMealSuggestionRow
                key={`meal:${entry.id}`}
                slot={entry}
                plan={plan}
                ensureDay={ensureDay}
                date={date}
                foods={foods}
                meals={meals}
                nextGroupPosition={nextPosition}
                nextEntryPosition={nextEntryPosition + foodOffset}
                disabled={disabled}
              />
            );
          }
          const nextPosition = nextEntryPosition + foodOffset;
          foodOffset += 1;
          return (
            <PlanFoodSuggestionRow
              key={`food:${entry.id}`}
              slot={entry}
              plan={plan}
              ensureDay={ensureDay}
              date={date}
              foods={foods}
              meals={meals}
              nextGroupPosition={nextGroupPosition + mealOffset}
              nextEntryPosition={nextPosition}
              disabled={disabled}
            />
          );
        })}
      </ul>
    </div>
  );
}

function PlanMealSuggestionRow({
  slot,
  plan,
  ensureDay,
  date,
  foods,
  meals,
  nextGroupPosition,
  nextEntryPosition,
  disabled,
}: {
  slot: LogPlanSlot;
  plan: DailyPlan;
  ensureDay: () => Promise<string>;
  date: string;
  foods: DailyFood[];
  meals: LogMealOption[];
  nextGroupPosition: number;
  nextEntryPosition: number;
  disabled: boolean;
}) {
  const totals = planEntryMacroTotals({ ...slot, kind: "meal" });
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-3">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
          <Clock className="h-3 w-3" />
          {formatTimeOfDay(slot.slotTime)} · Meal
        </p>
        <p className="truncate text-sm font-medium">{slot.label || slot.meal.name}</p>
        {slot.label ? <p className="text-xs text-muted-foreground">{slot.meal.name}</p> : null}
        <p className="text-xs text-muted-foreground">{macroTotalsSummary(totals)}</p>
      </div>
      <LogIntakeDialog
        ensureDay={ensureDay}
        date={date}
        foods={foods}
        meals={meals}
        selectedPlan={plan}
        nextEntryPosition={nextEntryPosition}
        nextGroupPosition={nextGroupPosition}
        disabled={disabled}
        triggerLabel="Log"
        triggerVariant="default"
        initialSource={{ kind: "plan-meal", slot }}
      />
    </li>
  );
}

function PlanFoodSuggestionRow({
  slot,
  plan,
  ensureDay,
  date,
  foods,
  meals,
  nextGroupPosition,
  nextEntryPosition,
  disabled,
}: {
  slot: LogPlanFoodSlot;
  plan: DailyPlan;
  ensureDay: () => Promise<string>;
  date: string;
  foods: DailyFood[];
  meals: LogMealOption[];
  nextGroupPosition: number;
  nextEntryPosition: number;
  disabled: boolean;
}) {
  const totals = planEntryMacroTotals({ ...slot, kind: "food" });
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-3">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
          <Clock className="h-3 w-3" />
          {formatTimeOfDay(slot.slotTime)} · Food
        </p>
        <p className="truncate text-sm font-medium">{slot.label || slot.food.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatMacro(slot.grams, "g")} · {slot.food.name}
        </p>
        <p className="text-xs text-muted-foreground">{macroTotalsSummary(totals)}</p>
      </div>
      <LogIntakeDialog
        ensureDay={ensureDay}
        date={date}
        foods={foods}
        meals={meals}
        selectedPlan={plan}
        nextEntryPosition={nextEntryPosition}
        nextGroupPosition={nextGroupPosition}
        disabled={disabled}
        triggerLabel="Log"
        triggerVariant="default"
        initialSource={{ kind: "plan-food", slot }}
      />
    </li>
  );
}

function EntryRow({
  entry,
  onUpdate,
  onDelete,
  disabled,
  showTime = true,
  provenance,
}: {
  entry: DailyEntry;
  onUpdate: (grams: number) => void;
  onDelete: () => void;
  disabled: boolean;
  showTime?: boolean;
  provenance?: string | undefined;
}) {
  const [isEditingGrams, setIsEditingGrams] = useState(false);
  const [grams, setGrams] = useState(String(entry.grams));

  useEffect(() => {
    setGrams(String(entry.grams));
    setIsEditingGrams(false);
  }, [entry.grams]);

  const totals = loggedEntryMacroTotals(entry);
  const parsedGrams = parseMacroInput(grams);
  const entryGrams = normalizeNumeric(entry.grams);
  const displayGrams = formatMacro(entry.grams, "g");
  const gramsHelpId = `grams-${entry.id}-help`;

  function cancelEdit() {
    setGrams(String(entry.grams));
    setIsEditingGrams(false);
  }

  function save() {
    if (parsedGrams === null || parsedGrams <= 0) {
      toast.error("Enter grams greater than zero.");
      return false;
    }
    if (parsedGrams !== entryGrams) {
      onUpdate(parsedGrams);
      return true;
    }
    setIsEditingGrams(false);
    return true;
  }

  function handleGramsBlur(event: FocusEvent<HTMLInputElement>) {
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
    <li className="space-y-3 px-3 py-3 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{entry.snapshotFoodName}</p>
        <p className="text-xs text-muted-foreground">
          {showTime && entry.slotTime ? `${formatTimeOfDay(entry.slotTime)} · ` : ""}
          {macroTotalsSummary(totals)}
        </p>
        {provenance ? <p className="text-xs text-muted-foreground">{provenance}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {isEditingGrams ? (
          <div className="flex flex-wrap items-center gap-1">
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
                  cancelEdit();
                }
              }}
              onBlur={handleGramsBlur}
              disabled={disabled}
              className="h-9 w-24"
              aria-label={`Grams for ${entry.snapshotFoodName}`}
              aria-describedby={gramsHelpId}
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
              onClick={cancelEdit}
              disabled={disabled}
              data-grams-editor-action-for={entry.id}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cancel editing grams</span>
            </Button>
            <span id={gramsHelpId} className="sr-only">
              Press Enter or Save to update grams. Press Escape to cancel.
            </span>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="tabular-nums"
            onClick={() => setIsEditingGrams(true)}
            disabled={disabled}
            title="Click to edit grams"
          >
            {displayGrams}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete {entry.snapshotFoodName}</span>
        </Button>
      </div>
    </li>
  );
}

function DailyIntakeLogSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-52 w-full" />
      </CardContent>
    </Card>
  );
}
