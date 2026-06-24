import { Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Check, ChefHat, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MealTotalIngredient } from "@/lib/nutrition";
import { macroTotalsSummary, mealMacroTotals } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export interface MealPickerOption {
  id: string;
  name: string;
  description?: string | null;
  mealIngredients: MealTotalIngredient[];
}

interface MealPickerProps {
  meals: MealPickerOption[];
  value: string;
  onChange: (mealId: string) => void;
  disabled?: boolean;
}

export function MealPicker({ meals, value, onChange, disabled }: MealPickerProps) {
  const [search, setSearch] = useState("");
  const selectedMeal = meals.find((meal) => meal.id === value) ?? null;

  const fuse = useMemo(
    () =>
      new Fuse(meals, {
        keys: ["name", "description", "mealIngredients.food.name"],
        ignoreLocation: true,
        threshold: 0.35,
      }),
    [meals],
  );

  const visibleMeals = useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      return meals;
    }
    return fuse.search(trimmed).map((match) => match.item);
  }, [fuse, meals, search]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={selectedMeal ? selectedMeal.name : "Search your meals…"}
          className="pr-9 pl-9"
          disabled={disabled}
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear meal search"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <Card className="border-border/60 bg-background/60">
        <CardContent className="max-h-72 overflow-y-auto p-1">
          {meals.length === 0 ? (
            <div className="space-y-3 px-3 py-5 text-center text-sm text-muted-foreground">
              <p>No meal templates are available yet. Create a private meal first.</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/nutrition/meals/new">
                  <Plus className="h-4 w-4" />
                  New meal
                </Link>
              </Button>
            </div>
          ) : null}

          {meals.length > 0 && visibleMeals.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-muted-foreground">
              No meals match this search.
            </p>
          ) : null}

          <ul className="space-y-1">
            {visibleMeals.map((meal) => {
              const isSelected = meal.id === value;
              const totals = mealMacroTotals(meal.mealIngredients);
              return (
                <li key={meal.id}>
                  <button
                    type="button"
                    onClick={() => onChange(meal.id)}
                    disabled={disabled}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-60",
                      isSelected && "bg-primary/10 text-primary hover:bg-primary/15",
                    )}
                  >
                    <span className="min-w-0 space-y-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <ChefHat className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-sm font-medium">{meal.name}</span>
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {meal.mealIngredients.length} ingredient
                        {meal.mealIngredients.length === 1 ? "" : "s"} ·{" "}
                        {macroTotalsSummary(totals)}
                      </span>
                      {meal.description ? (
                        <span className="line-clamp-1 text-xs text-muted-foreground/80">
                          {meal.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
