import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Clock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogFoodDialog } from "@/components/log-food-dialog";
import { LogMealDialog, type LogMealOption, type LogPlanSlot } from "@/components/log-meal-dialog";
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
  formatLocalDateLabel,
  formatMacro,
  formatTimeOfDay,
  loggedEntryMacroTotals,
  loggedMacroTotals,
  macroTotalsSummary,
  parseMacroInput,
  timeToInputValue,
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
};

type DailyDay = {
  id: string;
  logDate: string;
  nutritionPlanId?: string | null;
  nutritionLogMeals: DailyLogMeal[];
  nutritionLogEntries: DailyEntry[];
};

type DailyIntakeLogData = {
  day: DailyDay;
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

  const query = useQuery({
    queryKey: ["nutrition", "days", date],
    queryFn: () => openOrCreateDay(date),
  });

  const updatePlanMutation = useMutation({
    mutationFn: (nutritionPlanId: string | null) =>
      gqlRequest(UpdateNutritionDayPlanMutation, {
        id: query.data?.day.id ?? "",
        nutritionPlanId,
      }),
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
  const allEntries = [
    ...day.nutritionLogEntries,
    ...day.nutritionLogMeals.flatMap((meal) => meal.nutritionLogEntries),
  ];
  const totals = loggedMacroTotals(allEntries);
  const selectedPlan = nutritionPlans.find((plan) => plan.id === day.nutritionPlanId) ?? null;
  const nextEntryPosition = allEntries.length;
  const nextGroupPosition = day.nutritionLogMeals.length;
  const isMutating =
    updatePlanMutation.isPending ||
    updateEntryMutation.isPending ||
    deleteEntryMutation.isPending ||
    deleteGroupMutation.isPending ||
    deleteDayMutation.isPending;
  const loggedTimeGroups = groupLoggedFoodByTime(day.nutritionLogMeals, day.nutritionLogEntries);

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

      <MacroSummary
        totals={totals}
        title="Logged totals"
        description="Computed from snapshot kcal, fat, carbs, protein, fiber, and sugar on each logged row."
      />

      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg tracking-tight">Logged food</CardTitle>
              <p className="text-sm text-muted-foreground">
                Edit grams or delete individual entries without changing templates.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <LogMealDialog
                dayId={day.id}
                date={date}
                meals={meals}
                nextPosition={nextGroupPosition}
                disabled={isMutating}
              />
              <LogFoodDialog
                dayId={day.id}
                date={date}
                foods={foods}
                nextPosition={nextEntryPosition}
                disabled={isMutating}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {allEntries.length === 0 ? (
            <p className="rounded-md border border-border/60 border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No food has been logged for this day yet.
            </p>
          ) : null}

          {loggedTimeGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                {group.label}
              </h3>

              {group.items.map((item) =>
                item.kind === "meal" ? (
                  <LoggedMealGroup
                    key={item.meal.id}
                    group={item.meal}
                    onUpdateEntry={(entryId, grams) =>
                      updateEntryMutation.mutate({ id: entryId, grams })
                    }
                    onDeleteEntry={(entryId) => deleteEntryMutation.mutate(entryId)}
                    onDeleteGroup={() => deleteGroupMutation.mutate(item.meal.id)}
                    disabled={isMutating}
                    showTime={false}
                  />
                ) : (
                  <div
                    key={item.entry.id}
                    className="overflow-hidden rounded-md border border-border/60"
                  >
                    <EntryRow
                      entry={item.entry}
                      onUpdate={(grams) => updateEntryMutation.mutate({ id: item.entry.id, grams })}
                      onDelete={() => deleteEntryMutation.mutate(item.entry.id)}
                      disabled={isMutating}
                      showTime={false}
                    />
                  </div>
                ),
              )}
            </section>
          ))}
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
              value={day.nutritionPlanId ?? ""}
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
              disabled={!day.nutritionPlanId || updatePlanMutation.isPending}
            >
              Clear plan
            </Button>
          </div>

          {selectedPlan ? (
            <PlanSuggestions
              plan={selectedPlan}
              dayId={day.id}
              date={date}
              nextGroupPosition={nextGroupPosition}
              disabled={isMutating}
            />
          ) : (
            <p className="rounded-md border border-border/60 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Pick a plan to show timed meal suggestions, or log meals and foods ad hoc below.
            </p>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}

async function openOrCreateDay(date: string): Promise<DailyIntakeLogData> {
  const first = (await gqlRequest(DailyIntakeLogQuery, { date })) as DailyIntakeLogQueryData;
  const existing = first.nutritionDays[0];
  if (existing) {
    return { ...first, day: existing };
  }

  try {
    await gqlRequest(CreateNutritionDayMutation, { object: { logDate: date } });
  } catch (error) {
    if (!isUniqueConflictError(error)) {
      throw error;
    }
  }

  const second = (await gqlRequest(DailyIntakeLogQuery, { date })) as DailyIntakeLogQueryData;
  const created = second.nutritionDays[0];
  if (!created) {
    throw new Error("Nutrition day could not be opened after creation.");
  }
  return { ...second, day: created };
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

type LoggedFoodTimeItem =
  | { kind: "meal"; meal: DailyLogMeal; sortPosition: number }
  | { kind: "entry"; entry: DailyEntry; sortPosition: number };

type LoggedFoodTimeGroup = {
  key: string;
  label: string;
  sortKey: string;
  items: LoggedFoodTimeItem[];
};

function groupLoggedFoodByTime(
  mealGroups: DailyLogMeal[],
  standaloneEntries: DailyEntry[],
): LoggedFoodTimeGroup[] {
  const groups = new Map<string, LoggedFoodTimeGroup>();

  function ensureGroup(slotTime: unknown): LoggedFoodTimeGroup {
    const inputValue = timeToInputValue(slotTime);
    const key = inputValue || "no-time";
    const existing = groups.get(key);
    if (existing) {
      return existing;
    }
    const group: LoggedFoodTimeGroup = {
      key,
      label: inputValue ? formatTimeOfDay(inputValue) : "No time",
      sortKey: inputValue || "99:99",
      items: [],
    };
    groups.set(key, group);
    return group;
  }

  for (const meal of mealGroups) {
    ensureGroup(meal.slotTime).items.push({
      kind: "meal",
      meal,
      sortPosition: meal.position,
    });
  }

  for (const entry of standaloneEntries) {
    ensureGroup(entry.slotTime).items.push({
      kind: "entry",
      entry,
      sortPosition: entry.position,
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.toSorted((left, right) => left.sortPosition - right.sortPosition),
    }))
    .toSorted((left, right) => left.sortKey.localeCompare(right.sortKey));
}

function PlanSuggestions({
  plan,
  dayId,
  date,
  nextGroupPosition,
  disabled,
}: {
  plan: DailyPlan;
  dayId: string;
  date: string;
  nextGroupPosition: number;
  disabled: boolean;
}) {
  if (plan.nutritionPlanMeals.length === 0) {
    return (
      <p className="rounded-md border border-border/60 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        This selected plan does not have meal slots yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/60">
      <ul className="divide-y divide-border/50">
        {plan.nutritionPlanMeals.map((slot, index) => {
          const totals = mealMacroTotalsSafe(slot.meal);
          return (
            <li key={slot.id} className="flex items-start justify-between gap-3 px-3 py-3">
              <div className="min-w-0 space-y-1">
                <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
                  <Clock className="h-3 w-3" />
                  {formatTimeOfDay(slot.slotTime)}
                </p>
                <p className="truncate text-sm font-medium">{slot.label || slot.meal.name}</p>
                {slot.label ? (
                  <p className="text-xs text-muted-foreground">{slot.meal.name}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">{macroTotalsSummary(totals)}</p>
              </div>
              <LogMealDialog
                dayId={dayId}
                date={date}
                meals={[slot.meal]}
                slot={slot}
                nextPosition={nextGroupPosition + index}
                disabled={disabled}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function mealMacroTotalsSafe(meal: LogMealOption) {
  return loggedMacroTotals(
    meal.mealIngredients.map((ingredient) => ({
      grams: ingredient.grams,
      snapshotKcalPer100g: ingredient.food.kcalPer100g,
      snapshotFatPer100g: ingredient.food.fatPer100g,
      snapshotCarbsPer100g: ingredient.food.carbsPer100g,
      snapshotProteinPer100g: ingredient.food.proteinPer100g,
      snapshotFiberPer100g: ingredient.food.fiberPer100g,
      snapshotSugarPer100g: ingredient.food.sugarPer100g,
    })),
  );
}

function LoggedMealGroup({
  group,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteGroup,
  disabled,
  showTime = true,
}: {
  group: DailyLogMeal;
  onUpdateEntry: (entryId: string, grams: number) => void;
  onDeleteEntry: (entryId: string) => void;
  onDeleteGroup: () => void;
  disabled: boolean;
  showTime?: boolean;
}) {
  const totals = loggedMacroTotals(group.nutritionLogEntries);
  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{group.name}</h3>
          <p className="text-xs text-muted-foreground">
            {showTime && group.slotTime ? `${formatTimeOfDay(group.slotTime)} · ` : ""}
            {macroTotalsSummary(totals)}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDeleteGroup}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
          Delete group
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border border-border/60">
        {group.nutritionLogEntries.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            This logged meal has no entries.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {group.nutritionLogEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onUpdate={(grams) => onUpdateEntry(entry.id, grams)}
                onDelete={() => onDeleteEntry(entry.id)}
                disabled={disabled}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EntryRow({
  entry,
  onUpdate,
  onDelete,
  disabled,
  showTime = true,
}: {
  entry: DailyEntry;
  onUpdate: (grams: number) => void;
  onDelete: () => void;
  disabled: boolean;
  showTime?: boolean;
}) {
  const [isEditingGrams, setIsEditingGrams] = useState(false);
  const [grams, setGrams] = useState(String(entry.grams));

  useEffect(() => {
    setGrams(String(entry.grams));
    setIsEditingGrams(false);
  }, [entry.grams]);

  const totals = loggedEntryMacroTotals(entry);
  const parsedGrams = parseMacroInput(grams);
  const displayGrams = formatMacro(entry.grams, "g");

  function cancelEdit() {
    setGrams(String(entry.grams));
    setIsEditingGrams(false);
  }

  function save() {
    if (parsedGrams === null || parsedGrams <= 0) {
      toast.error("Enter grams greater than zero.");
      return;
    }
    if (String(entry.grams) !== grams) {
      onUpdate(parsedGrams);
      return;
    }
    setIsEditingGrams(false);
  }

  return (
    <li className="space-y-3 px-3 py-3 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{entry.snapshotFoodName}</p>
        <p className="text-xs text-muted-foreground">
          {showTime && entry.slotTime ? `${formatTimeOfDay(entry.slotTime)} · ` : ""}
          {macroTotalsSummary(totals)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {isEditingGrams ? (
          <Input
            id={`grams-${entry.id}`}
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
            onBlur={cancelEdit}
            inputMode="decimal"
            disabled={disabled}
            className="h-9 w-24"
            aria-label={`Grams for ${entry.snapshotFoodName}`}
            autoFocus
          />
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="tabular-nums"
            onClick={() => setIsEditingGrams(true)}
            disabled={disabled}
            title="Click to edit grams, then press Enter to save"
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
