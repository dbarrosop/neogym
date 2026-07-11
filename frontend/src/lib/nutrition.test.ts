import { describe, expect, it } from "bun:test";
import {
  addLocalDateDays,
  adHocNutritionDraftTotals,
  buildAdHocLogEntryInsertInput,
  buildAdHocLogEntryUpdateSet,
  buildPlanLogInputs,
  canMovePlanDraftEntryWithinSlot,
  createEmptyAdHocNutritionDraft,
  currentTimeInputValue,
  formatLocalDate,
  formatLocalDateLabel,
  formatMacro,
  formatTimeOfDay,
  groupIntakeByTimeSlot,
  groupPlanDraftEntriesByTimeSlot,
  groupPlanEntriesByTimeSlot,
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
  movePlanDraftEntryWithinSlot,
  normalizeMacros,
  normalizeNumeric,
  type PlanFoodEntry,
  type PlanMealEntry,
  parseMacroInput,
  planEntriesMacroTotals,
  planEntryMacroTotals,
  sortAndRenumberPlanEntriesByTime,
  timeToInputValue,
  validateAdHocNutritionDraft,
} from "./nutrition";
import { logSelectedPlanMaterialization } from "./nutrition-plan-log";

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
});

describe("ad-hoc nutrition log helpers", () => {
  const draft = {
    ...createEmptyAdHocNutritionDraft(),
    name: "  Street tacos  ",
    grams: "150",
    kcalPer100g: "200",
    fatPer100g: "8",
    carbsPer100g: "20",
    proteinPer100g: "10",
    fiberPer100g: "3",
    sugarPer100g: "4",
  };

  it("validates one-off food snapshots and trims the display name", () => {
    expect(validateAdHocNutritionDraft(draft)).toEqual({
      valid: true,
      message: "",
      values: {
        name: "Street tacos",
        grams: 150,
        kcalPer100g: 200,
        fatPer100g: 8,
        carbsPer100g: 20,
        proteinPer100g: 10,
        fiberPer100g: 3,
        sugarPer100g: 4,
      },
    });

    expect(validateAdHocNutritionDraft({ ...draft, name: "   " })).toMatchObject({
      valid: false,
      message: "Food name is required.",
    });
    expect(validateAdHocNutritionDraft({ ...draft, grams: "0" })).toMatchObject({
      valid: false,
      message: "Enter grams greater than zero.",
    });
    expect(validateAdHocNutritionDraft({ ...draft, sugarPer100g: "oops" })).toMatchObject({
      valid: false,
      message: "Sugar must be zero or greater.",
    });
  });

  it("computes ad-hoc preview totals from entered per-100g macros", () => {
    expect(adHocNutritionDraftTotals(draft)).toEqual({
      kcal: 300,
      fat: 12,
      carbs: 30,
      protein: 15,
      fiber: 4.5,
      sugar: 6,
    });
  });

  it("builds standalone ad-hoc insert payloads without food provenance", () => {
    expect(
      buildAdHocLogEntryInsertInput({
        draft,
        nutritionDayId: "day-1",
        position: 3,
        slotTime: "12:30",
      }),
    ).toEqual({
      nutritionDayId: "day-1",
      source: "ad_hoc",
      grams: 150,
      position: 3,
      slotTime: "12:30",
      snapshotFoodName: "Street tacos",
      snapshotKcalPer100g: 200,
      snapshotFatPer100g: 8,
      snapshotCarbsPer100g: 20,
      snapshotProteinPer100g: 10,
      snapshotFiberPer100g: 3,
      snapshotSugarPer100g: 4,
    });
  });

  it("builds ad-hoc update sets with only mutable snapshot fields", () => {
    expect(buildAdHocLogEntryUpdateSet({ draft, slotTime: "13:45" })).toEqual({
      grams: 150,
      slotTime: "13:45",
      snapshotFoodName: "Street tacos",
      snapshotKcalPer100g: 200,
      snapshotFatPer100g: 8,
      snapshotCarbsPer100g: 20,
      snapshotProteinPer100g: 10,
      snapshotFiberPer100g: 3,
      snapshotSugarPer100g: 4,
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

  it("groups persisted plan entries by normalized time slots with summaries", () => {
    const breakfastMeal = planMeal({
      id: "meal-breakfast",
      slotTime: "08:00:00",
      position: 1,
      meal: {
        mealIngredients: [
          {
            grams: 100,
            food: {
              kcalPer100g: 200,
              fatPer100g: 10,
              carbsPer100g: 20,
              proteinPer100g: 5,
              fiberPer100g: 2,
              sugarPer100g: 8,
            },
          },
        ],
      },
    });
    const breakfastFood = planFood({
      id: "food-breakfast",
      slotTime: "08:00:00",
      position: 0,
      grams: 50,
      food: {
        kcalPer100g: 100,
        fatPer100g: 2,
        carbsPer100g: 10,
        proteinPer100g: 4,
        fiberPer100g: 1,
        sugarPer100g: 3,
      },
    });
    const lunchFood = planFood({ id: "food-lunch", slotTime: "12:30:00", position: 0 });

    const slots = groupPlanEntriesByTimeSlot(
      mergePlanEntriesByTime([breakfastMeal], [lunchFood, breakfastFood]),
    );

    expect(slots.map((slot) => slot.key)).toEqual(["08:00", "12:30"]);
    expect(slots[0]?.entries.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      "food:food-breakfast",
      "meal:meal-breakfast",
    ]);
    expect(slots[0]?.mealCount).toBe(1);
    expect(slots[0]?.foodCount).toBe(1);
    expect(slots[0]?.totals).toEqual({
      kcal: 250,
      fat: 11,
      carbs: 25,
      protein: 7,
      fiber: 2.5,
      sugar: 9.5,
    });
  });

  it("groups no-time plan entries last while preserving deterministic ordering", () => {
    const slots = groupPlanEntriesByTimeSlot(
      mergePlanEntriesByTime(
        [{ ...planMeal({ id: "meal-no-time", position: 0 }), slotTime: null }],
        [
          planFood({ id: "food-timed", slotTime: "07:00:00", position: 0 }),
          { ...planFood({ id: "food-no-time", position: 1 }), slotTime: null },
        ],
      ),
    );

    expect(slots.map((slot) => slot.key)).toEqual(["07:00", "no-time"]);
    expect(slots[1]?.label).toBe("No time");
    expect(slots[1]?.entries.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      "meal:meal-no-time",
      "food:food-no-time",
    ]);
  });

  it("groups draft plan entries after stable per-slot renumbering", () => {
    const slots = groupPlanDraftEntriesByTimeSlot([
      { kind: "meal", id: "meal-lunch", slotTime: "12:00", position: 99 },
      { kind: "food", id: "food-breakfast", slotTime: "08:00", position: 99 },
      { kind: "food", id: "food-lunch", slotTime: "12:00", position: 99 },
      { kind: "meal", id: "meal-no-time", slotTime: null, position: 99 },
    ]);

    expect(slots.map((slot) => slot.key)).toEqual(["08:00", "12:00", "no-time"]);
    expect(
      slots.flatMap((slot) =>
        slot.entries.map((entry) => `${slot.key}:${entry.kind}:${entry.id}:${entry.position}`),
      ),
    ).toEqual([
      "08:00:food:food-breakfast:0",
      "12:00:meal:meal-lunch:0",
      "12:00:food:food-lunch:1",
      "no-time:meal:meal-no-time:0",
    ]);
    expect(slots.map((slot) => [slot.mealCount, slot.foodCount])).toEqual([
      [0, 1],
      [1, 1],
      [1, 0],
    ]);
  });
});

describe("nutrition plan draft movement helpers", () => {
  it("moves draft entries only within their normalized time slot", () => {
    const entries = [
      { kind: "food", id: "breakfast-food", slotTime: "08:00", position: 0 },
      { kind: "meal", id: "breakfast-meal", slotTime: "08:00:00", position: 1 },
      { kind: "food", id: "lunch-food", slotTime: "12:00", position: 0 },
    ] as const;

    expect(
      canMovePlanDraftEntryWithinSlot(entries, "breakfast-meal", -1, (entry) => entry.id),
    ).toBe(true);
    const moved = movePlanDraftEntryWithinSlot(entries, "breakfast-meal", -1, (entry) => entry.id);

    expect(moved.map((entry) => entry.id)).toEqual([
      "breakfast-meal",
      "breakfast-food",
      "lunch-food",
    ]);
    expect(
      sortAndRenumberPlanEntriesByTime(moved).map(
        (entry) => `${entry.slotTime}:${entry.id}:${entry.position}`,
      ),
    ).toEqual(["08:00:00:breakfast-meal:0", "08:00:breakfast-food:1", "12:00:lunch-food:0"]);
  });

  it("disallows draft entry moves across normalized time-slot boundaries", () => {
    const entries = [
      { kind: "food", id: "breakfast-food", slotTime: "08:00", position: 0 },
      { kind: "meal", id: "lunch-meal", slotTime: "12:00", position: 0 },
      { kind: "food", id: "lunch-food", slotTime: "12:00", position: 1 },
    ] as const;

    expect(canMovePlanDraftEntryWithinSlot(entries, "breakfast-food", 1, (entry) => entry.id)).toBe(
      false,
    );
    expect(canMovePlanDraftEntryWithinSlot(entries, "lunch-meal", -1, (entry) => entry.id)).toBe(
      false,
    );
    expect(movePlanDraftEntryWithinSlot(entries, "breakfast-food", 1, (entry) => entry.id)).toEqual(
      [...entries],
    );
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

function bulkMeal(overrides: Partial<PlanMealEntry> & Pick<PlanMealEntry, "id">): PlanMealEntry {
  return planMeal({
    mealId: "meal-1",
    meal: {
      id: "meal-1",
      name: "Breakfast bowl",
      mealIngredients: [
        {
          id: "ingredient-2",
          foodId: "food-2",
          grams: "50",
          position: 1,
          food: {
            id: "food-2",
            name: "Berries",
            kcalPer100g: 50,
            fatPer100g: 0,
            carbsPer100g: 10,
            proteinPer100g: 1,
            fiberPer100g: 2,
            sugarPer100g: 5,
          },
        },
        {
          id: "ingredient-1",
          foodId: "food-1",
          grams: "100",
          position: 0,
          food: {
            id: "food-1",
            name: "Yogurt",
            kcalPer100g: 100,
            fatPer100g: 1,
            carbsPer100g: 2,
            proteinPer100g: 10,
            fiberPer100g: 0,
            sugarPer100g: 2,
          },
        },
      ],
    },
    ...overrides,
  });
}

function bulkFood(overrides: Partial<PlanFoodEntry> & Pick<PlanFoodEntry, "id">): PlanFoodEntry {
  return planFood({
    foodId: "food-3",
    grams: "80",
    food: {
      id: "food-3",
      name: "Banana",
      kcalPer100g: 90,
      fatPer100g: 0,
      carbsPer100g: 20,
      proteinPer100g: 1,
      fiberPer100g: 3,
      sugarPer100g: 12,
    },
    ...overrides,
  });
}

function buildBulkPlan(meals: PlanMealEntry[], foods: PlanFoodEntry[]) {
  return {
    id: "plan-1",
    name: "Training day",
    nutritionPlanMeals: meals,
    nutritionPlanFoods: foods,
  };
}

describe("selected-plan bulk materialization", () => {
  it("materializes meals-only plans with nested children and empty direct entry arrays", () => {
    const result = buildPlanLogInputs({
      selectedPlan: buildBulkPlan([bulkMeal({ id: "plan-meal-1", slotTime: "08:00:00" })], []),
      nutritionDayId: "day-1",
      existingMealGroups: [],
      existingStandaloneEntries: [],
      slotTimeByKey: { "08:00": "09:15" },
    });

    expect(result.entryObjects).toEqual([]);
    expect(result.mealObjects).toHaveLength(1);
    expect(result.mealObjects[0]).toMatchObject({
      nutritionDayId: "day-1",
      mealId: "meal-1",
      nutritionPlanMealId: "plan-meal-1",
      name: "Breakfast bowl",
      slotTime: "09:15",
      position: 0,
    });
    expect(result.mealObjects[0]?.nutritionLogEntries.data).toEqual([
      {
        nutritionDayId: "day-1",
        foodId: "food-1",
        grams: 100,
        position: 0,
        slotTime: "09:15",
      },
      {
        nutritionDayId: "day-1",
        foodId: "food-2",
        grams: 50,
        position: 1,
        slotTime: "09:15",
      },
    ]);
  });

  it("materializes foods-only plans with standalone provenance and empty meal arrays", () => {
    const result = buildPlanLogInputs({
      selectedPlan: buildBulkPlan([], [bulkFood({ id: "plan-food-1", slotTime: "11:00:00" })]),
      nutritionDayId: "day-1",
      existingMealGroups: [],
      existingStandaloneEntries: [],
      slotTimeByKey: { "11:00": "11:30" },
    });

    expect(result.mealObjects).toEqual([]);
    expect(result.entryObjects).toEqual([
      {
        nutritionDayId: "day-1",
        foodId: "food-3",
        nutritionPlanFoodId: "plan-food-1",
        grams: 80,
        position: 0,
        slotTime: "11:30",
      },
    ]);
  });

  it("uses distinct positions so same-time food-before-meal order survives intake grouping", () => {
    const materialized = buildPlanLogInputs({
      selectedPlan: buildBulkPlan(
        [bulkMeal({ id: "plan-meal-1", slotTime: "08:00:00", position: 1 })],
        [bulkFood({ id: "plan-food-1", slotTime: "08:00:00", position: 0 })],
      ),
      nutritionDayId: "day-1",
      existingMealGroups: [],
      existingStandaloneEntries: [],
      slotTimeByKey: { "08:00": "08:45" },
    });

    const [slot] = groupIntakeByTimeSlot(
      materialized.mealObjects.map((meal) =>
        loggedMeal({
          id: meal.nutritionPlanMealId,
          name: meal.name,
          slotTime: meal.slotTime,
          position: meal.position,
          nutritionLogEntries: [
            loggedEntry({
              id: `${meal.nutritionPlanMealId}:child`,
              nutritionLogMealId: meal.nutritionPlanMealId,
              position: 0,
            }),
          ],
        }),
      ),
      materialized.entryObjects.map((entry) =>
        loggedEntry({
          id: entry.nutritionPlanFoodId ?? "entry",
          slotTime: entry.slotTime,
          position: entry.position,
        }),
      ),
    );

    expect(slot?.entries.map((entry) => entry.entry.id)).toEqual([
      "plan-food-1",
      "plan-meal-1:child",
    ]);
  });

  it("uses distinct positions so same-time meal-before-food order survives intake grouping", () => {
    const materialized = buildPlanLogInputs({
      selectedPlan: buildBulkPlan(
        [bulkMeal({ id: "plan-meal-1", slotTime: "08:00:00", position: 0 })],
        [bulkFood({ id: "plan-food-1", slotTime: "08:00:00", position: 1 })],
      ),
      nutritionDayId: "day-1",
      existingMealGroups: [],
      existingStandaloneEntries: [],
      slotTimeByKey: { "08:00": "08:45" },
    });

    expect(materialized.mealObjects[0]?.position).toBe(0);
    expect(materialized.entryObjects[0]?.position).toBe(1);
  });

  it("appends after the maximum existing top-level position for each overridden time", () => {
    const result = buildPlanLogInputs({
      selectedPlan: buildBulkPlan(
        [bulkMeal({ id: "plan-meal-1", slotTime: "08:00:00", position: 0 })],
        [bulkFood({ id: "plan-food-1", slotTime: "08:00:00", position: 1 })],
      ),
      nutritionDayId: "day-1",
      existingMealGroups: [loggedMeal({ id: "existing-meal", slotTime: "12:00:00", position: 4 })],
      existingStandaloneEntries: [
        loggedEntry({ id: "existing-food", slotTime: "12:00:00", position: 7 }),
      ],
      slotTimeByKey: { "08:00": "12:00" },
    });

    expect(result.mealObjects[0]?.position).toBe(8);
    expect(result.entryObjects[0]?.position).toBe(9);
    expect(result.mealObjects[0]?.slotTime).toBe("12:00");
    expect(result.entryObjects[0]?.slotTime).toBe("12:00");
  });

  it("validates selected plan, references, non-empty meals, and target times before building", () => {
    expect(() =>
      buildPlanLogInputs({
        selectedPlan: null,
        nutritionDayId: "day-1",
        existingMealGroups: [],
        existingStandaloneEntries: [],
        slotTimeByKey: {},
      }),
    ).toThrow("Select a plan");
    expect(() =>
      buildPlanLogInputs({
        selectedPlan: buildBulkPlan([], []),
        nutritionDayId: "day-1",
        existingMealGroups: [],
        existingStandaloneEntries: [],
        slotTimeByKey: {},
      }),
    ).toThrow("no meals or foods");
    expect(() =>
      buildPlanLogInputs({
        selectedPlan: buildBulkPlan(
          [
            planMeal({
              id: "empty",
              meal: { id: "meal-empty", name: "Empty meal", mealIngredients: [] },
            }),
          ],
          [],
        ),
        nutritionDayId: "day-1",
        existingMealGroups: [],
        existingStandaloneEntries: [],
        slotTimeByKey: { "08:00": "08:00" },
      }),
    ).toThrow("Empty meal has no ingredients");
    expect(() =>
      buildPlanLogInputs({
        selectedPlan: buildBulkPlan([], [planFood({ id: "missing-food", food: null })]),
        nutritionDayId: "day-1",
        existingMealGroups: [],
        existingStandaloneEntries: [],
        slotTimeByKey: { "08:00": "" },
      }),
    ).toThrow("Choose a logged time");
  });

  it("sends one combined selected-plan request with arrays even when one side is empty", async () => {
    const calls: unknown[] = [];
    const result = await logSelectedPlanMaterialization(
      {
        mealObjects: [],
        entryObjects: [
          {
            nutritionDayId: "day-1",
            foodId: "food-1",
            nutritionPlanFoodId: "plan-food-1",
            grams: 100,
            position: 0,
            slotTime: "08:00",
          },
        ],
      },
      (document, variables) => {
        calls.push({ document, variables });
        return Promise.resolve({
          insertNutritionLogMeals: { affected_rows: 0 },
          insertNutritionLogEntries: { affected_rows: 1 },
        });
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      variables: {
        mealObjects: [],
        entryObjects: [{ nutritionDayId: "day-1", nutritionPlanFoodId: "plan-food-1" }],
      },
    });
    expect(result).toEqual({ mealRows: 0, entryRows: 1 });
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
