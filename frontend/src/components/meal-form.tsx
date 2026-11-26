import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, type LucideIcon, Plus, X } from "lucide-react";
import { type ReactNode, type SubmitEvent, useId, useMemo, useState } from "react";
import { FoodPicker, type FoodPickerOption } from "@/components/food-picker";
import { MacroSummary } from "@/components/macro-summary";
import { FormActions } from "@/components/patterns/form-actions";
import { FormPageAside } from "@/components/patterns/form-page";
import { ErrorState } from "@/components/patterns/query-states";
import { QuickFoodDialog } from "@/components/quick-food-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { graphql } from "@/gql";
import { useFormPageSlots } from "@/lib/form-page-context";
import { gqlRequest } from "@/lib/graphql";
import { formatIngredientKcal, placeFoodInRows } from "@/lib/meal-template";
import { DECIMAL_INPUT_PATTERN, mealMacroTotals, parseMacroInput } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const MealFormFoodsQuery = graphql(`
  query MealFormFoods {
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

export interface MealFormIngredientValues {
  id?: string;
  foodId: string;
  grams: number;
  position: number;
}

export interface MealFormValues {
  name: string;
  description: string;
  ingredients: MealFormIngredientValues[];
}

interface MealFormProps {
  initialValues: MealFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  submitDisabled?: boolean;
  onSubmit: (values: MealFormValues) => void;
  onCancel: () => void;
  extraActions?: ReactNode;
}

type IngredientDraft = {
  clientId: string;
  id?: string;
  foodId: string;
  grams: string;
};

const DEFAULT_GRAMS = "100";
let nextIngredientId = 0;

function createClientId() {
  nextIngredientId += 1;
  return `ingredient-${Date.now()}-${nextIngredientId}`;
}

function newIngredient(foodId: string): IngredientDraft {
  return { clientId: createClientId(), foodId, grams: DEFAULT_GRAMS };
}

function numberToInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function initialDrafts(values: MealFormValues): IngredientDraft[] {
  return values.ingredients
    .toSorted((a, b) => a.position - b.position)
    .map((ingredient) => {
      const draft: IngredientDraft = {
        clientId: ingredient.id ?? createClientId(),
        foodId: ingredient.foodId,
        grams: numberToInput(ingredient.grams),
      };
      if (ingredient.id) {
        draft.id = ingredient.id;
      }
      return draft;
    });
}

function mergeFoodOptions(baseFoods: FoodPickerOption[], localFoods: FoodPickerOption[]) {
  const byId = new Map<string, FoodPickerOption>();
  for (const food of baseFoods) {
    byId.set(food.id, food);
  }
  for (const food of localFoods) {
    byId.set(food.id, food);
  }
  return Array.from(byId.values()).toSorted(
    (left, right) =>
      Number(left.isPublic) - Number(right.isPublic) || left.name.localeCompare(right.name),
  );
}

/** Ingredient rows in order, with add, edit, move and remove. */
function useIngredientDrafts(initialValues: MealFormValues) {
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    initialDrafts(initialValues),
  );

  function update(clientId: string, patch: Partial<IngredientDraft>) {
    setIngredients((current) =>
      current.map((ingredient) =>
        ingredient.clientId === clientId ? { ...ingredient, ...patch } : ingredient,
      ),
    );
  }

  function move(clientId: string, direction: -1 | 1) {
    setIngredients((current) => {
      const index = current.findIndex((ingredient) => ingredient.clientId === clientId);
      const target = index + direction;
      const item = current[index];
      if (!item || target < 0 || target >= current.length) {
        return current;
      }
      const next = current.toSpliced(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  return {
    ingredients,
    add: () => setIngredients((current) => [...current, newIngredient("")]),
    /** A just-created food fills the first row without a food, or gets a new row. */
    placeFood: (foodId: string) =>
      setIngredients((current) => placeFoodInRows(current, foodId, newIngredient)),
    update,
    move,
    remove: (clientId: string) =>
      setIngredients((current) => current.filter((ingredient) => ingredient.clientId !== clientId)),
  };
}

/**
 * Meal template editor (Web-MealEditor): a details card, the ingredients card
 * with compact rows, and live totals that a form page shows in its sticky
 * side column. Inside a dialog everything stacks in place.
 */
export function MealForm({
  initialValues,
  submitLabel,
  isSubmitting,
  submitDisabled = false,
  onSubmit,
  onCancel,
  extraActions,
}: MealFormProps) {
  const page = useFormPageSlots();
  const errorId = useId();
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description);
  const drafts = useIngredientDrafts(initialValues);
  const { ingredients } = drafts;
  const [submitted, setSubmitted] = useState(false);
  const [localFoods, setLocalFoods] = useState<FoodPickerOption[]>([]);
  const [creatingFood, setCreatingFood] = useState(false);

  const foodsQuery = useQuery({
    queryKey: ["nutrition", "foods", "picker"],
    queryFn: () => gqlRequest(MealFormFoodsQuery),
  });
  const isLoading = foodsQuery.isLoading;

  const foods = useMemo<FoodPickerOption[]>(
    () => mergeFoodOptions(foodsQuery.data?.foods ?? [], localFoods),
    [foodsQuery.data, localFoods],
  );
  const foodsById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);

  const totals = useMemo(
    () =>
      mealMacroTotals(
        ingredients.map((ingredient) => ({
          grams: ingredient.grams,
          food: foodsById.get(ingredient.foodId) ?? null,
        })),
      ),
    [foodsById, ingredients],
  );

  const parsedIngredients = ingredients.map((ingredient, index) => ({
    ...ingredient,
    parsedGrams: parseMacroInput(ingredient.grams),
    position: index,
  }));

  const trimmedName = name.trim();
  const hasMissingFood = parsedIngredients.some(
    (ingredient) => !ingredient.foodId || !foodsById.has(ingredient.foodId),
  );
  const hasInvalidGrams = parsedIngredients.some(
    (ingredient) => ingredient.parsedGrams === null || ingredient.parsedGrams <= 0,
  );
  const nameError = submitted && trimmedName.length === 0 ? "Name is required." : null;
  const ingredientsError =
    submitted && ingredients.length === 0 ? "Add at least one food to this meal." : null;
  const missingFoodError =
    submitted && hasMissingFood ? "Every ingredient needs a selected food." : null;
  const gramsError =
    submitted && hasInvalidGrams ? "Ingredient grams must be greater than zero." : null;
  const formError = nameError ?? ingredientsError ?? missingFoodError ?? gramsError ?? null;
  const canSubmit = !isSubmitting && !isLoading && !submitDisabled;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit || trimmedName.length === 0 || ingredients.length === 0) {
      return;
    }
    if (hasMissingFood || hasInvalidGrams) {
      return;
    }
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      ingredients: parsedIngredients.map((ingredient) => {
        const values: MealFormIngredientValues = {
          foodId: ingredient.foodId,
          grams: ingredient.parsedGrams ?? 0,
          position: ingredient.position,
        };
        if (ingredient.id) {
          values.id = ingredient.id;
        }
        return values;
      }),
    });
  }

  return (
    <>
      <form id={page?.formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
        <MealDetailsFields
          onPage={page !== null}
          name={name}
          description={description}
          nameInvalid={Boolean(nameError)}
          errorId={formError ? errorId : undefined}
          onNameChange={setName}
          onDescriptionChange={setDescription}
        />
        <IngredientsSection
          onPage={page !== null}
          ingredients={ingredients}
          foods={foods}
          foodsById={foodsById}
          foodsState={foodsQuery}
          isSubmitting={isSubmitting}
          showErrors={submitted}
          errorId={formError ? errorId : undefined}
          onAdd={drafts.add}
          onNewFood={() => setCreatingFood(true)}
          onUpdate={drafts.update}
          onMove={drafts.move}
          onRemove={drafts.remove}
        />
        {formError ? (
          <p id={errorId} role="alert" className="text-[13px] text-destructive">
            {formError}
          </p>
        ) : null}
        <FormPageAside>
          <MacroSummary
            variant="aside"
            title="Live meal totals"
            description="Computed from current food values and ingredient grams."
            totals={totals}
          />
        </FormPageAside>
        <FormActions
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          submitDisabled={isLoading || submitDisabled}
          onCancel={onCancel}
          extraActions={extraActions}
          className="border-border border-t pt-4"
        />
      </form>
      {creatingFood ? (
        <QuickFoodDialog
          open={true}
          mode={{ kind: "create" }}
          onOpenChange={(open) => {
            if (!open) {
              setCreatingFood(false);
            }
          }}
          onSaved={(food) => {
            setLocalFoods((current) => mergeFoodOptions(current, [food]));
            drafts.placeFood(food.id);
          }}
        />
      ) : null}
    </>
  );
}

const CARD = "rounded-xl border bg-card";

function MealDetailsFields({
  onPage,
  name,
  description,
  nameInvalid,
  errorId,
  onNameChange,
  onDescriptionChange,
}: {
  onPage: boolean;
  name: string;
  description: string;
  nameInvalid: boolean;
  errorId: string | undefined;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  const nameId = useId();
  const descriptionId = useId();
  return (
    <div className={cn("flex flex-col gap-4", onPage && cn(CARD, "p-5"))}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>Meal name</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g. Breakfast bowl"
          maxLength={160}
          aria-invalid={nameInvalid}
          aria-describedby={nameInvalid ? errorId : undefined}
          autoFocus
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={descriptionId} className="gap-1.5">
          Description
          <span className="font-medium text-muted-foreground">Optional</span>
        </Label>
        <Textarea
          id={descriptionId}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Prep notes, serving idea, or anything useful for reuse."
          maxLength={1000}
          rows={2}
        />
      </div>
    </div>
  );
}

interface IngredientsSectionProps {
  onPage: boolean;
  ingredients: IngredientDraft[];
  foods: FoodPickerOption[];
  foodsById: Map<string, FoodPickerOption>;
  foodsState: {
    isLoading: boolean;
    error: Error | null;
    refetch: () => unknown;
    isFetching: boolean;
  };
  isSubmitting: boolean;
  showErrors: boolean;
  errorId: string | undefined;
  onAdd: () => void;
  onNewFood: () => void;
  onUpdate: (clientId: string, patch: Partial<IngredientDraft>) => void;
  onMove: (clientId: string, direction: -1 | 1) => void;
  onRemove: (clientId: string) => void;
}

/** "Ingredients · N": compact rows, then Add food / New private food. */
function IngredientsSection(props: IngredientsSectionProps) {
  const { ingredients, foodsState, isSubmitting } = props;
  const headingId = useId();
  const Heading = props.onPage ? "h2" : "h3";
  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={props.errorId}
      className={cn("@container min-w-0", CARD)}
    >
      <div className="px-4 py-3.5">
        <Heading id={headingId} className="text-[15px] font-semibold">
          Ingredients{" "}
          <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
            · {ingredients.length}
          </span>
        </Heading>
      </div>
      {foodsState.error ? (
        <div className="border-t p-4">
          <ErrorState
            title="Couldn’t load foods"
            message={foodsState.error.message}
            onRetry={() => foodsState.refetch()}
            isRetrying={foodsState.isFetching}
          />
        </div>
      ) : null}
      {foodsState.isLoading ? <IngredientRowsSkeleton /> : null}
      {!foodsState.isLoading && ingredients.length === 0 ? (
        <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
          No ingredients yet. Add a food to build this meal.
        </p>
      ) : null}
      {foodsState.isLoading || ingredients.length === 0 ? null : (
        <ul>
          {ingredients.map((ingredient, index) => (
            <IngredientRow
              key={ingredient.clientId}
              ingredient={ingredient}
              index={index}
              count={ingredients.length}
              foods={props.foods}
              food={props.foodsById.get(ingredient.foodId) ?? null}
              disabled={isSubmitting}
              showErrors={props.showErrors}
              onUpdate={props.onUpdate}
              onMove={props.onMove}
              onRemove={props.onRemove}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <Button
          type="button"
          variant="outline"
          onClick={props.onAdd}
          disabled={foodsState.isLoading || isSubmitting}
        >
          <Plus />
          Add food
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-link hover:text-link"
          onClick={props.onNewFood}
          disabled={isSubmitting}
        >
          New private food
        </Button>
        <p className="ml-auto text-[13px] text-muted-foreground">
          Public foods are read-only here.
        </p>
      </div>
    </section>
  );
}

function IngredientRow({
  ingredient,
  index,
  count,
  foods,
  food,
  disabled,
  showErrors,
  onUpdate,
  onMove,
  onRemove,
}: {
  ingredient: IngredientDraft;
  index: number;
  count: number;
  foods: FoodPickerOption[];
  food: FoodPickerOption | null;
  disabled: boolean;
  showErrors: boolean;
  onUpdate: (clientId: string, patch: Partial<IngredientDraft>) => void;
  onMove: (clientId: string, direction: -1 | 1) => void;
  onRemove: (clientId: string) => void;
}) {
  const itemName = food?.name ?? `ingredient ${index + 1}`;
  const grams = parseMacroInput(ingredient.grams);
  const { clientId } = ingredient;
  return (
    <li
      className={cn(
        "grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-2.5 border-t py-2.5 pr-3 pl-4",
        "@xl:min-h-14 @xl:grid-cols-[minmax(0,1fr)_120px_80px_112px] @xl:py-2",
      )}
    >
      <FoodPicker
        mode="select"
        aria-label={`Food for ingredient ${index + 1}`}
        aria-invalid={showErrors && !food}
        foods={foods}
        value={ingredient.foodId}
        onChange={(foodId) => onUpdate(clientId, { foodId })}
        disabled={disabled}
        className="col-span-3 @xl:col-span-1"
      />
      <div className="flex items-center gap-1.5">
        <Input
          type="text"
          inputMode="decimal"
          pattern={DECIMAL_INPUT_PATTERN}
          aria-label={`Grams of ${itemName}`}
          aria-invalid={showErrors && (grams === null || grams <= 0)}
          value={ingredient.grams}
          onChange={(event) => onUpdate(clientId, { grams: event.target.value })}
          disabled={disabled}
          className="text-right tabular-nums"
          required
        />
        <span aria-hidden="true" className="text-[13px] text-muted-foreground">
          g
        </span>
      </div>
      <p className="text-right text-sm font-semibold whitespace-nowrap tabular-nums">
        {formatIngredientKcal(food, ingredient.grams)}
      </p>
      <div className="flex justify-end">
        <RowIconButton
          icon={ChevronUp}
          label={`Move ${itemName} up`}
          disabled={disabled || index === 0}
          onClick={() => onMove(clientId, -1)}
        />
        <RowIconButton
          icon={ChevronDown}
          label={`Move ${itemName} down`}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(clientId, 1)}
        />
        <RowIconButton
          icon={X}
          label={`Remove ${itemName}`}
          disabled={disabled}
          onClick={() => onRemove(clientId)}
        />
      </div>
    </li>
  );
}

/** Neutral 36 px row action (board `.ic`), named after the ingredient it acts on. */
function RowIconButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground"
    >
      <Icon />
    </Button>
  );
}

function IngredientRowsSkeleton() {
  return (
    <div className="border-t" role="status" aria-busy="true" aria-label="Loading foods">
      {[0, 1].map((row) => (
        <div key={row} className="flex items-center gap-2.5 border-b px-4 py-2.5 last:border-b-0">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
