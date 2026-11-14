import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2, Utensils } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type DailyEntry,
  type DailyLogMeal,
  type DailyPlan,
  type DailyPlanEntry,
  type DailyPlanTimeSlot,
  type EntryUpdateSet,
  invalidateDayLog,
  LoggedSlotCard,
  PlannedSlotCard,
} from "@/components/daily-intake-slots";
import { LogIntakeDialog, type LogMealOption } from "@/components/log-intake-dialog";
import { DayNavigator } from "@/components/nutrition-day-navigator";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { MeterBar } from "@/components/patterns/metrics";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { TodayEnergyEstimate } from "@/components/today-energy-estimate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import {
  calculateDailyEnergyBalance,
  type DailyEnergyBalance,
  type DailyEnergyNumericValue,
} from "@/lib/daily-energy";
import { gqlRequest } from "@/lib/graphql";
import { formatKcal, formatKcalNumber, formatSignedKcal } from "@/lib/metric-format";
import { useAuth } from "@/lib/nhost/auth-provider";
import {
  formatLocalDateLabel,
  formatWholeGrams,
  groupIntakeByTimeSlot,
  groupPlanEntriesByTimeSlot,
  type IntakeTimeSlot,
  loggedMacroTotals,
  type MacroTotals,
  mergePlanEntriesByTime,
  planEntriesMacroTotals,
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

type TimelineItem =
  | { kind: "logged"; sortKey: string; slot: IntakeTimeSlot<DailyEntry> }
  | { kind: "planned"; sortKey: string; slot: DailyPlanTimeSlot };

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

  const mutations = useDayLogMutations(date, async (nutritionPlanId) => {
    const dayId = nutritionPlanId ? await ensureDay() : query.data?.day?.id;
    if (!dayId) {
      return null;
    }
    return gqlRequest(UpdateNutritionDayPlanMutation, { id: dayId, nutritionPlanId });
  });

  if (!user) {
    return null;
  }
  if (query.isLoading) {
    return <DailyIntakeLogSkeleton />;
  }
  if (query.error) {
    return (
      <ErrorState
        title="Couldn't load this day"
        message={query.error.message}
        onRetry={() => query.refetch()}
        isRetrying={query.isFetching}
      />
    );
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
  const isMutating = mutations.isPending;
  const intakeSlots = groupIntakeByTimeSlot(loggedMeals, standaloneEntries);

  const plannedSlots = selectedPlan
    ? (groupPlanEntriesByTimeSlot(selectedPlanEntries as DailyPlanEntry[]) as DailyPlanTimeSlot[])
    : [];
  const loggedSlotKeys = new Set(intakeSlots.map((slot) => slot.key));
  const timeline: TimelineItem[] = [
    ...intakeSlots.map((slot) => ({ kind: "logged" as const, sortKey: slot.sortKey, slot })),
    ...plannedSlots.map((slot) => ({ kind: "planned" as const, sortKey: slot.sortKey, slot })),
  ].sort((left, right) => left.sortKey.localeCompare(right.sortKey));

  return (
    <div className="flex flex-col gap-5">
      <DayNavigator date={date}>
        <LogIntakeDialog
          ensureDay={ensureDay}
          date={date}
          foods={foods}
          meals={meals}
          selectedPlan={selectedPlan}
          nextEntryPosition={allEntries.length}
          nextGroupPosition={loggedMeals.length}
          disabled={isMutating}
          triggerLabel="Log food"
          triggerVariant="default"
        />
      </DayNavigator>

      {/* The day summary stacks above the timeline until both fit side by side (Web-NutritionDay). */}
      <div className="@container">
        <div className="grid items-start gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <section aria-label="Timeline" className="flex min-w-0 flex-col gap-3">
            {timeline.length === 0 ? (
              <EmptyState
                icon={Utensils}
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
                  onUpdateEntry={(entryId, set) => mutations.updateEntry(entryId, set)}
                  onDeleteEntry={mutations.deleteEntry}
                  onDeleteGroup={mutations.deleteGroup}
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
                  hasLoggedIntake={loggedSlotKeys.has(item.slot.key)}
                  disabled={isMutating}
                />
              ),
            )}
            {day ? (
              <ClearDayButton
                date={date}
                onConfirm={(onSuccess) => mutations.deleteDay(day.id, onSuccess)}
                isPending={mutations.isClearingDay}
              />
            ) : null}
          </section>

          <aside
            aria-label="Day summary"
            className="order-first flex min-w-0 flex-col gap-4 @min-[880px]:sticky @min-[880px]:top-6 @min-[880px]:order-none"
          >
            <DaySummaryCard
              totals={totals}
              targetTotals={targetTotals}
              balance={calorieBalance}
              date={date}
              nutritionPlans={nutritionPlans}
              selectedPlanId={day?.nutritionPlanId ?? ""}
              onPlanChange={mutations.updatePlan}
              isUpdatingPlan={mutations.isUpdatingPlan}
            />
            <TodayEnergyEstimate
              variant="log"
              date={date}
              balance={{ userId: user.id, caloriesIn: totals.kcal, dailyEnergy }}
            />
            <p className="text-[12px] leading-normal text-muted-foreground">
              Totals use the values saved when food was logged, so later edits to foods or plans
              don’t change this day.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * The day log's writes. Every success refreshes the day, the week strip and
 * calorie history (both under ["nutrition", "days", "index"]) and Today.
 */
function useDayLogMutations(
  date: string,
  updateDayPlan: (nutritionPlanId: string | null) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  const succeed = (message: string) => () => {
    invalidateDayLog(queryClient, date);
    toast.success(message);
  };

  const updatePlanMutation = useMutation({
    mutationFn: updateDayPlan,
    onSuccess: succeed("Day plan updated"),
    onError: (error) => toast.error(`Failed to update plan: ${error.message}`),
  });
  const updateEntryMutation = useMutation({
    mutationFn: ({ id, set }: { id: string; set: EntryUpdateSet }) =>
      gqlRequest(UpdateNutritionLogEntryMutation, { id, set }),
    onSuccess: succeed("Entry updated"),
    onError: (error) => toast.error(`Failed to update entry: ${error.message}`),
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteNutritionLogEntryMutation, { id }),
    onSuccess: succeed("Entry deleted"),
    onError: (error) => toast.error(`Failed to delete entry: ${error.message}`),
  });
  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteNutritionLogMealMutation, { id }),
    onSuccess: succeed("Logged meal deleted"),
    onError: (error) => toast.error(`Failed to delete logged meal: ${error.message}`),
  });
  const deleteDayMutation = useMutation({
    mutationFn: (id: string) => gqlRequest(DeleteNutritionDayMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      toast.success("Day log cleared");
    },
    onError: (error) => toast.error(`Failed to clear day: ${error.message}`),
  });

  return {
    isPending:
      updatePlanMutation.isPending ||
      updateEntryMutation.isPending ||
      deleteEntryMutation.isPending ||
      deleteGroupMutation.isPending ||
      deleteDayMutation.isPending,
    isUpdatingPlan: updatePlanMutation.isPending,
    isClearingDay: deleteDayMutation.isPending,
    updatePlan: (planId: string | null) => updatePlanMutation.mutate(planId),
    updateEntry: (id: string, set: EntryUpdateSet) => updateEntryMutation.mutate({ id, set }),
    deleteEntry: (id: string, onSuccess: () => void) =>
      deleteEntryMutation.mutate(id, { onSuccess }),
    deleteGroup: (id: string, onSuccess: () => void) =>
      deleteGroupMutation.mutate(id, { onSuccess }),
    deleteDay: (id: string, onSuccess: () => void) => deleteDayMutation.mutate(id, { onSuccess }),
  };
}

