import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { type FocusEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LogIntakeDialog,
  type LogMealOption,
  type LogPlanFoodSlot,
  type LogPlanSlot,
} from "@/components/log-intake-dialog";
import { DayNavigator } from "@/components/nutrition-day-navigator";
import { MeterBar } from "@/components/patterns/metrics";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { TodayEnergyEstimate } from "@/components/today-energy-estimate";
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
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import {
  calculateDailyEnergyBalance,
  type DailyEnergyBalance,
  type DailyEnergyNumericValue,
} from "@/lib/daily-energy";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import {
  type AdHocLogEntryUpdateSet,
  type AdHocNutritionDraft,
  adHocNutritionDraftTotals,
  buildAdHocLogEntryUpdateSet,
  buildPlanLogInputs,
  createEmptyAdHocNutritionDraft,
  currentTimeInputValue,
  DECIMAL_INPUT_PATTERN,
  formatLocalDateLabel,
  formatMacro,
  groupIntakeByTimeSlot,
  groupPlanEntriesByTimeSlot,
  type IntakeTimeSlot,
  loggedEntryMacroTotals,
  loggedMacroTotals,
  type MacroTotals,
  macroTotalsSummary,
  mergePlanEntriesByTime,
  NUTRIENT_FIELDS,
  normalizeNumeric,
  type PlanTimeSlot,
  parseMacroInput,
  planEntriesMacroTotals,
  planEntryMacroTotals,
  timeToInputValue,
} from "@/lib/nutrition";
import { logSelectedPlanMaterialization } from "@/lib/nutrition-plan-log";
import { cn } from "@/lib/utils";

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
          source
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
        source
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
    dailyEnergyEntries(where: { energyOn: { _eq: $date } }, limit: 1) {
      activeKcal
      restingKcal
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

type DailyEnergyBalanceEntry = {
  activeKcal?: DailyEnergyNumericValue;
  restingKcal?: DailyEnergyNumericValue;
};

type DailyIntakeLogData = {
  day: DailyDay | null;
  dailyEnergy: DailyEnergyBalanceEntry | null;
  nutritionPlans: DailyPlan[];
  meals: LogMealOption[];
  foods: DailyFood[];
};

type DailyIntakeLogQueryData = Omit<DailyIntakeLogData, "day" | "dailyEnergy"> & {
  nutritionDays: DailyDay[];
  dailyEnergyEntries: DailyEnergyBalanceEntry[];
};

type EntryUpdateSet = { grams: number } | AdHocLogEntryUpdateSet;

interface DailyIntakeLogProps {
  date: string;
}

export function DailyIntakeLog({ date }: DailyIntakeLogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Keep the date prefix for mutation invalidation, but never reuse another owner's day.
  const queryKey = ["nutrition", "days", date, user?.id];
  const query = useQuery({
    queryKey,
    queryFn: () => openDay(date),
    enabled: !!user,
    // Daily-energy edits use a separate route/query key; remounting this card should refetch
    // the sibling dailyEnergyEntries selection rather than relying on cross-route invalidation.
    refetchOnMount: "always",
  });

  const ensureDay = () => {
    if (!user) {
      return Promise.reject(new Error("Sign in to log intake."));
    }
    const cachedDay = queryClient.getQueryData<DailyIntakeLogData>(queryKey)?.day;
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
    mutationFn: ({ id, set }: { id: string; set: EntryUpdateSet }) =>
      gqlRequest(UpdateNutritionLogEntryMutation, { id, set }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
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
    },
    onError: (error) => {
      toast.error(`Failed to clear day: ${error.message}`);
    },
  });

  if (!user) {
    return null;
  }
  if (query.isLoading) {
    return <DailyIntakeLogSkeleton />;
  }
  if (query.error) {
    return <ErrorState title="Couldn't load this day" message={query.error.message} />;
  }
  if (!query.data) {
    return null;
  }

  const { day, dailyEnergy, nutritionPlans, meals, foods } = query.data;
  const standaloneEntries = day?.nutritionLogEntries ?? [];
  const loggedMeals = day?.nutritionLogMeals ?? [];
  const allEntries = [
    ...standaloneEntries,
    ...loggedMeals.flatMap((meal) => meal.nutritionLogEntries),
  ];
  const totals = loggedMacroTotals(allEntries);
  const calorieBalance = calculateDailyEnergyBalance({
    caloriesIn: totals.kcal,
    activeKcal: dailyEnergy?.activeKcal,
    restingKcal: dailyEnergy?.restingKcal,
    hasEnergyEntry: dailyEnergy !== null,
  });
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

  const plannedSlots = selectedPlan
    ? (groupPlanEntriesByTimeSlot(selectedPlanEntries as DailyPlanEntry[]) as DailyPlanTimeSlot[])
    : [];
  const loggedKeys = new Set(intakeSlots.map((slot) => slot.key));
  const timeline: TimelineItem[] = [
    ...intakeSlots.map((slot) => ({ kind: "logged" as const, sortKey: slot.sortKey, slot })),
    ...plannedSlots
      .filter((slot) => !loggedKeys.has(slot.key))
      .map((slot) => ({ kind: "planned" as const, sortKey: slot.sortKey, slot })),
  ].sort((left, right) => left.sortKey.localeCompare(right.sortKey));

  return (
    <div className="flex flex-col gap-4">
      <DayNavigator date={date}>
        <LogIntakeDialog
          ensureDay={ensureDay}
          date={date}
          foods={foods}
          meals={meals}
          selectedPlan={selectedPlan}
          nextEntryPosition={nextEntryPosition}
          nextGroupPosition={nextGroupPosition}
          disabled={isMutating}
          triggerLabel="Log food"
          triggerVariant="default"
        />
      </DayNavigator>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Timeline" className="flex min-w-0 flex-col gap-3">
          {timeline.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              description={
                selectedPlan
                  ? "This plan has no time slots yet. Use Log food to add what you ate."
                  : "Use Log food to add what you ate, or pick a plan to see its time slots here."
              }
            />
          ) : null}
          {timeline.map((item) =>
            item.kind === "logged" ? (
              <LoggedSlotCard
                key={`logged-${item.slot.key}`}
                slot={item.slot}
                onUpdateEntry={(entryId, set) => updateEntryMutation.mutate({ id: entryId, set })}
                onDeleteEntry={(entryId) => deleteEntryMutation.mutate(entryId)}
                onDeleteGroup={(groupId) => deleteGroupMutation.mutate(groupId)}
                disabled={isMutating}
              />
            ) : (
              <PlannedSlotCard
                key={`planned-${item.slot.key}`}
                plan={selectedPlan as DailyPlan}
                slot={item.slot}
                ensureDay={ensureDay}
                date={date}
                existingMealGroups={loggedMeals}
                existingStandaloneEntries={standaloneEntries}
                disabled={isMutating}
              />
            ),
          )}
        </section>

        <aside
          aria-label="Day summary"
          className="order-first flex flex-col gap-4 lg:sticky lg:top-6 lg:order-none"
        >
          <DaySummaryCard
            totals={totals}
            targetTotals={targetTotals}
            balance={calorieBalance}
            date={date}
            nutritionPlans={nutritionPlans}
            selectedPlanId={day?.nutritionPlanId ?? ""}
            onPlanChange={(planId) => updatePlanMutation.mutate(planId)}
            isUpdatingPlan={updatePlanMutation.isPending}
          />
          <TodayEnergyEstimate
            date={date}
            balance={{ userId: user.id, caloriesIn: totals.kcal, dailyEnergy }}
          />
          <p className="px-1 text-[12px] text-muted-foreground">
            Totals use the values saved when food was logged, so later edits to foods or plans don't
            change this day.
          </p>
        </aside>
      </div>

      {day ? (
        <ClearDayButton
          date={date}
          onConfirm={() => deleteDayMutation.mutate(day.id)}
          isPending={deleteDayMutation.isPending}
        />
      ) : null}
    </div>
  );
}

