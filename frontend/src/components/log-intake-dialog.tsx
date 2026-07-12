import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Apple, ChefHat, ClipboardList, Clock, Plus, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FoodPicker, type FoodPickerOption } from "@/components/food-picker";
import { MealPicker } from "@/components/meal-picker";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  type AdHocNutritionDraft,
  adHocNutritionDraftTotals,
  buildAdHocLogEntryInsertInput,
  createEmptyAdHocNutritionDraft,
  currentTimeInputValue,
  DECIMAL_INPUT_PATTERN,
  formatMacro,
  formatTimeOfDay,
  groupPlanEntriesByTimeSlot,
  intakeDraftMacroTotals,
  macroTotalsSummary,
  mergePlanEntriesByTime,
  NUTRIENT_FIELDS,
  normalizeNumeric,
  type PlanTimeSlot,
  parseMacroInput,
  timeToInputValue,
  validateAdHocNutritionDraft,
} from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const LogFoodMutation = graphql(`
  mutation LogFood($object: nutritionLogEntries_insert_input!) {
    insertNutritionLogEntry(object: $object) {
      id
    }
  }
`);

const LogMealMutation = graphql(`
  mutation LogMeal($object: nutritionLogMeals_insert_input!) {
    insertNutritionLogMeal(object: $object) {
      id
    }
  }
`);

interface LogMealFood {
  id: string;
  name: string;
  kcalPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
  proteinPer100g: unknown;
  fiberPer100g: unknown;
  sugarPer100g: unknown;
}

interface LogMealIngredient {
  id: string;
  grams: unknown;
  position: number;
  food: LogMealFood;
}

export interface LogMealOption {
  id: string;
  name: string;
  description?: string | null;
  mealIngredients: LogMealIngredient[];
}

export interface LogPlanSlot {
  id: string;
  slotTime: string;
  label?: string | null;
  position: number;
  meal: LogMealOption;
}

export interface LogPlanFoodSlot {
  id: string;
  slotTime: string;
  label?: string | null;
  position: number;
  grams: unknown;
  food: FoodPickerOption;
}

export type LogIntakeInitialSource =
  | { kind: "plan-meal"; slot: LogPlanSlot }
  | { kind: "plan-food"; slot: LogPlanFoodSlot };

interface LogIntakeDialogProps {
  ensureDay: () => Promise<string>;
  date: string;
  foods: FoodPickerOption[];
  meals: LogMealOption[];
  selectedPlan?: {
    id: string;
    name: string;
    nutritionPlanMeals: LogPlanSlot[];
    nutritionPlanFoods: LogPlanFoodSlot[];
  } | null;
  nextEntryPosition: number;
  nextGroupPosition: number;
  disabled?: boolean;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  initialSource?: LogIntakeInitialSource;
}

type DialogMode = "food" | "meal" | "plan" | "ad-hoc";

type PlanEntry = (LogPlanSlot & { kind: "meal" }) | (LogPlanFoodSlot & { kind: "food" });

type SelectedSource =
  | {
      kind: "food";
      key: string;
      title: string;
      food: FoodPickerOption;
      nutritionPlanFoodId: null;
    }
  | {
      kind: "meal";
      key: string;
      title: string;
      meal: LogMealOption;
      nutritionPlanMealId: null;
    }
  | {
      kind: "plan-food";
      key: string;
      title: string;
      subtitle: string | null;
      plannedSlotTime: string;
      food: FoodPickerOption;
      grams: unknown;
      nutritionPlanFoodId: string;
    }
  | {
      kind: "plan-meal";
      key: string;
      title: string;
      subtitle: string | null;
      plannedSlotTime: string;
      meal: LogMealOption;
      nutritionPlanMealId: string;
    };

interface DraftItem {
  key: string;
  food: LogMealFood;
  grams: string;
}