function ClearDayButton({
  date,
  onConfirm,
  isPending,
}: {
  date: string;
  onConfirm: (onSuccess: () => void) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        <Trash2 />
        Clear day log
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={(next) => {
          if (!isPending) {
            setOpen(next);
          }
        }}
        title="Clear this day's log?"
        description={`Everything logged on ${formatLocalDateLabel(date)} is deleted, including meal groups. This can't be undone.`}
        confirmLabel="Clear day"
        pendingLabel="Clearing…"
        onConfirm={() => onConfirm(() => setOpen(false))}
        isPending={isPending}
        destructive={true}
      />
    </>
  );
}

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
      ? `${formatWholeGrams(value)} g`
      : `${formatWholeGrams(value)} / ${formatWholeGrams(target)} g`;
  return (
    <section className="flex flex-col gap-3.5 rounded-[14px] border bg-card p-5 tabular-nums">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="day-plan" className="text-[13px] font-semibold text-muted-foreground">
          Plan
        </label>
        <select
          id="day-plan"
          aria-label="Selected nutrition plan"
          value={selectedPlanId}
          onChange={(event) => onPlanChange(event.target.value || null)}
          disabled={isUpdatingPlan}
          className="h-8 min-w-0 max-w-[70%] rounded-[9px] border bg-card px-2.5 text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <option value="">No plan</option>
          {nutritionPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>
      <p>
        <strong className="text-[28px] font-bold">{formatKcalNumber(totals.kcal)}</strong>
        <span className="text-sm font-medium text-muted-foreground">
          {targetTotals ? ` / ${formatKcal(targetTotals.kcal)}` : " kcal"}
        </span>
      </p>
      {targetTotals ? (
        <div className="-mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${kcalPercent}%` }} />
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5">
        <MeterBar
          label="Protein"
          value={totals.protein}
          max={targetTotals?.protein ?? null}
          tone="protein"
          valueLabel={macro(totals.protein, targetTotals?.protein)}
        />
        <MeterBar
          label="Carbs"
          value={totals.carbs}
          max={targetTotals?.carbs ?? null}
          tone="carbs"
          valueLabel={macro(totals.carbs, targetTotals?.carbs)}
        />
        <MeterBar
          label="Fat"
          value={totals.fat}
          max={targetTotals?.fat ?? null}
          tone="fat"
          valueLabel={macro(totals.fat, targetTotals?.fat)}
        />
      </div>
      <p className="text-[13px] text-muted-foreground">
        Fiber {macro(totals.fiber, targetTotals?.fiber)} · Sugar{" "}
        {macro(totals.sugar, targetTotals?.sugar)}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-3.5">
        <div className="flex flex-col gap-1">
          <dt className="text-[13px] text-muted-foreground">Energy out</dt>
          <dd className="text-[17px] font-bold">
            {balance.caloriesOut === null ? (
              <span className="text-sm font-normal text-muted-foreground">No energy logged</span>
            ) : (
              formatKcal(balance.caloriesOut)
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[13px] text-muted-foreground">Balance</dt>
          <dd className="text-[17px] font-bold">
            {balance.net === null ? "—" : formatSignedKcal(balance.net)}
          </dd>
        </div>
        {balance.caloriesOut === null ? (
          <dd className="col-span-2 mt-1">
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

function DailyIntakeLogSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-[68px] w-full rounded-[14px]" />
      <div className="@container">
        <div className="grid items-start gap-5 @min-[880px]:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-40 w-full rounded-[14px]" />
            <Skeleton className="h-32 w-full rounded-[14px]" />
          </div>
          <Skeleton className="order-first h-80 w-full rounded-[14px] @min-[880px]:order-none" />
        </div>
      </div>
    </div>
  );
}
