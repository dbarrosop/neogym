import { describe, expect, test } from "bun:test";
import { describeTrend } from "./chart-trend";

const options = { label: "Bench Press estimated one-rep max", unit: "kg" };

describe("describeTrend", () => {
  for (const { values, change } of [
    { values: [92.5, 95, 100], change: "up 7.5 kg overall" },
    { values: [100, 95, 92.5], change: "down 7.5 kg overall" },
    { values: [100, 95, 100], change: "unchanged overall" },
    { values: [0.1, 0.2, 0.3], change: "up 0.2 kg overall" },
  ]) {
    test(change, () => {
      expect(
        describeTrend(
          values.map((value) => ({ value })),
          options,
        ),
      ).toBe(
        `${options.label}: ${values[0]} kg to ${values.at(-1)} kg; ${change} across 3 observations.`,
      );
    });
  }

  test("a single observation does not invent a direction", () => {
    expect(describeTrend([{ value: 82.45 }], { label: "Weight", unit: "kg" })).toBe(
      "Weight: 82.45 kg; one observation, no trend yet.",
    );
  });

  test("empty or missing observations are not zeroes", () => {
    expect(describeTrend([], options)).toBe(`${options.label}: no observations in this period.`);
    expect(
      describeTrend(
        [{ value: null }, { value: Number.NaN }, { value: Number.POSITIVE_INFINITY }],
        options,
      ),
    ).toBe(`${options.label}: no observations in this period.`);
    expect(
      describeTrend([{ value: null }, { value: 0 }, { value: null }, { value: 12.5 }], {
        label: "Chest weighted sets per rolling week",
        unit: "sets",
      }),
    ).toBe(
      "Chest weighted sets per rolling week: 0 sets to 12.5 sets; up 12.5 sets overall across 2 observations.",
    );
  });

  test("dated sparse series use each metric's own endpoints in the local calendar", () => {
    const first = new Date(2025, 11, 31).getTime();
    const last = new Date(2026, 0, 2).getTime();
    const dateLabel = (date: number) =>
      new Date(date).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    expect(
      describeTrend(
        [
          { date: first, value: null },
          { date: first, value: 1800 },
          { date: last, value: 1750 },
          { date: last, value: null },
        ],
        { label: "Resting energy", unit: "kcal" },
      ),
    ).toBe(
      `Resting energy: 1,800 kcal on ${dateLabel(first)} to 1,750 kcal on ${dateLabel(last)}; down 50 kcal overall across 2 observations.`,
    );
  });

  test("tiny changes are not announced as up or down zero units", () => {
    expect(describeTrend([{ value: 80 }, { value: 80.001 }], options)).toBe(
      `${options.label}: 80 kg to 80 kg; no change at displayed precision across 2 observations.`,
    );
  });
});