export function LogIntakeDialog({
  ensureDay,
  date,
  foods,
  meals,
  selectedPlan,
  nextEntryPosition,
  nextGroupPosition,
  disabled,
  triggerLabel,
  triggerVariant = "outline",
  initialSource,
}: LogIntakeDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>(initialSource ? "plan" : "food");
  const [foodId, setFoodId] = useState("");
  const [mealId, setMealId] = useState("");
  const [planSourceKey, setPlanSourceKey] = useState("");
  const [planQuery, setPlanQuery] = useState("");
  const [slotTime, setSlotTime] = useState(() => currentTimeInputValue());
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [adHocDraft, setAdHocDraft] = useState<AdHocNutritionDraft>(() =>
    createEmptyAdHocNutritionDraft(),
  );

  const initialSourceKind = initialSource?.kind ?? null;
  const hasInitialSource = initialSourceKind !== null;
  const initialSourceKey = initialSource ? sourceKeyForInitial(initialSource) : "";
  const initialPlanEntry = useMemo(
    () => (initialSource ? planEntryForInitial(initialSource) : null),
    [initialSource],
  );
  const planEntries = useMemo(
    () =>
      selectedPlan
        ? (mergePlanEntriesByTime(
            selectedPlan.nutritionPlanMeals,
            selectedPlan.nutritionPlanFoods,
          ) as PlanEntry[])
        : [],
    [selectedPlan],
  );
  const visiblePlanEntries = useMemo(() => {
    const trimmed = planQuery.trim().toLowerCase();
    if (!trimmed) {
      return planEntries;
    }
    return planEntries.filter((entry) => planEntrySearchText(entry).includes(trimmed));
  }, [planEntries, planQuery]);

  useEffect(() => {
    if (!selectedPlan && !hasInitialSource && mode === "plan") {
      setMode("food");
      setPlanSourceKey("");
    }
  }, [selectedPlan, hasInitialSource, mode]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSlotTime(currentTimeInputValue());
    setPlanQuery("");
    setAdHocDraft(createEmptyAdHocNutritionDraft());

    if (hasInitialSource) {
      setMode("plan");
      setPlanSourceKey(initialSourceKey);
      setFoodId("");
      setMealId("");
      return;
    }

    setMode("food");
    setFoodId("");
    setMealId("");
    setPlanSourceKey("");
  }, [open, hasInitialSource, initialSourceKey]);

  const selectedSource = useMemo(
    () =>
      resolveSelectedSource({
        mode,
        foodId,
        mealId,
        planSourceKey,
        foods,
        meals,
        planEntries,
        initialPlanEntry,
      }),
    [mode, foodId, mealId, planSourceKey, foods, meals, planEntries, initialPlanEntry],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftItems(selectedSource ? materializeDraftItems(selectedSource) : []);
  }, [open, selectedSource]);

  const draftValidity = validateDraftItems(draftItems);
  const adHocValidation = validateAdHocNutritionDraft(adHocDraft);
  const previewTotals =
    mode === "ad-hoc"
      ? adHocNutritionDraftTotals(adHocDraft)
      : intakeDraftMacroTotals(
          draftItems.map((item) => ({ food: item.food, grams: parseMacroInput(item.grams) ?? 0 })),
        );
  const canSave =
    mode === "ad-hoc"
      ? adHocValidation.valid && Boolean(slotTime)
      : Boolean(selectedSource) && draftValidity.valid && Boolean(slotTime);

  const mutations = useLogIntakeMutations({
    date,
    ensureDay,
    selectedSource,
    draftItems,
    draftValidity,
    adHocDraft,
    nextEntryPosition,
    nextGroupPosition,
    slotTime,
    onLogged: () => setOpen(false),
  });
  const isPending = mutations.isPending;

  function saveDraft() {
    if (mode === "ad-hoc") {
      if (!canSave) {
        toast.error(adHocValidation.message || "Choose the time eaten.");
        return;
      }
      mutations.logAdHoc();
      return;
    }
    if (!selectedSource) {
      toast.error("Choose something to log.");
      return;
    }
    if (!canSave) {
      toast.error(draftValidity.message || "Choose the time eaten.");
      return;
    }
    if (selectedSource.kind === "food" || selectedSource.kind === "plan-food") {
      mutations.logFood();
      return;
    }
    mutations.logMeal();
  }

  function updateDraftGrams(key: string, grams: string) {
    setDraftItems((items) => items.map((item) => (item.key === key ? { ...item, grams } : item)));
  }

  function updateAdHocDraft(key: keyof AdHocNutritionDraft, value: string) {
    setAdHocDraft((draft) => ({ ...draft, [key]: value }));
  }

  const buttonLabel = triggerLabel ?? "Add intake";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={triggerVariant} disabled={disabled}>
          <LogIntakeTriggerIcon initialSourceKind={initialSourceKind} />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-3xl">
        <LogIntakeDialogContents
          mode={mode}
          onModeChange={setMode}
          foods={foods}
          foodId={foodId}
          onFoodIdChange={setFoodId}
          meals={meals}
          mealId={mealId}
          onMealIdChange={setMealId}
          selectedPlanName={selectedPlan?.name ?? null}
          hasPlanSource={Boolean(selectedPlan) || hasInitialSource}
          planEntries={visiblePlanEntries}
          planSourceKey={planSourceKey}
          planQuery={planQuery}
          onPlanQueryChange={setPlanQuery}
          onPlanSourceKeyChange={setPlanSourceKey}
          initialPlanEntry={initialPlanEntry}
          slotTime={slotTime}
          onSlotTimeChange={setSlotTime}
          selectedSource={selectedSource}
          draftItems={draftItems}
          adHocDraft={adHocDraft}
          adHocValidationMessage={adHocValidation.message}
          previewSummary={macroTotalsSummary(previewTotals)}
          onGramsChange={updateDraftGrams}
          onAdHocDraftChange={updateAdHocDraft}
          canSave={canSave}
          isPending={isPending}
          onCancel={() => setOpen(false)}
          onSave={saveDraft}
        />
      </DialogContent>
    </Dialog>
  );
}

