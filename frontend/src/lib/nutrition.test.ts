import { describe, expect, it } from "bun:test";
import {
  addLocalDateDays,
  currentTimeInputValue,
  formatLocalDate,
  formatLocalDateLabel,
  formatMacro,
  formatTimeOfDay,
  groupIntakeByTimeSlot,
  type IntakeEntry,
  type IntakeLoggedMealGroup,
  intakeDraftMacroTotals,
  isFoodInUseError,
  isValidLocalDate,
  loggedMacroTotals,
  macroSummary,
  macrosForGrams,
  macroTotalsSummary,
  mealMacroTotals,
  mergePlanEntriesByTime,
  normalizeMacros,
  normalizeNumeric,
  type PlanFoodEntry,
  type PlanMealEntry,
  parseMacroInput,
  planEntriesMacroTotals,
  planEntryMacroTotals,
  planMacroTotals,
  sortAndRenumberPlanEntriesByTime,
  timeToInputValue,
} from "./nutrition";

const SEVEN_THIRTY_FORMAT_PATTERN = /7:30|07:30/;

function loggedEntry(overrides: Partial<IntakeEntry> & Pick<IntakeEntry, "id">): IntakeEntry {
  return {
    id: overrides.id,
    nutritionLogMealId: overrides.nutritionLogMealId ?? null,
    grams: overrides.grams ?? 100,
    position: overrides.position ?? 0,
    slotTime: overrides.slotTime ?? null,
    snapshotFoodName: overrides.snapshotFoodName ?? overrides.id,
    snapshotKcalPer100g: overrides.snapshotKcalPer100g ?? 100,
    snapshotFatPer100g: overrides.snapshotFatPer100g ?? 1,
    snapshotCarbsPer100g: overrides.snapshotCarbsPer100g ?? 2,
    snapshotProteinPer100g: overrides.snapshotProteinPer100g ?? 3,
    snapshotFiberPer100g: overrides.snapshotFiberPer100g ?? 4,
    snapshotSugarPer100g: overrides.snapshotSugarPer100g ?? 5,
  };
}

function loggedMeal(
  overrides: Partial<IntakeLoggedMealGroup> & Pick<IntakeLoggedMealGroup, "id">,
): IntakeLoggedMealGroup {
  return {
    id: overrides.id,
    mealId: overrides.mealId ?? null,
    nutritionPlanMealId: overrides.nutritionPlanMealId ?? null,
    name: overrides.name ?? overrides.id,
    slotTime: overrides.slotTime ?? null,
    position: overrides.position ?? 0,
    nutritionLogEntries: overrides.nutritionLogEntries ?? [],
  };
}

function planMeal(overrides: Partial<PlanMealEntry> & Pick<PlanMealEntry, "id">): PlanMealEntry {
  return {
    id: overrides.id,
    slotTime: overrides.slotTime ?? "08:00:00",
    label: overrides.label ?? null,
    position: overrides.position ?? 0,
    meal: overrides.meal ?? { mealIngredients: [] },
  };
}

function planFood(overrides: Partial<PlanFoodEntry> & Pick<PlanFoodEntry, "id">): PlanFoodEntry {
  return {
    id: overrides.id,
    slotTime: overrides.slotTime ?? "08:00:00",
    label: overrides.label ?? null,
    position: overrides.position ?? 0,
    grams: overrides.grams ?? 100,
    food: overrides.food ?? {
      kcalPer100g: 100,
      fatPer100g: 1,
      carbsPer100g: 2,
      proteinPer100g: 3,
      fiberPer100g: 4,
      sugarPer100g: 5,
    },
  };
}

