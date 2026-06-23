import { describe, expect, it } from "bun:test";
import {
  formatMacro,
  macroSummary,
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
});
