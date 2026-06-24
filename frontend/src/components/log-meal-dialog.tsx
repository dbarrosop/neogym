import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Clock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import {
  currentTimeInputValue,
  formatTimeOfDay,
  macroTotalsSummary,
  mealMacroTotals,
  normalizeNumeric,
} from "@/lib/nutrition";

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

interface LogMealDialogProps {
  dayId: string;
  date: string;
  meals: LogMealOption[];
  nextPosition: number;
  slot?: LogPlanSlot;
  disabled?: boolean;
}

export function LogMealDialog({
  dayId,
  date,
  meals,
  nextPosition,
  slot,
  disabled,
}: LogMealDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mealId, setMealId] = useState(slot?.meal.id ?? "");
  const [slotTime, setSlotTime] = useState(() => currentTimeInputValue());

  useEffect(() => {
    if (open) {
      setMealId(slot?.meal.id ?? "");
      setSlotTime(currentTimeInputValue());
    }
  }, [open, slot]);

  const selectedMeal = slot?.meal ?? meals.find((meal) => meal.id === mealId) ?? null;
  const totals = selectedMeal ? mealMacroTotals(selectedMeal.mealIngredients) : null;

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedMeal) {
        throw new Error("Choose a meal to log.");
      }
      if (selectedMeal.mealIngredients.length === 0) {
        throw new Error("This meal has no ingredients to log.");
      }
      if (!slotTime) {
        throw new Error("Choose the time eaten.");
      }

      return gqlRequest(LogMealMutation, {
        object: {
          nutritionDayId: dayId,
          mealId: selectedMeal.id,
          nutritionPlanMealId: slot?.id ?? null,
          name: slot?.label || selectedMeal.name,
          slotTime,
          position: nextPosition,
          nutritionLogEntries: {
            data: selectedMeal.mealIngredients.map((ingredient, index) => ({
              nutritionDayId: dayId,
              foodId: ingredient.food.id,
              grams: normalizeNumeric(ingredient.grams),
              position: index,
              slotTime,
            })),
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
      toast.success("Meal logged");
      setOpen(false);
      setMealId(slot?.meal.id ?? "");
    },
    onError: (error) => {
      toast.error(`Failed to log meal: ${error.message}`);
    },
  });

  const triggerLabel = slot ? "Log" : "Log meal";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={slot ? "default" : "outline"} disabled={disabled}>
          {slot ? <ChefHat className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{slot ? "Log planned meal" : "Log a meal"}</DialogTitle>
          <DialogDescription>
            Logging a meal materializes its ingredients into editable day entries. Source meal
            templates stay unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {slot ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Planned {formatTimeOfDay(slot.slotTime)} · {slot.label || slot.meal.name}
              </p>
              {slot.label ? (
                <p className="text-xs text-muted-foreground">Template: {slot.meal.name}</p>
              ) : null}
            </div>
          ) : (
            <MealPicker
              meals={meals}
              value={mealId}
              onChange={setMealId}
              disabled={mutation.isPending}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor={slot ? `log-meal-time-${slot.id}` : "log-meal-time"}>Time eaten</Label>
            <Input
              id={slot ? `log-meal-time-${slot.id}` : "log-meal-time"}
              type="time"
              value={slotTime}
              onChange={(event) => setSlotTime(event.target.value)}
              disabled={mutation.isPending}
              required
            />
            <p className="text-xs text-muted-foreground">
              Defaults to now. Planned meals keep their template slot as provenance, but the log
              uses this actual time.
            </p>
          </div>

          {selectedMeal && totals ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {selectedMeal.mealIngredients.length} ingredient
                {selectedMeal.mealIngredients.length === 1 ? "" : "s"}
              </p>
              <p>{macroTotalsSummary(totals)}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Logging…" : triggerLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
