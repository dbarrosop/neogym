import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { currentTimeInputValue, parseMacroInput } from "@/lib/nutrition";

const LogFoodMutation = graphql(`
  mutation LogFood($object: nutritionLogEntries_insert_input!) {
    insertNutritionLogEntry(object: $object) {
      id
    }
  }
`);

interface LogFoodDialogProps {
  ensureDay: () => Promise<string>;
  date: string;
  foods: FoodPickerOption[];
  nextPosition: number;
  disabled?: boolean;
}

export function LogFoodDialog({
  ensureDay,
  date,
  foods,
  nextPosition,
  disabled,
}: LogFoodDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [foodId, setFoodId] = useState("");
  const [grams, setGrams] = useState("100");
  const [slotTime, setSlotTime] = useState(() => currentTimeInputValue());

  const selectedFood = foods.find((food) => food.id === foodId) ?? null;

  useEffect(() => {
    if (open) {
      setSlotTime(currentTimeInputValue());
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedGrams = parseMacroInput(grams);
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
          grams: parsedGrams,
          position: nextPosition,
          slotTime,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", date] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days", "index"] });
      toast.success("Food logged");
      setOpen(false);
      setFoodId("");
      setGrams("100");
      setSlotTime(currentTimeInputValue());
    },
    onError: (error) => {
      toast.error(`Failed to log food: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          <Plus className="h-4 w-4" />
          Log food
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log a food</DialogTitle>
          <DialogDescription>
            Add a standalone food entry. The database snapshots the food nutrition when it is
            logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FoodPicker
            foods={foods}
            value={foodId}
            onChange={setFoodId}
            disabled={mutation.isPending}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="log-food-time">Time eaten</Label>
              <Input
                id="log-food-time"
                type="time"
                value={slotTime}
                onChange={(event) => setSlotTime(event.target.value)}
                disabled={mutation.isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-food-grams">Grams consumed</Label>
              <Input
                id="log-food-grams"
                value={grams}
                onChange={(event) => setGrams(event.target.value)}
                inputMode="decimal"
                placeholder="100"
                disabled={mutation.isPending}
              />
            </div>
          </div>
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
            {mutation.isPending ? "Logging…" : "Log food"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
