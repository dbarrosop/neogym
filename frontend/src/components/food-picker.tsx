import { Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Check, Globe2, Plus, Search, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MacroFields } from "@/lib/nutrition";
import { macroSummary } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export interface FoodPickerOption extends MacroFields {
  id: string;
  name: string;
  isPublic: boolean;
  userId?: string | null;
}

interface FoodPickerProps {
  foods: FoodPickerOption[];
  value: string;
  onChange: (foodId: string) => void;
  disabled?: boolean;
}

export function FoodPicker({ foods, value, onChange, disabled }: FoodPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedFood = foods.find((food) => food.id === value) ?? null;

  useEffect(() => {
    if (!open) {
      setQuery(selectedFood?.name ?? "");
    }
  }, [open, selectedFood]);

  const fuse = useMemo(
    () =>
      new Fuse(foods, {
        keys: ["name"],
        ignoreLocation: true,
        threshold: 0.35,
      }),
    [foods],
  );

  const visibleFoods = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return foods;
    }
    return fuse.search(trimmed).map((match) => match.item);
  }, [foods, fuse, query]);

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    if (selectedFood && nextQuery !== selectedFood.name) {
      onChange("");
    }
  }

  function handleSelect(food: FoodPickerOption) {
    onChange(food.id);
    setQuery(food.name);
    setOpen(false);
  }

  function handleBlur() {
    window.setTimeout(() => {
      setOpen(false);
      setQuery(selectedFood?.name ?? "");
    }, 100);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onBlur={handleBlur}
        onChange={(event) => handleQueryChange(event.target.value)}
        placeholder="Search own and public foods…"
        className="pr-9 pl-9"
        disabled={disabled}
      />
      {query ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleQueryChange("")}
          className="absolute top-1/2 right-2.5 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear food search"
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open && !disabled ? (
        <Card className="absolute top-full right-0 left-0 z-30 mt-2 border-border/60 bg-popover shadow-lg">
          <CardContent className="max-h-64 overflow-y-auto p-1">
            {foods.length === 0 ? (
              <div className="space-y-3 px-3 py-5 text-center text-sm text-muted-foreground">
                <p>No foods are available yet. Create a private food first.</p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/nutrition/foods/new">
                    <Plus className="h-4 w-4" />
                    New food
                  </Link>
                </Button>
              </div>
            ) : null}

            {foods.length > 0 && visibleFoods.length === 0 ? (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                No foods match this search.
              </p>
            ) : null}

            <ul className="space-y-1">
              {visibleFoods.map((food) => {
                const isSelected = food.id === value;
                return (
                  <li key={food.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(food)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50",
                        isSelected && "bg-primary/10 text-primary hover:bg-primary/15",
                      )}
                    >
                      <span className="min-w-0 space-y-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">{food.name}</span>
                          {food.isPublic ? (
                            <Badge variant="primary" className="shrink-0 px-1.5 py-0">
                              <Globe2 className="h-2.5 w-2.5" /> Public
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 px-1.5 py-0">
                              <User className="h-2.5 w-2.5" /> Mine
                            </Badge>
                          )}
                        </span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {macroSummary(food)} per 100g
                        </span>
                      </span>
                      {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
