import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import {
  type PickerAccessibilityProps,
  PickerCombobox,
  PickerEmpty,
  type PickerMode,
  type PickerText,
} from "@/components/food-picker";
import type { MacroFields, MealTotalIngredient } from "@/lib/nutrition";
import { macroTotalsSummary, mealMacroTotals } from "@/lib/nutrition";

export interface MealPickerFood extends MacroFields {
  id: string;
  name: string;
}

export interface MealPickerIngredient extends MealTotalIngredient {
  id: string;
  position: number;
  food: MealPickerFood;
}

export interface MealPickerOption {
  id: string;
  name: string;
  description?: string | null;
  mealIngredients: MealPickerIngredient[];
}

interface MealPickerProps extends PickerAccessibilityProps {
  meals: MealPickerOption[];
  value: string;
  onChange: (mealId: string) => void;
  disabled?: boolean;
  /** See `PickerMode` in food-picker: inline search (default) or select-like trigger. */
  mode?: PickerMode;
  className?: string;
}

const MEAL_FUSE_KEYS = ["name", "description", "mealIngredients.food.name"];

const MEAL_PICKER_TEXT: PickerText = {
  name: "Meal",
  list: "Meals",
  search: "Search meals",
  searchPlaceholder: "Search your meals…",
  selectPlaceholder: "Choose a meal",
  clear: "Clear meal search",
  noMatch: "No meals match this search.",
};

export function MealPicker({ meals, ...props }: MealPickerProps) {
  return (
    <PickerCombobox
      {...props}
      items={meals}
      fuseKeys={MEAL_FUSE_KEYS}
      text={MEAL_PICKER_TEXT}
      empty={
        <PickerEmpty
          message="No meal templates are available yet. Create a private meal first."
          action={
            <Link to="/nutrition/meals/new">
              <Plus className="h-4 w-4" />
              New meal
            </Link>
          }
        />
      }
      renderOption={(meal) => {
        const count = meal.mealIngredients.length;
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{meal.name}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {count} ingredient{count === 1 ? "" : "s"} ·{" "}
              {macroTotalsSummary(mealMacroTotals(meal.mealIngredients))}
            </span>
            {meal.description ? (
              <span className="line-clamp-1 text-xs text-muted-foreground">{meal.description}</span>
            ) : null}
          </span>
        );
      }}
    />
  );
}
