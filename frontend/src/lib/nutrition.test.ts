import { describe, expect, it } from "bun:test";
import {
  formatMacro,
  macroSummary,
  macrosForGrams,
  macroTotalsSummary,
  mealMacroTotals,
  normalizeMacros,
  normalizeNumeric,
  parseMacroInput,
} from "./nutrition";

describe("nutrition helpers", () => {
  it("normalizes Hasura numeric values returned as strings or numbers", () => {
    expect(normalizeNumeric("12.5")).toBe(12.5);
    expect(normalizeNumeric(8)).toBe(8);
    expect(normalizeNumeric("not-a-number")).toBe(0);
    expect(normalizeNumeric(null)).toBe(0);
  });

  it("normalizes all macro fields before math/display", () => {
    expect(
      normalizeMacros({
        kcalPer100g: "250",
        fatPer100g: "12.5",
        carbsPer100g: 31,
        proteinPer100g: "7.25",
        fiberPer100g: null,
        sugarPer100g: undefined,
      }),
    ).toEqual({
      kcalPer100g: 250,
      fatPer100g: 12.5,
      carbsPer100g: 31,
      proteinPer100g: 7.25,
      fiberPer100g: 0,
      sugarPer100g: 0,
    });
  });

  it("parses non-negative form inputs and rejects invalid values", () => {
    expect(parseMacroInput(" 42.5 ")).toBe(42.5);
    expect(parseMacroInput("0")).toBe(0);
    expect(parseMacroInput("")).toBeNull();
    expect(parseMacroInput("-1")).toBeNull();
    expect(parseMacroInput("abc")).toBeNull();
  });

  it("formats macro values with compact units", () => {
    expect(formatMacro("120", "kcal")).toBe("120 kcal");
    expect(formatMacro("1.25", "g")).toBe("1.3 g");
  });

  it("builds a concise per-100g macro summary", () => {
    expect(
      macroSummary({
        kcalPer100g: "120",
        fatPer100g: "3.5",
        carbsPer100g: "20",
        proteinPer100g: "4",
        fiberPer100g: "2.25",
        sugarPer100g: "5",
      }),
    ).toBe("120 kcal · 3.5 g fat · 20 g carbs · 4 g protein · 2.3 g fiber · 5 g sugar");
  });

  it("scales live food macros by grams", () => {
    expect(
      macrosForGrams(
        {
          kcalPer100g: "200",
          fatPer100g: "10",
          carbsPer100g: "20",
          proteinPer100g: "5",
          fiberPer100g: "2",
          sugarPer100g: "8",
        },
        "150",
      ),
    ).toEqual({
      kcal: 300,
      fat: 15,
      carbs: 30,
      protein: 7.5,
      fiber: 3,
      sugar: 12,
    });
  });

  it("computes meal totals from ingredient foods", () => {
    const totals = mealMacroTotals([
      {
        grams: 100,
        food: {
          kcalPer100g: 100,
          fatPer100g: 1,
          carbsPer100g: 10,
          proteinPer100g: 5,
          fiberPer100g: 2,
          sugarPer100g: 3,
        },
      },
      {
        grams: "50",
        food: {
          kcalPer100g: "80",
          fatPer100g: "2",
          carbsPer100g: "6",
          proteinPer100g: "4",
          fiberPer100g: "1",
          sugarPer100g: "2",
        },
      },
    ]);

    expect(totals).toEqual({
      kcal: 140,
      fat: 2,
      carbs: 13,
      protein: 7,
      fiber: 2.5,
      sugar: 4,
    });
    expect(macroTotalsSummary(totals)).toBe(
      "140 kcal · 2 g fat · 13 g carbs · 7 g protein · 2.5 g fiber · 4 g sugar",
    );
  });
});
