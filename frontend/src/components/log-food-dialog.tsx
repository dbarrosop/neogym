import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Apple, Clock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FoodPicker, type FoodPickerOption } from "@/components/food-picker";
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
  DECIMAL_INPUT_PATTERN,
  formatTimeOfDay,
  macrosForGrams,
  macroTotalsSummary,
  parseMacroInput,
} from "@/lib/nutrition";

const LogFoodMutation = graphql(`
  mutation LogFood($object: nutritionLogEntries_insert_input!) {
    insertNutritionLogEntry(object: $object) {
      id
    }
  }
`);

export interface LogPlanFoodSlot {
  id: string;
  slotTime: string;
  label?: string | null;
  position: number;
  grams: unknown;
  food: FoodPickerOption;
}

interface LogFoodDialogProps {
  ensureDay: () => Promise<string>;
  date: string;
  foods: FoodPickerOption[];
  nextPosition: number;
  slot?: LogPlanFoodSlot;
  disabled?: boolean;
}

export function LogFoodDialog({
  ensureDay,
  date,
  foods,
  nextPosition,
  slot,
  disabled,
}: LogFoodDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [foodId, setFoodId] = useState(slot?.food.id ?? "");
  const [grams, setGrams] = useState(String(slot?.grams ?? 100));
  const [slotTime, setSlotTime] = useState(() => currentTimeInputValue());

  const selectedFood = slot?.food ?? foods.find((food) => food.id === foodId) ?? null;
  const parsedGrams = parseMacroInput(grams);
  const previewTotals =
    selectedFood && parsedGrams !== null && parsedGrams > 0
      ? macrosForGrams(selectedFood, parsedGrams)
      : null;

  useEffect(() => {
    if (open) {
      setSlotTime(currentTimeInputValue());
      if (slot) {
        setFoodId(slot.food.id);
        setGrams(String(slot.grams));
      }
    }
  }, [open, slot]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedFood || parsedGrams === null || parsedGrams <= 0) {
        throw new Error("Choose a food and enter grams greater than zero.");
      }
      if (!slotTime) {
        throw new Error("Choose the time eaten.");
      }
      const dayId = await ensureDay();
      return gqlRequest(LogFoodMutation, {
        object: {
          nutritionDayId: dayId,
          foodId: selectedFood.id,
          nutritionPlanFoodId: slot?.id ?? null,
          grams: parsedGrams,
          position: nextPosition,
          slotTime,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
      toast.success(slot ? "Planned food logged" : "Food logged");
      setOpen(false);
      if (!slot) {
        setFoodId("");
        setGrams("100");
      }
      setSlotTime(currentTimeInputValue());
    },
    onError: (error) => {
      toast.error(`Failed to log food: ${error.message}`);
    },
  });

  const triggerLabel = slot ? "Log" : "Log food";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={slot ? "default" : "outline"} disabled={disabled}>
          {slot ? <Apple className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{slot ? "Log planned food" : "Log a food"}</DialogTitle>
          <DialogDescription>
            Add a standalone food entry. The database snapshots the food nutrition when it is
            logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {slot ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Planned {formatTimeOfDay(slot.slotTime)} · {slot.label || slot.food.name}
              </p>
              {slot.label ? (
                <p className="text-xs text-muted-foreground">Template food: {slot.food.name}</p>
              ) : null}
            </div>
          ) : (
            <FoodPicker
              foods={foods}
              value={foodId}
              onChange={setFoodId}
              disabled={mutation.isPending}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={slot ? `log-plan-food-time-${slot.id}` : "log-food-time"}>
                Time eaten
              </Label>
              <Input
                id={slot ? `log-plan-food-time-${slot.id}` : "log-food-time"}
                type="time"
                value={slotTime}
                onChange={(event) => setSlotTime(event.target.value)}
                disabled={mutation.isPending}
                required
              />
              <p className="text-xs text-muted-foreground">
                Defaults to now. Planned times are suggestions only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={slot ? `log-plan-food-grams-${slot.id}` : "log-food-grams"}>
                Grams consumed
              </Label>
              <Input
                id={slot ? `log-plan-food-grams-${slot.id}` : "log-food-grams"}
                type="text"
                inputMode="decimal"
                pattern={DECIMAL_INPUT_PATTERN}
                value={grams}
                onChange={(event) => setGrams(event.target.value)}
                placeholder="100"
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {previewTotals ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{selectedFood?.name}</p>
              <p>{macroTotalsSummary(previewTotals)}</p>
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