describe("nutrition numeric and macro helpers", () => {
  it("normalizes Hasura numeric values returned as strings or numbers", () => {
    expect(normalizeNumeric("12.5")).toBe(12.5);
    expect(normalizeNumeric("12,5")).toBe(12.5);
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
    expect(parseMacroInput("42,5")).toBe(42.5);
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

describe("nutrition macro helpers", () => {
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

  it("computes editable intake draft totals from current grams", () => {
    expect(
      intakeDraftMacroTotals([
        {
          grams: "125",
          food: {
            kcalPer100g: "80",
            fatPer100g: "1",
            carbsPer100g: "10",
            proteinPer100g: "5",
            fiberPer100g: "2",
            sugarPer100g: "3",
          },
        },
        {
          grams: "75",
          food: {
            kcalPer100g: "120",
            fatPer100g: "2",
            carbsPer100g: "8",
            proteinPer100g: "4",
            fiberPer100g: "1",
            sugarPer100g: "2",
          },
        },
      ]),
    ).toEqual({
      kcal: 190,
      fat: 2.75,
      carbs: 18.5,
      protein: 9.25,
      fiber: 3.25,
      sugar: 5.25,
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

  it("computes daily plan totals from each slot's live meal ingredients", () => {
    expect(
      planMacroTotals([
        {
          meal: {
            mealIngredients: [
              {
                grams: 200,
                food: {
                  kcalPer100g: 50,
                  fatPer100g: 1,
                  carbsPer100g: 5,
                  proteinPer100g: 3,
                  fiberPer100g: 1,
                  sugarPer100g: 2,
                },
              },
            ],
          },
        },
        {
          meal: {
            mealIngredients: [
              {
                grams: "100",
                food: {
                  kcalPer100g: "25",
                  fatPer100g: "0.5",
                  carbsPer100g: "4",
                  proteinPer100g: "2",
                  fiberPer100g: "1.5",
                  sugarPer100g: "1",
                },
              },
            ],
          },
        },
      ]),
    ).toEqual({
      kcal: 125,
      fat: 2.5,
      carbs: 14,
      protein: 8,
      fiber: 3.5,
      sugar: 5,
    });
  });
});

describe("nutrition mixed plan entry helpers", () => {
  it("computes direct plan food macros from grams and live food nutrition", () => {
    expect(
      planEntryMacroTotals({
        ...planFood({
          id: "banana-slot",
          grams: "150",
          food: {
            kcalPer100g: "200",
            fatPer100g: "10",
            carbsPer100g: "20",
            proteinPer100g: "5",
            fiberPer100g: "2",
            sugarPer100g: "8",
          },
        }),
        kind: "food",
      }),
    ).toEqual({
      kcal: 300,
      fat: 15,
      carbs: 30,
      protein: 7.5,
      fiber: 3,
      sugar: 12,
    });
  });

  it("computes mixed plan totals while normalizing Hasura numeric strings", () => {
    const entries = mergePlanEntriesByTime(
      [
        planMeal({
          id: "breakfast-meal",
          meal: {
            mealIngredients: [
              {
                grams: "50",
                food: {
                  kcalPer100g: "100",
                  fatPer100g: "2",
                  carbsPer100g: "10",
                  proteinPer100g: "4",
                  fiberPer100g: "1",
                  sugarPer100g: "3",
                },
              },
            ],
          },
        }),
      ],
      [
        planFood({
          id: "snack-food",
          grams: "25",
          food: {
            kcalPer100g: "200",
            fatPer100g: "4",
            carbsPer100g: "20",
            proteinPer100g: "8",
            fiberPer100g: "2",
            sugarPer100g: "6",
          },
        }),
      ],
    );

    expect(planEntriesMacroTotals(entries)).toEqual({
      kcal: 100,
      fat: 2,
      carbs: 10,
      protein: 4,
      fiber: 1,
      sugar: 3,
    });
  });

  it("merges meal and food entries with global positions within each time slot", () => {
    const entries = mergePlanEntriesByTime(
      [
        planMeal({ id: "meal-later", slotTime: "12:00:00", position: 1 }),
        planMeal({ id: "meal-last", slotTime: "12:00:00", position: 2 }),
      ],
      [
        planFood({ id: "food-earlier-time", slotTime: "08:00:00", position: 5 }),
        planFood({ id: "food-first-at-noon", slotTime: "12:00:00", position: 0 }),
      ],
    );

    expect(entries.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      "food:food-earlier-time",
      "food:food-first-at-noon",
      "meal:meal-later",
      "meal:meal-last",
    ]);
  });

  it("uses kind and id as stable fallbacks when mixed positions collide", () => {
    const entries = mergePlanEntriesByTime(
      [
        planMeal({ id: "meal-b", slotTime: "09:00:00", position: 1 }),
        planMeal({ id: "meal-a", slotTime: "09:00:00", position: 1 }),
      ],
      [
        planFood({ id: "food-z", slotTime: "09:00:00", position: 1 }),
        planFood({ id: "food-a", slotTime: "09:00:00", position: 1 }),
      ],
    );

    expect(entries.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      "food:food-a",
      "food:food-z",
      "meal:meal-a",
      "meal:meal-b",
    ]);
  });

  it("sorts drafts by time and writes shared positions per mixed time slot", () => {
    const entries = sortAndRenumberPlanEntriesByTime([
      { kind: "meal", id: "meal-lunch", slotTime: "12:00", position: 99 },
      { kind: "food", id: "food-breakfast", slotTime: "08:00", position: 99 },
      { kind: "food", id: "food-lunch", slotTime: "12:00", position: 99 },
      { kind: "meal", id: "meal-lunch-2", slotTime: "12:00", position: 99 },
    ]);

    expect(
      entries.map((entry) => `${entry.slotTime}:${entry.kind}:${entry.id}:${entry.position}`),
    ).toEqual([
      "08:00:food:food-breakfast:0",
      "12:00:meal:meal-lunch:0",
      "12:00:food:food-lunch:1",
      "12:00:meal:meal-lunch-2:2",
    ]);
  });
});

describe("nutrition logged macro helpers", () => {
  it("computes logged totals from trusted snapshot columns", () => {
    expect(
      loggedMacroTotals([
        {
          grams: "150",
          snapshotKcalPer100g: "100",
          snapshotFatPer100g: "2",
          snapshotCarbsPer100g: "10",
          snapshotProteinPer100g: "5",
          snapshotFiberPer100g: "1",
          snapshotSugarPer100g: "3",
        },
        {
          grams: 50,
          snapshotKcalPer100g: 200,
          snapshotFatPer100g: 8,
          snapshotCarbsPer100g: 20,
          snapshotProteinPer100g: 10,
          snapshotFiberPer100g: 4,
          snapshotSugarPer100g: 6,
        },
      ]),
    ).toEqual({
      kcal: 250,
      fat: 7,
      carbs: 25,
      protein: 12.5,
      fiber: 3.5,
      sugar: 7.5,
    });
  });
});

describe("nutrition time-slot grouping", () => {
  it("groups logged intake by normalized time slots and source metadata", () => {
    const groupedChild = loggedEntry({
      id: "grouped-child",
      nutritionLogMealId: "logged-meal",
      slotTime: "23:30:00",
      snapshotFoodName: "Grouped child",
    });
    const standalone = loggedEntry({
      id: "standalone",
      slotTime: "10:15:00",
      snapshotFoodName: "Standalone food",
    });
    const slots = groupIntakeByTimeSlot(
      [
        loggedMeal({
          id: "logged-meal",
          name: "Breakfast",
          slotTime: "08:00:00",
          nutritionLogEntries: [groupedChild],
        }),
      ],
      [standalone],
    );

    expect(slots.map((slot) => slot.key)).toEqual(["08:00", "10:15"]);
    expect(slots[0]?.entries.map((slotEntry) => slotEntry.entry.id)).toEqual(["grouped-child"]);
    expect(slots[0]?.entries[0]?.mealId).toBe("logged-meal");
    expect(slots[0]?.entries[0]?.mealName).toBe("Breakfast");
    expect(slots[1]?.entries.map((slotEntry) => slotEntry.entry.id)).toEqual(["standalone"]);
    expect(slots[1]?.entries[0]?.mealId).toBeNull();
    expect(slots[1]?.entries[0]?.mealName).toBeNull();
  });

  it("sorts no-time intake last while preserving childless logged meal groups", () => {
    const slots = groupIntakeByTimeSlot(
      [
        loggedMeal({ id: "childless", name: "Empty meal", slotTime: null }),
        loggedMeal({ id: "timed", name: "Timed meal", slotTime: "07:00:00" }),
      ],
      [loggedEntry({ id: "timed-entry", slotTime: "12:00:00" })],
    );

    expect(slots.map((slot) => slot.key)).toEqual(["07:00", "12:00", "no-time"]);
    expect(slots[2]?.label).toBe("No time");
    expect(slots[2]?.mealGroups).toEqual([
      {
        id: "childless",
        mealId: null,
        nutritionPlanMealId: null,
        name: "Empty meal",
        slotTime: null,
        position: 0,
        entryCount: 0,
      },
    ]);
    expect(slots[2]?.entries).toEqual([]);
  });

  it("totals each time slot from its flat logged snapshot entries", () => {
    const groupedChild = loggedEntry({
      id: "grouped-child",
      grams: 100,
      snapshotKcalPer100g: 80,
      snapshotFatPer100g: 1,
      snapshotCarbsPer100g: 2,
      snapshotProteinPer100g: 3,
      snapshotFiberPer100g: 4,
      snapshotSugarPer100g: 5,
    });
    const standalone = loggedEntry({
      id: "standalone",
      grams: 50,
      slotTime: "08:00:00",
      snapshotKcalPer100g: 120,
      snapshotFatPer100g: 2,
      snapshotCarbsPer100g: 4,
      snapshotProteinPer100g: 6,
      snapshotFiberPer100g: 8,
      snapshotSugarPer100g: 10,
    });
    const [slot] = groupIntakeByTimeSlot(
      [
        loggedMeal({
          id: "meal",
          slotTime: "08:00:00",
          nutritionLogEntries: [groupedChild],
        }),
      ],
      [standalone],
    );

    expect(slot?.totals).toEqual(loggedMacroTotals([groupedChild, standalone]));
  });

  it("orders slot entries deterministically by source and child positions", () => {
    const mealB = loggedMeal({
      id: "meal-b",
      slotTime: "09:00:00",
      position: 1,
      nutritionLogEntries: [
        loggedEntry({ id: "meal-b-child-2", position: 2 }),
        loggedEntry({ id: "meal-b-child-1", position: 1 }),
      ],
    });
    const mealA = loggedMeal({
      id: "meal-a",
      slotTime: "09:00:00",
      position: 1,
      nutritionLogEntries: [loggedEntry({ id: "meal-a-child", position: 1 })],
    });
    const standalone = loggedEntry({ id: "standalone", slotTime: "09:00:00", position: 1 });
    const [slot] = groupIntakeByTimeSlot([mealB, mealA], [standalone]);

    expect(slot?.entries.map((slotEntry) => slotEntry.entry.id)).toEqual([
      "meal-a-child",
      "meal-b-child-1",
      "meal-b-child-2",
      "standalone",
    ]);
    expect(slot?.mealGroups.map((group) => group.id)).toEqual(["meal-a", "meal-b"]);
  });
});

describe("nutrition delete error helpers", () => {
  it("recognizes direct plan food references as food-in-use delete errors", () => {
    expect(
      isFoodInUseError(new Error("update or delete violates nutrition_plan_foods_food_id_fkey")),
    ).toBe(true);
  });
});

describe("nutrition date and time helpers", () => {
  it("normalizes and formats database time values for plan slot inputs", () => {
    expect(currentTimeInputValue(new Date(2026, 0, 5, 9, 7))).toBe("09:07");
    expect(timeToInputValue("07:30:00")).toBe("07:30");
    expect(timeToInputValue("19:05:12.345")).toBe("19:05");
    expect(timeToInputValue("24:00:00")).toBe("");
    expect(formatTimeOfDay("07:30:00")).toMatch(SEVEN_THIRTY_FORMAT_PATTERN);
    expect(formatTimeOfDay(null)).toBe("—");
  });

  it("formats and validates local calendar dates without UTC conversion", () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(isValidLocalDate("2026-02-28")).toBe(true);
    expect(isValidLocalDate("2026-02-29")).toBe(false);
    expect(isValidLocalDate("2026-13-01")).toBe(false);
    expect(addLocalDateDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(formatLocalDateLabel("not-a-date")).toBe("not-a-date");
  });
});
