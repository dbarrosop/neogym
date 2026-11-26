import { describe, expect, test } from "bun:test";
import {
  bodyWeekSummary,
  energySplitLabel,
  todayBalanceCaption,
  todayBalanceSoFar,
} from "@/lib/today-summary";

describe("todayBalanceSoFar", () => {
  test("nets logged intake against energy recorded so far", () => {
    expect(
      todayBalanceSoFar({
        caloriesIn: 1461,
        energy: { restingKcal: 679, activeKcal: "531", updatedAt: "2026-11-12T12:40:00Z" },
      }),
    ).toEqual({
      caloriesIn: 1461,
      caloriesOut: 1210,
      net: 251,
      restingKcal: 679,
      activeKcal: 531,
      energyUpdatedAt: new Date("2026-11-12T12:40:00Z"),
    });
  });

  test("a deficit is negative", () => {
    const balance = todayBalanceSoFar({
      caloriesIn: 400,
      energy: { restingKcal: "1500.5", activeKcal: 300 },
    });
    expect(balance.caloriesOut).toBe(1800.5);
    expect(balance.net).toBe(-1400.5);
  });

  test("without today's energy row there is intake only, no out or net", () => {
    for (const energy of [null, undefined]) {
      expect(todayBalanceSoFar({ caloriesIn: 250, energy })).toEqual({
        caloriesIn: 250,
        caloriesOut: null,
        net: null,
        restingKcal: 0,
        activeKcal: 0,
        energyUpdatedAt: null,
      });
    }
  });

  test("a missing component on an existing row contributes zero", () => {
    const balance = todayBalanceSoFar({
      caloriesIn: 0,
      energy: { restingKcal: null, activeKcal: 420, updatedAt: null },
    });
    expect(balance).toMatchObject({ caloriesOut: 420, net: -420, restingKcal: 0, activeKcal: 420 });
    expect(balance.energyUpdatedAt).toBeNull();
  });

  test("unreadable values count zero and invalid timestamps are dropped", () => {
    const balance = todayBalanceSoFar({
      caloriesIn: 10,
      energy: { restingKcal: "abc", activeKcal: "12,5", updatedAt: "not a date" },
    });
    expect(balance).toMatchObject({ caloriesOut: 12.5, net: -2.5, restingKcal: 0 });
    expect(balance.energyUpdatedAt).toBeNull();
  });
});

describe("todayBalanceCaption", () => {
  test("stamps the energy row's last write in local time", () => {
    expect(todayBalanceCaption(new Date(2026, 10, 12, 13, 40), { locale: "en-GB" })).toBe(
      "Today so far · 13:40",
    );
    expect(todayBalanceCaption(new Date(2026, 10, 12, 9, 5), { locale: "en-GB" })).toBe(
      "Today so far · 09:05",
    );
  });

  test("reads just 'Today so far' without a timestamp", () => {
    expect(todayBalanceCaption(null)).toBe("Today so far");
  });
});

describe("energySplitLabel", () => {
  test("names both components in whole kilocalories", () => {
    expect(energySplitLabel({ restingKcal: 1679.4, activeKcal: 531 }, { locale: "en-GB" })).toBe(
      "Energy out so far: resting 1,679, active 531 kilocalories",
    );
  });
});

describe("bodyWeekSummary", () => {
  test("pairs the 7-day average with a neutral signed change", () => {
    for (const [weekAverage, weekChange, expected] of [
      [70.7, -1.04, "7-day avg 70.7 · −1.0 vs prior week"],
      [81.2, 1.2, "7-day avg 81.2 · +1.2 vs prior week"],
      [80, 0, "7-day avg 80.0 · 0.0 vs prior week"],
      [80, -0.04, "7-day avg 80.0 · 0.0 vs prior week"],
      [12.6, null, "7-day avg 12.6"],
    ] as const) {
      expect(bodyWeekSummary({ weekAverage, weekChange }, { locale: "en-GB" })).toBe(expected);
    }
  });

  test("is empty without readings in the last seven days", () => {
    expect(bodyWeekSummary({ weekAverage: null, weekChange: null })).toBeNull();
  });
});