function useLogIntakeMutations({
  date,
  ensureDay,
  selectedSource,
  draftItems,
  draftValidity,
  adHocDraft,
  nextEntryPosition,
  nextGroupPosition,
  slotTime,
  onLogged,
}: {
  date: string;
  ensureDay: () => Promise<string>;
  selectedSource: SelectedSource | null;
  draftItems: DraftItem[];
  draftValidity: { valid: boolean; message: string };
  adHocDraft: AdHocNutritionDraft;
  nextEntryPosition: number;
  nextGroupPosition: number;
  slotTime: string;
  onLogged: () => void;
}) {
  const queryClient = useQueryClient();

  function handleLoggedSuccess(label: string) {
    queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
    queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
    toast.success(`${label} logged`);
    onLogged();
  }

  const logFoodMutation = useMutation({
    mutationFn: async () => {
      if (
        !selectedSource ||
        (selectedSource.kind !== "food" && selectedSource.kind !== "plan-food")
      ) {
        throw new Error("Choose a food to log.");
      }
      const [item] = draftItems;
      const grams = item ? parseMacroInput(item.grams) : null;
      if (!item || grams === null || grams <= 0) {
        throw new Error("Enter grams greater than zero.");
      }
      if (!slotTime) {
        throw new Error("Choose the time eaten.");
      }

      const dayId = await ensureDay();
      return gqlRequest(LogFoodMutation, {
        object: {
          nutritionDayId: dayId,
          foodId: item.food.id,
          nutritionPlanFoodId:
            selectedSource.kind === "plan-food" ? selectedSource.nutritionPlanFoodId : null,
          grams,
          position: nextEntryPosition,
          slotTime,
        },
      });
    },
    onSuccess: () =>
      handleLoggedSuccess(selectedSource?.kind === "plan-food" ? "Planned food" : "Food"),
    onError: (error) => {
      toast.error(`Failed to log food: ${error.message}`);
    },
  });

  const logAdHocMutation = useMutation({
    mutationFn: async () => {
      const dayId = await ensureDay();
      return gqlRequest(LogFoodMutation, {
        object: buildAdHocLogEntryInsertInput({
          draft: adHocDraft,
          nutritionDayId: dayId,
          position: nextEntryPosition,
          slotTime,
        }),
      });
    },
    onSuccess: () => handleLoggedSuccess("Custom food"),
    onError: (error) => {
      toast.error(`Failed to log custom food: ${error.message}`);
    },
  });

  const logMealMutation = useMutation({
    mutationFn: async () => {
      if (
        !selectedSource ||
        (selectedSource.kind !== "meal" && selectedSource.kind !== "plan-meal")
      ) {
        throw new Error("Choose a meal to log.");
      }
      if (draftItems.length === 0) {
        throw new Error("This meal has no ingredients to log.");
      }
      if (!draftValidity.valid) {
        throw new Error(draftValidity.message);
      }
      if (!slotTime) {
        throw new Error("Choose the time eaten.");
      }

      const dayId = await ensureDay();
      const meal = selectedSource.meal;
      return gqlRequest(LogMealMutation, {
        object: {
          nutritionDayId: dayId,
          mealId: meal.id,
          nutritionPlanMealId:
            selectedSource.kind === "plan-meal" ? selectedSource.nutritionPlanMealId : null,
          name: selectedSource.title,
          slotTime,
          position: nextGroupPosition,
          nutritionLogEntries: {
            data: draftItems.map((item, index) => ({
              nutritionDayId: dayId,
              foodId: item.food.id,
              grams: parseMacroInput(item.grams) ?? normalizeNumeric(item.grams),
              position: index,
              slotTime,
            })),
          },
        },
      });
    },
    onSuccess: () =>
      handleLoggedSuccess(selectedSource?.kind === "plan-meal" ? "Planned meal" : "Meal"),
    onError: (error) => {
      toast.error(`Failed to log meal: ${error.message}`);
    },
  });

  return {
    isPending: logFoodMutation.isPending || logAdHocMutation.isPending || logMealMutation.isPending,
    logFood: logFoodMutation.mutate,
    logAdHoc: logAdHocMutation.mutate,
    logMeal: logMealMutation.mutate,
  };
}

