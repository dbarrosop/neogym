import { describe, expect, it } from "bun:test";
import { foodFormValuesFromOption, isEditablePrivateFood } from "@/components/quick-food-dialog";
import { __testing as quickMealTesting } from "@/components/quick-meal-dialog";

describe("quick nutrition composition helpers", () => {
  it("keeps public foods read-only and private foods editable", () => {
    expect(
      isEditablePrivateFood({
        id: "food-public",
        name: "Public oats",
        isPublic: true,
        kcalPer100g: 1,
        fatPer100g: 2,
        carbsPer100g: 3,
        proteinPer100g: 4,
        fiberPer100g: 5,
        sugarPer100g: 6,
      }),
    ).toBe(false);

    expect(
      isEditablePrivateFood({
        id: "food-private",
        name: "Private oats",
        isPublic: false,
        userId: "user-1",
        kcalPer100g: 1,
        fatPer100g: 2,
        carbsPer100g: 3,
        proteinPer100g: 4,
        fiberPer100g: 5,
        sugarPer100g: 6,
      }),
    ).toBe(true);
  });

  it("normalizes food picker macros for the inline food form", () => {
    expect(
      foodFormValuesFromOption({
        id: "food-private",
        name: "Private yogurt",
        isPublic: false,
        kcalPer100g: "64.5",
        fatPer100g: "0,4",
        carbsPer100g: null,
        proteinPer100g: 10,
        fiberPer100g: undefined,
        sugarPer100g: "3",
      }),
    ).toEqual({
      name: "Private yogurt",
      kcalPer100g: 64.5,
      fatPer100g: 0.4,
      carbsPer100g: 0,
      proteinPer100g: 10,
      fiberPer100g: 0,
      sugarPer100g: 3,
    });
  });

  it("diffs inline meal edits without updating immutable source foods", () => {
    const diff = quickMealTesting.buildInlineMealSaveVariables(
      "meal-1",
      {
        name: "Breakfast",
        description: "",
        ingredients: [
          { id: "ingredient-a", foodId: "food-a", grams: 100, position: 0 },
          { id: "ingredient-b", foodId: "food-b", grams: 50, position: 1 },
        ],
      },
      {
        name: "Breakfast",
        description: "",
        ingredients: [
          { id: "ingredient-b", foodId: "food-c", grams: 75, position: 0 },
          { id: "ingredient-a", foodId: "food-a", grams: 125, position: 1 },
          { foodId: "food-d", grams: 20, position: 2 },
        ],
      },
    );

    expect(diff.deleteIngredientIds).toEqual(["ingredient-b"]);
    expect(diff.insertIngredients).toEqual([
      { mealId: "meal-1", foodId: "food-c", grams: 75, position: 0 },
      { mealId: "meal-1", foodId: "food-d", grams: 20, position: 2 },
    ]);
    expect(diff.ingredientUpdates).toEqual([
      {
        where: { id: { _eq: "ingredient-a" } },
        _set: { grams: 125, position: 1 },
      },
    ]);
  });
});
