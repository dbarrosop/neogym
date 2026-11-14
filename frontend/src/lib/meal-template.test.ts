import { describe, expect, it } from "bun:test";
import {
  buildMealIngredientDiff,
  formatIngredientKcal,
  ingredientKcal,
  mealDeleteBlockedReason,
  mealPlanNames,
  placeFoodInRows,
} from "@/lib/meal-template";

const chia = {
  kcalPer100g: "486.4",
  proteinPer100g: 17,
  carbsPer100g: 42,
  fatPer100g: 31,
  fiberPer100g: 34,
  sugarPer100g: 0,
};

describe("ingredientKcal", () => {
  it("scales the food's per-100 g energy by the row's grams", () => {
    expect(ingredientKcal(chia, "30")).toBeCloseTo(145.92, 6);
    expect(ingredientKcal(chia, 300)).toBeCloseTo(1459.2, 6);
    expect(ingredientKcal(chia, "12,5")).toBeCloseTo(60.8, 6);
    expect(ingredientKcal(chia, "0")).toBe(0);
  });

  it("is null while the row has no food or its grams don't parse", () => {
    expect(ingredientKcal(null, "30")).toBeNull();
    expect(ingredientKcal(undefined, 30)).toBeNull();
    expect(ingredientKcal(chia, "")).toBeNull();
    expect(ingredientKcal(chia, "abc")).toBeNull();
    expect(ingredientKcal(chia, "-5")).toBeNull();
    expect(ingredientKcal(chia, Number.NaN)).toBeNull();
  });

  it("formats whole kilocalories, or a dash for an incomplete row", () => {
    expect(formatIngredientKcal(chia, "30")).toBe("146 kcal");
    expect(formatIngredientKcal({ ...chia, kcalPer100g: 60 }, "3000")).toBe(
      `${(1800).toLocaleString()} kcal`,
    );
    expect(formatIngredientKcal(null, "30")).toBe("—");
    expect(formatIngredientKcal(chia, "")).toBe("—");
  });
});

describe("mealDeleteBlockedReason", () => {
  const maintenance = { id: "p1", name: "Maintenance ~2200" };
  const runDay = { id: "p2", name: "~2100 run day" };
  const restDay = { id: "p3", name: "~2100 rest day" };

  it("is null when no plan uses the meal", () => {
    expect(mealDeleteBlockedReason([])).toBeNull();
    expect(mealDeleteBlockedReason([{ nutritionPlan: null }])).toBeNull();
  });

  it("names each plan once, sorted by name", () => {
    const references = [
      { nutritionPlan: maintenance },
      { nutritionPlan: runDay },
      { nutritionPlan: maintenance },
      { nutritionPlan: restDay },
      { nutritionPlan: { id: "p4", name: "cut 10" } },
      { nutritionPlan: { id: "p5", name: "Cut 9" } },
    ];
    expect(mealPlanNames(references)).toEqual([
      "~2100 rest day",
      "~2100 run day",
      "Cut 9",
      "cut 10",
      "Maintenance ~2200",
    ]);
    expect(mealDeleteBlockedReason(references.slice(0, 4))).toBe(
      "Used in 3 plans (~2100 rest day, ~2100 run day, Maintenance ~2200). Remove it there first.",
    );
  });

  it("uses the singular for one plan, even with several slots in it", () => {
    expect(
      mealDeleteBlockedReason([{ nutritionPlan: maintenance }, { nutritionPlan: maintenance }]),
    ).toBe("Used in 1 plan (Maintenance ~2200). Remove it there first.");
  });
});

describe("placeFoodInRows", () => {
  const createRow = (foodId: string) => ({ key: "new", foodId, grams: "100" });

  it("fills the first row without a food", () => {
    const rows = [
      { key: "a", foodId: "oats", grams: "60" },
      { key: "b", foodId: "", grams: "50" },
      { key: "c", foodId: "", grams: "100" },
    ];
    expect(placeFoodInRows(rows, "skyr", createRow)).toEqual([
      { key: "a", foodId: "oats", grams: "60" },
      { key: "b", foodId: "skyr", grams: "50" },
      { key: "c", foodId: "", grams: "100" },
    ]);
  });

  it("appends a row when every row already has a food", () => {
    const rows = [{ key: "a", foodId: "oats", grams: "60" }];
    expect(placeFoodInRows(rows, "skyr", createRow)).toEqual([
      { key: "a", foodId: "oats", grams: "60" },
      { key: "new", foodId: "skyr", grams: "100" },
    ]);
    expect(placeFoodInRows([], "skyr", createRow)).toEqual([createRow("skyr")]);
  });
});

describe("buildMealIngredientDiff", () => {
  it("updates kept rows, re-inserts changed foods and deletes removed rows", () => {
    const diff = buildMealIngredientDiff(
      "meal-1",
      [
        { id: "a", foodId: "oats", grams: 60, position: 0 },
        { id: "b", foodId: "skyr", grams: 200, position: 1 },
        { id: "c", foodId: "honey", grams: 10, position: 2 },
      ],
      [
        { id: "b", foodId: "skyr", grams: 250, position: 0 },
        { id: "a", foodId: "granola", grams: 60, position: 1 },
        { foodId: "berries", grams: 80, position: 2 },
      ],
    );
    expect(diff).toEqual({
      deleteIngredientIds: ["a", "c"],
      hasDeleteIngredients: true,
      insertIngredients: [
        { mealId: "meal-1", foodId: "granola", grams: 60, position: 1 },
        { mealId: "meal-1", foodId: "berries", grams: 80, position: 2 },
      ],
      hasInsertIngredients: true,
      ingredientUpdates: [{ where: { id: { _eq: "b" } }, _set: { grams: 250, position: 0 } }],
      hasIngredientUpdates: true,
    });
  });

  it("flags empty operations so the mutation can skip them", () => {
    const diff = buildMealIngredientDiff("meal-1", [], []);
    expect(diff.hasDeleteIngredients).toBe(false);
    expect(diff.hasInsertIngredients).toBe(false);
    expect(diff.hasIngredientUpdates).toBe(false);
  });
});