function LogIntakeDialogContents({
  mode,
  onModeChange,
  foods,
  foodId,
  onFoodIdChange,
  meals,
  mealId,
  onMealIdChange,
  selectedPlanName,
  hasPlanSource,
  planEntries,
  planSourceKey,
  planQuery,
  onPlanQueryChange,
  onPlanSourceKeyChange,
  initialPlanEntry,
  slotTime,
  onSlotTimeChange,
  selectedSource,
  draftItems,
  adHocDraft,
  adHocValidationMessage,
  previewSummary,
  onGramsChange,
  onAdHocDraftChange,
  canSave,
  isPending,
  onCancel,
  onSave,
}: {
  mode: DialogMode;
  onModeChange: (mode: DialogMode) => void;
  foods: FoodPickerOption[];
  foodId: string;
  onFoodIdChange: (foodId: string) => void;
  meals: LogMealOption[];
  mealId: string;
  onMealIdChange: (mealId: string) => void;
  selectedPlanName: string | null;
  hasPlanSource: boolean;
  planEntries: PlanEntry[];
  planSourceKey: string;
  planQuery: string;
  onPlanQueryChange: (query: string) => void;
  onPlanSourceKeyChange: (key: string) => void;
  initialPlanEntry: PlanEntry | null;
  slotTime: string;
  onSlotTimeChange: (slotTime: string) => void;
  selectedSource: SelectedSource | null;
  draftItems: DraftItem[];
  adHocDraft: AdHocNutritionDraft;
  adHocValidationMessage: string;
  previewSummary: string;
  onGramsChange: (key: string, grams: string) => void;
  onAdHocDraftChange: (key: keyof AdHocNutritionDraft, value: string) => void;
  canSave: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Log intake</DialogTitle>
        <DialogDescription>
          Choose a food, meal, or selected-plan suggestion. Actual eaten time defaults to now and
          stays editable; source templates are never rewritten.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <LogIntakeSourceTabs
          mode={mode}
          onModeChange={onModeChange}
          foods={foods}
          foodId={foodId}
          onFoodIdChange={onFoodIdChange}
          meals={meals}
          mealId={mealId}
          onMealIdChange={onMealIdChange}
          selectedPlanName={selectedPlanName}
          hasPlanSource={hasPlanSource}
          planEntries={planEntries}
          planSourceKey={planSourceKey}
          planQuery={planQuery}
          onPlanQueryChange={onPlanQueryChange}
          onPlanSourceKeyChange={onPlanSourceKeyChange}
          disabled={isPending}
          initialPlanEntry={initialPlanEntry}
          adHocDraft={adHocDraft}
          onAdHocDraftChange={onAdHocDraftChange}
        />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="space-y-2">
            <Label htmlFor="log-intake-time">Time eaten</Label>
            <Input
              id="log-intake-time"
              type="time"
              value={slotTime}
              onChange={(event) => onSlotTimeChange(event.target.value)}
              disabled={isPending}
              required
            />
            <p className="text-xs text-muted-foreground">
              Defaults to now. Planned slot times are shown as suggestions only.
            </p>
          </div>

          {selectedSource && "plannedSlotTime" in selectedSource ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Planned {formatTimeOfDay(selectedSource.plannedSlotTime)}
              </p>
              <p className="text-xs text-muted-foreground">
                The logged entry will use{" "}
                {slotTime ? formatTimeOfDay(slotTime) : "your chosen time"}.
              </p>
            </div>
          ) : null}
        </div>

        {mode === "ad-hoc" ? (
          <AdHocDraftReview
            previewSummary={previewSummary}
            validationMessage={adHocValidationMessage}
          />
        ) : (
          <DraftReview
            selectedSource={selectedSource}
            draftItems={draftItems}
            previewSummary={previewSummary}
            disabled={isPending}
            onGramsChange={onGramsChange}
          />
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={isPending || !canSave}>
          {isPending ? "Logging…" : "Log intake"}
        </Button>
      </DialogFooter>
    </>
  );
}

function LogIntakeTriggerIcon({
  initialSourceKind,
}: {
  initialSourceKind: LogIntakeInitialSource["kind"] | null;
}) {
  if (initialSourceKind === "plan-meal") {
    return <ChefHat className="h-4 w-4" />;
  }
  if (initialSourceKind === "plan-food") {
    return <Apple className="h-4 w-4" />;
  }
  return <Plus className="h-4 w-4" />;
}

function LogIntakeSourceTabs({
  mode,
  onModeChange,
  foods,
  foodId,
  onFoodIdChange,
  meals,
  mealId,
  onMealIdChange,
  selectedPlanName,
  hasPlanSource,
  planEntries,
  planSourceKey,
  planQuery,
  onPlanQueryChange,
  onPlanSourceKeyChange,
  disabled,
  initialPlanEntry,
  adHocDraft,
  onAdHocDraftChange,
}: {
  mode: DialogMode;
  onModeChange: (mode: DialogMode) => void;
  foods: FoodPickerOption[];
  foodId: string;
  onFoodIdChange: (foodId: string) => void;
  meals: LogMealOption[];
  mealId: string;
  onMealIdChange: (mealId: string) => void;
  selectedPlanName: string | null;
  hasPlanSource: boolean;
  planEntries: PlanEntry[];
  planSourceKey: string;
  planQuery: string;
  onPlanQueryChange: (query: string) => void;
  onPlanSourceKeyChange: (key: string) => void;
  disabled: boolean;
  initialPlanEntry: PlanEntry | null;
  adHocDraft: AdHocNutritionDraft;
  onAdHocDraftChange: (key: keyof AdHocNutritionDraft, value: string) => void;
}) {
  return (
    <Tabs value={mode} onValueChange={(value) => onModeChange(value as DialogMode)}>
      <TabsList>
        <TabsTrigger value="food">
          <Apple className="h-3.5 w-3.5" /> Food
        </TabsTrigger>
        <TabsTrigger value="meal">
          <ChefHat className="h-3.5 w-3.5" /> Meal
        </TabsTrigger>
        {hasPlanSource ? (
          <TabsTrigger value="plan">
            <ClipboardList className="h-3.5 w-3.5" /> From plan
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="ad-hoc">
          <Sparkles className="h-3.5 w-3.5" /> Custom
        </TabsTrigger>
      </TabsList>

      <TabsContent value="food" className="space-y-3">
        <div className="space-y-2">
          <Label>Food</Label>
          <FoodPicker
            foods={foods}
            value={foodId}
            onChange={(nextFoodId) => {
              onModeChange("food");
              onFoodIdChange(nextFoodId);
            }}
            disabled={disabled}
          />
        </div>
      </TabsContent>

      <TabsContent value="meal" className="space-y-3">
        <div className="space-y-2">
          <Label>Meal template</Label>
          <MealPicker
            meals={meals}
            value={mealId}
            onChange={(nextMealId) => {
              onModeChange("meal");
              onMealIdChange(nextMealId);
            }}
            disabled={disabled}
          />
        </div>
      </TabsContent>

      <TabsContent value="ad-hoc" className="space-y-3">
        <AdHocNutritionFields
          draft={adHocDraft}
          onDraftChange={(key, value) => {
            onModeChange("ad-hoc");
            onAdHocDraftChange(key, value);
          }}
          disabled={disabled}
        />
      </TabsContent>

      {hasPlanSource ? (
        <TabsContent value="plan" className="space-y-3">
          <PlanSourcePicker
            planName={selectedPlanName ?? "selected plan"}
            entries={planEntries}
            selectedKey={planSourceKey}
            query={planQuery}
            onQueryChange={onPlanQueryChange}
            onSelect={(key) => {
              onModeChange("plan");
              onPlanSourceKeyChange(key);
            }}
            disabled={disabled}
            initialPlanEntry={initialPlanEntry}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function PlanSourcePicker({
  planName,
  entries,
  selectedKey,
  query,
  onQueryChange,
  onSelect,
  disabled,
  initialPlanEntry,
}: {
  planName: string;
  entries: PlanEntry[];
  selectedKey: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (key: string) => void;
  disabled: boolean;
  initialPlanEntry: PlanEntry | null;
}) {
  const shownEntries = initialPlanEntry
    ? mergeInitialPlanEntry(entries, initialPlanEntry)
    : entries;
  const shownSlots = groupPlanEntriesByTimeSlot(shownEntries) as PlanTimeSlot<PlanEntry>[];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="log-intake-plan-search">Plan suggestions from {planName}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="log-intake-plan-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search selected plan entries…"
            className="pl-9"
            disabled={disabled}
          />
        </div>
      </div>

      {shownEntries.length === 0 ? (
        <p className="rounded-md border border-border/60 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No selected-plan entries match this search.
        </p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border/60 p-2">
          {shownSlots.map((slot) => (
            <section key={slot.key} className="overflow-hidden rounded-md border border-border/60">
              <div className="bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                {slot.label}
              </div>
              <ul className="divide-y divide-border/50">
                {slot.entries.map((entry) => (
                  <PlanSourcePickerRow
                    key={sourceKeyForPlanEntry(entry)}
                    entry={entry}
                    selected={sourceKeyForPlanEntry(entry) === selectedKey}
                    disabled={disabled}
                    onSelect={() => onSelect(sourceKeyForPlanEntry(entry))}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanSourcePickerRow({
  entry,
  selected,
  disabled,
  onSelect,
}: {
  entry: PlanEntry;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const title = entry.kind === "food" ? entry.food.name : entry.label || entry.meal.name;
  const subtitle = entry.kind === "meal" ? entry.meal.name : null;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={cn(
          "flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
          selected && "bg-primary/10 text-primary hover:bg-primary/15",
        )}
      >
        <span className="min-w-0 space-y-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {entry.kind === "meal" && entry.label && subtitle ? (
            <span className="block truncate text-xs text-muted-foreground">
              Template: {subtitle}
            </span>
          ) : null}
          {entry.kind === "food" ? (
            <span className="block text-xs text-muted-foreground">
              {formatMacro(entry.grams, "g")}
            </span>
          ) : null}
        </span>
        {selected ? <span className="text-xs font-medium">Selected</span> : null}
      </button>
    </li>
  );
}

function AdHocNutritionFields({
  draft,
  onDraftChange,
  disabled,
}: {
  draft: AdHocNutritionDraft;
  onDraftChange: (key: keyof AdHocNutritionDraft, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="log-intake-ad-hoc-name">Food name</Label>
          <Input
            id="log-intake-ad-hoc-name"
            value={draft.name}
            onChange={(event) => onDraftChange("name", event.target.value)}
            placeholder="e.g. Restaurant noodles"
            maxLength={160}
            disabled={disabled}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="log-intake-ad-hoc-grams">Grams eaten</Label>
          <Input
            id="log-intake-ad-hoc-grams"
            type="text"
            inputMode="decimal"
            pattern={DECIMAL_INPUT_PATTERN}
            value={draft.grams}
            onChange={(event) => onDraftChange("grams", event.target.value)}
            disabled={disabled}
            required
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Nutrition per 100 g</h3>
          <p className="text-xs text-muted-foreground">
            Saved only on this log entry; it will not create or update reusable foods.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {NUTRIENT_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`log-intake-ad-hoc-${field.key}`}>{field.label}</Label>
              <div className="relative">
                <Input
                  id={`log-intake-ad-hoc-${field.key}`}
                  type="text"
                  inputMode="decimal"
                  pattern={DECIMAL_INPUT_PATTERN}
                  value={draft[field.key]}
                  onChange={(event) => onDraftChange(field.key, event.target.value)}
                  className="pr-12"
                  disabled={disabled}
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
  );
}

function AdHocDraftReview({
  previewSummary,
  validationMessage,
}: {
  previewSummary: string;
  validationMessage: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Review custom food</p>
        <p className="text-xs text-muted-foreground">{previewSummary}</p>
      </div>
      {validationMessage ? <p className="text-xs text-destructive">{validationMessage}</p> : null}
    </div>
  );
}

function DraftReview({
  selectedSource,
  draftItems,
  previewSummary,
  disabled,
  onGramsChange,
}: {
  selectedSource: SelectedSource | null;
  draftItems: DraftItem[];
  previewSummary: string;
  disabled: boolean;
  onGramsChange: (key: string, grams: string) => void;
}) {
  if (!selectedSource) {
    return (
      <div className="rounded-md border border-border/60 border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        Choose a food, meal, or selected-plan entry to review grams and macros before logging.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border/60 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Review {selectedSource.title}</p>
        {"subtitle" in selectedSource && selectedSource.subtitle ? (
          <p className="text-xs text-muted-foreground">Template: {selectedSource.subtitle}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{previewSummary}</p>
      </div>

      {draftItems.length === 0 ? (
        <p className="rounded-md border border-border/60 border-dashed px-3 py-4 text-sm text-muted-foreground">
          This meal has no ingredients to log.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/60">
          <ul className="divide-y divide-border/50">
            {draftItems.map((item) => {
              const parsedGrams = parseMacroInput(item.grams);
              const itemTotals = intakeDraftMacroTotals([
                { food: item.food, grams: parsedGrams ?? 0 },
              ]);
              return (
                <li
                  key={item.key}
                  className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{item.food.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {macroTotalsSummary(itemTotals)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`log-intake-grams-${item.key}`} className="text-xs">
                      Grams
                    </Label>
                    <Input
                      id={`log-intake-grams-${item.key}`}
                      type="text"
                      inputMode="decimal"
                      pattern={DECIMAL_INPUT_PATTERN}
                      value={item.grams}
                      onChange={(event) => onGramsChange(item.key, event.target.value)}
                      disabled={disabled}
                      aria-label={`Grams for ${item.food.name}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function resolveSelectedSource({
  mode,
  foodId,
  mealId,
  planSourceKey,
  foods,
  meals,
  planEntries,
  initialPlanEntry,
}: {
  mode: DialogMode;
  foodId: string;
  mealId: string;
  planSourceKey: string;
  foods: FoodPickerOption[];
  meals: LogMealOption[];
  planEntries: PlanEntry[];
  initialPlanEntry: PlanEntry | null;
}): SelectedSource | null {
  if (mode === "food") {
    const food = foods.find((candidate) => candidate.id === foodId);
    return food
      ? {
          kind: "food",
          key: `food:${food.id}`,
          title: food.name,
          food,
          nutritionPlanFoodId: null,
        }
      : null;
  }

  if (mode === "ad-hoc") {
    return null;
  }

  if (mode === "meal") {
    const meal = meals.find((candidate) => candidate.id === mealId);
    return meal
      ? {
          kind: "meal",
          key: `meal:${meal.id}`,
          title: meal.name,
          meal,
          nutritionPlanMealId: null,
        }
      : null;
  }

  const planEntry =
    planEntries.find((entry) => sourceKeyForPlanEntry(entry) === planSourceKey) ??
    (initialPlanEntry && sourceKeyForPlanEntry(initialPlanEntry) === planSourceKey
      ? initialPlanEntry
      : null);
  if (!planEntry) {
    return null;
  }

  if (planEntry.kind === "food") {
    return {
      kind: "plan-food",
      key: sourceKeyForPlanEntry(planEntry),
      title: planEntry.food.name,
      subtitle: null,
      plannedSlotTime: planEntry.slotTime,
      food: planEntry.food,
      grams: planEntry.grams,
      nutritionPlanFoodId: planEntry.id,
    };
  }

  return {
    kind: "plan-meal",
    key: sourceKeyForPlanEntry(planEntry),
    title: planEntry.label || planEntry.meal.name,
    subtitle: planEntry.label ? planEntry.meal.name : null,
    plannedSlotTime: planEntry.slotTime,
    meal: planEntry.meal,
    nutritionPlanMealId: planEntry.id,
  };
}

function materializeDraftItems(source: SelectedSource): DraftItem[] {
  if (source.kind === "food") {
    return [{ key: `food:${source.food.id}`, food: source.food, grams: "100" }];
  }
  if (source.kind === "plan-food") {
    return [
      {
        key: `plan-food:${source.nutritionPlanFoodId}`,
        food: source.food,
        grams: String(source.grams),
      },
    ];
  }

  return source.meal.mealIngredients
    .toSorted((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .map((ingredient) => ({
      key: ingredient.id,
      food: ingredient.food,
      grams: String(ingredient.grams),
    }));
}

function validateDraftItems(items: DraftItem[]): { valid: boolean; message: string } {
  if (items.length === 0) {
    return { valid: false, message: "Choose an item with at least one food to log." };
  }
  for (const item of items) {
    const grams = parseMacroInput(item.grams);
    if (grams === null || grams <= 0) {
      return { valid: false, message: `Enter grams greater than zero for ${item.food.name}.` };
    }
  }
  return { valid: true, message: "" };
}

function sourceKeyForInitial(source: LogIntakeInitialSource): string {
  return source.kind === "plan-meal"
    ? `plan-meal:${source.slot.id}`
    : `plan-food:${source.slot.id}`;
}

function sourceKeyForPlanEntry(entry: PlanEntry): string {
  return entry.kind === "meal" ? `plan-meal:${entry.id}` : `plan-food:${entry.id}`;
}

function planEntryForInitial(source: LogIntakeInitialSource): PlanEntry {
  if (source.kind === "plan-meal") {
    return { ...source.slot, kind: "meal" };
  }
  return { ...source.slot, kind: "food" };
}

function mergeInitialPlanEntry(entries: PlanEntry[], initialEntry: PlanEntry): PlanEntry[] {
  if (
    entries.some((entry) => sourceKeyForPlanEntry(entry) === sourceKeyForPlanEntry(initialEntry))
  ) {
    return entries;
  }
  return [initialEntry, ...entries];
}

function planEntrySearchText(entry: PlanEntry): string {
  const parts = [entry.label, timeToInputValue(entry.slotTime), formatTimeOfDay(entry.slotTime)];
  if (entry.kind === "meal") {
    parts.push(entry.meal.name, entry.meal.description ?? null);
  } else {
    parts.push(entry.food.name);
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}