function ClearDayButton({
  date,
  onConfirm,
  isPending,
}: {
  date: string;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        <Trash2 />
        Clear day log
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear this day?</DialogTitle>
            <DialogDescription>
              Everything logged on {formatLocalDateLabel(date)} is deleted, including meal groups.
              This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
              {isPending ? "Clearing…" : "Clear day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TimelineItem =
  | { kind: "logged"; sortKey: string; slot: IntakeTimeSlot<DailyEntry> }
  | { kind: "planned"; sortKey: string; slot: DailyPlanTimeSlot };

const wholeNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function DaySummaryCard({
  totals,
  targetTotals,
  balance,
  date,
  nutritionPlans,
  selectedPlanId,
  onPlanChange,
  isUpdatingPlan,
}: {
  totals: MacroTotals;
  targetTotals: MacroTotals | null;
  balance: DailyEnergyBalance;
  date: string;
  nutritionPlans: DailyPlan[];
  selectedPlanId: string;
  onPlanChange: (planId: string | null) => void;
  isUpdatingPlan: boolean;
}) {
  const kcalPercent =
    targetTotals && targetTotals.kcal > 0
      ? Math.min(100, (totals.kcal / targetTotals.kcal) * 100)
      : 0;
  const macro = (value: number, target: number | undefined) =>
    target === undefined
      ? `${wholeNumber.format(value)} g`
      : `${wholeNumber.format(value)} / ${wholeNumber.format(target)} g`;
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="day-plan" className="text-[13px] font-medium text-muted-foreground">
          Plan
        </label>
        <select
          id="day-plan"
          aria-label="Selected nutrition plan"
          value={selectedPlanId}
          onChange={(event) => onPlanChange(event.target.value || null)}
          disabled={isUpdatingPlan}
          className="h-9 min-w-0 max-w-[70%] rounded-lg border bg-card px-2.5 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <option value="">No plan</option>
          {nutritionPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <p className="tabular-nums">
          <strong className="text-[28px] font-semibold">{wholeNumber.format(totals.kcal)}</strong>
          <span className="text-sm text-muted-foreground">
            {targetTotals ? ` / ${wholeNumber.format(targetTotals.kcal)} kcal` : " kcal"}
          </span>
        </p>
        {targetTotals ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${kcalPercent}%` }} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2.5">
        <MeterBar
          label="Protein"
          value={totals.protein}
          max={targetTotals?.protein ?? null}
          valueLabel={macro(totals.protein, targetTotals?.protein)}
        />
        <MeterBar
          label="Carbs"
          value={totals.carbs}
          max={targetTotals?.carbs ?? null}
          tone="orange"
          valueLabel={macro(totals.carbs, targetTotals?.carbs)}
        />
        <MeterBar
          label="Fat"
          value={totals.fat}
          max={targetTotals?.fat ?? null}
          tone="neutral"
          valueLabel={macro(totals.fat, targetTotals?.fat)}
        />
        <p className="text-[13px] text-muted-foreground tabular-nums">
          Fiber {macro(totals.fiber, targetTotals?.fiber)} · Sugar{" "}
          {macro(totals.sugar, targetTotals?.sugar)}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t pt-3.5 tabular-nums">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[13px] text-muted-foreground">Energy out</dt>
          <dd className="font-semibold">
            {balance.caloriesOut === null ? (
              <span className="text-sm font-normal text-muted-foreground">No energy logged</span>
            ) : (
              `${wholeNumber.format(balance.caloriesOut)} kcal`
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[13px] text-muted-foreground">Balance</dt>
          <dd className="font-semibold">
            {balance.net === null
              ? "—"
              : `${balance.net > 0 ? "+" : ""}${wholeNumber.format(balance.net)} kcal`}
          </dd>
        </div>
        {balance.caloriesOut === null ? (
          <dd className="col-span-2 -mt-1">
            <Link
              to="/progress/energy/new"
              search={{ date }}
              className="text-[13px] font-medium text-link hover:underline"
            >
              Add energy for this day
            </Link>
          </dd>
        ) : null}
      </dl>
    </section>
  );
}

async function openDay(date: string): Promise<DailyIntakeLogData> {
  const data = (await gqlRequest(DailyIntakeLogQuery, { date })) as DailyIntakeLogQueryData;
  return {
    ...data,
    day: data.nutritionDays[0] ?? null,
    dailyEnergy: data.dailyEnergyEntries[0] ?? null,
  };
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
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3.5 pb-2.5">
      <strong className="text-[15px] font-semibold tabular-nums">{label}</strong>
      <span
        className={cn(
          "rounded-full px-2 py-px text-[12px] font-semibold",
          status === "Logged" ? "bg-positive-soft text-positive" : "bg-muted text-muted-foreground",
        )}
      >
        {status}
      </span>
      <span className="ml-auto text-[13px] text-muted-foreground tabular-nums">
        {wholeNumber.format(totals.kcal)} kcal · P {wholeNumber.format(totals.protein)}
      </span>
      {action}
    </header>
  );
}

function LoggedSlotCard({
  slot,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteGroup,
  disabled,
}: {
  slot: IntakeTimeSlot<DailyEntry>;
  onUpdateEntry: (entryId: string, set: EntryUpdateSet) => void;
  onDeleteEntry: (entryId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  disabled: boolean;
}) {
  return (
    <section aria-label={`${slot.label}, logged`} className="rounded-xl border bg-card">
      <SlotHeader label={slot.label} status="Logged" totals={slot.totals} />
      {slot.mealGroups.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-2.5">
          {slot.mealGroups.map((group) => (
            <span
              key={group.id}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-inset pr-1 pl-3 text-[13px]"
            >
              <span className="font-medium">{group.name}</span>
              <span className="text-muted-foreground">· {formatEntryCount(group.entryCount)}</span>
              <button
                type="button"
                onClick={() => onDeleteGroup(group.id)}
                disabled={disabled}
                className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={`Delete ${group.name} and its entries`}
              >
                <Trash2 className="size-3.5" />
              </button>
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
              onDelete={() => onDeleteEntry(slotEntry.entry.id)}
              disabled={disabled}
              provenance={slotEntry.mealName ? `From ${slotEntry.mealName}` : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function formatEntryCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "item" : "items"}`;
}

type DailyPlanEntry = (LogPlanSlot & { kind: "meal" }) | (LogPlanFoodSlot & { kind: "food" });
type DailyPlanTimeSlot = PlanTimeSlot<DailyPlanEntry>;

/** A plan time slot that hasn't been logged yet; one click logs all of it. */
function PlannedSlotCard({
  plan,
  slot,
  ensureDay,
  date,
  existingMealGroups,
  existingStandaloneEntries,
  disabled,
}: {
  plan: DailyPlan;
  slot: DailyPlanTimeSlot;
  ensureDay: () => Promise<string>;
  date: string;
  existingMealGroups: DailyLogMeal[];
  existingStandaloneEntries: DailyEntry[];
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
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
        selectedPlan: {
          ...plan,
          nutritionPlanMeals,
          nutritionPlanFoods,
        },
        nutritionDayId: dayId,
        existingMealGroups,
        existingStandaloneEntries,
        slotTimeByKey: { [slot.key]: slotTime },
      });
      return logSelectedPlanMaterialization(materialization);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      toast.success(`Logged ${slot.label} (${result.mealRows + result.entryRows} items)`);
    },
    onError: (error) => {
      toast.error(`Failed to log ${slot.label}: ${error.message}`);
    },
  });

  return (
    <section
      aria-label={`${slot.label}, planned`}
      className="rounded-xl border-[1.5px] border-border border-dashed"
    >
      <SlotHeader
        label={slot.label}
        status="Planned"
        totals={slot.totals}
        action={
          <Button
            type="button"
            size="sm"
            onClick={() => slotMutation.mutate()}
            disabled={disabled || slotMutation.isPending || slot.entries.length === 0}
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
    </section>
  );
}

function PlannedEntryRow({ entry }: { entry: DailyPlanEntry }) {
  const totals = planEntryMacroTotals(entry);
  const title = entry.kind === "meal" ? entry.label || entry.meal.name : entry.food.name;
  const detail = entry.kind === "food" ? formatMacro(entry.grams, "g") : mealEntryDetail(entry);

  return (
    <li className="flex items-center gap-x-3 border-t border-dashed px-4 py-2 text-sm text-muted-foreground">
      <span className="min-w-0 flex-1 truncate">
        {entry.kind === "meal" ? (
          <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent-soft-foreground">
            MEAL
          </span>
        ) : null}
        {title}
      </span>
      {detail ? <span className="shrink-0 px-3 tabular-nums">{detail}</span> : null}
      <span className="hidden w-12 shrink-0 text-right text-[13px] tabular-nums sm:inline">
        P {wholeNumber.format(totals.protein)}
      </span>
      <span className="w-16 shrink-0 text-right tabular-nums">
        {wholeNumber.format(totals.kcal)} kcal
      </span>
      <span aria-hidden="true" className="w-8 shrink-0" />
    </li>
  );
}

function mealEntryDetail(entry: DailyPlanEntry): string | null {
  if (entry.kind !== "meal") {
    return null;
  }
  return entry.label ? entry.meal.name : null;
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
      onUpdate({ grams: parsedGrams });
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

  const isAdHoc = entry.source === "ad_hoc";
  let editControl: ReactNode;
  if (isAdHoc) {
    editControl = <AdHocEntryEditDialog entry={entry} onSave={onUpdate} disabled={disabled} />;
  } else if (isEditingGrams) {
    editControl = (
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
    );
  } else {
    editControl = (
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
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm" title={`Per 100 g: ${snapshotMacroSummary(entry)}`}>
          {entry.snapshotFoodName}
        </p>
        {provenance || isAdHoc ? (
          <p className="text-[12px] text-muted-foreground">{provenance ?? "Quick entry"}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">{editControl}</div>
      <span className="hidden w-12 text-right text-[13px] text-muted-foreground tabular-nums sm:inline">
        P {wholeNumber.format(totals.protein)}
      </span>
      <span className="w-16 text-right text-sm tabular-nums">
        {wholeNumber.format(totals.kcal)}
        <span className="text-muted-foreground"> kcal</span>
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
        disabled={disabled}
        aria-label={`Delete ${entry.snapshotFoodName}`}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function AdHocEntryEditDialog({
  entry,
  onSave,
  disabled,
}: {
  entry: DailyEntry;
  onSave: (set: AdHocLogEntryUpdateSet) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdHocNutritionDraft>(() => adHocDraftFromEntry(entry));
  const [slotTime, setSlotTime] = useState(() => timeToInputValue(entry.slotTime));
  const previewTotals = adHocNutritionDraftTotals(draft);

  function openDialog() {
    setDraft(adHocDraftFromEntry(entry));
    setSlotTime(timeToInputValue(entry.slotTime));
    setOpen(true);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="outline" onClick={openDialog} disabled={disabled}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit custom food</DialogTitle>
          <DialogDescription>
            Update the one-off snapshot for this log entry. This does not create or modify a
            reusable food.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-1.5">
              <label htmlFor={`ad-hoc-edit-name-${entry.id}`} className="text-sm font-medium">
                Food name
              </label>
              <Input
                id={`ad-hoc-edit-name-${entry.id}`}
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                maxLength={160}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`ad-hoc-edit-grams-${entry.id}`} className="text-sm font-medium">
                Grams eaten
              </label>
              <Input
                id={`ad-hoc-edit-grams-${entry.id}`}
                type="text"
                inputMode="decimal"
                pattern={DECIMAL_INPUT_PATTERN}
                value={draft.grams}
                onChange={(event) => updateDraft("grams", event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`ad-hoc-edit-time-${entry.id}`} className="text-sm font-medium">
              Time eaten
            </label>
            <Input
              id={`ad-hoc-edit-time-${entry.id}`}
              type="time"
              value={slotTime}
              onChange={(event) => setSlotTime(event.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Nutrition per 100 g</h3>
              <p className="text-xs text-muted-foreground">
                Totals preview: {macroTotalsSummary(previewTotals)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {NUTRIENT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label
                    htmlFor={`ad-hoc-edit-${entry.id}-${field.key}`}
                    className="text-sm font-medium"
                  >
                    {field.label}
                  </label>
                  <div className="relative">
                    <Input
                      id={`ad-hoc-edit-${entry.id}-${field.key}`}
                      type="text"
                      inputMode="decimal"
                      pattern={DECIMAL_INPUT_PATTERN}
                      value={draft[field.key]}
                      onChange={(event) => updateDraft(field.key, event.target.value)}
                      className="pr-12"
                      required
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                      {field.suffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save custom food
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function DailyIntakeLogSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-64" />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}
