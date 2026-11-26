import { describe, expect, test } from "bun:test";
import {
  formatRowGrams,
  formatRowKcal,
  macroCells,
  slotKcalProteinCaption,
} from "@/lib/nutrition-rows";

describe("macroCells", () => {
  test("P | C | F in board order with one decimal below 10 g", () => {
    expect(macroCells({ protein: 33, carbs: 6.84, fat: 2 })).toEqual([
      { letter: "P", name: "protein", value: "33" },
      { letter: "C", name: "carbs", value: "6.8" },
      { letter: "F", name: "fat", value: "2" },
    ]);
  });

  test("small values keep a decimal, large values round to whole grams", () => {
    expect(macroCells({ protein: 0.06, carbs: 9.96, fat: 54.4 }).map((cell) => cell.value)).toEqual(
      ["0.1", "10", "54"],
    );
    expect(macroCells({ protein: 0, carbs: 0.04, fat: 0.5 }).map((cell) => cell.value)).toEqual([
      "0",
      "0",
      "0.5",
    ]);
  });
});

describe("row columns", () => {
  test("grams keep one decimal only when needed", () => {
    expect(formatRowGrams(45)).toBe("45 g");
    expect(formatRowGrams("12.5")).toBe("12.5 g");
  });

  test("kcal are whole and grouped", () => {
    expect(formatRowKcal(176.4)).toBe("176");
    expect(formatRowKcal(1176.6)).toBe("1,177");
  });

  test("plan editor slot caption", () => {
    expect(slotKcalProteinCaption({ kcal: 619.2, protein: 40.4 })).toBe("619 kcal · P 40");
  });
});
