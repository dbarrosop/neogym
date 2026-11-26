import { describe, expect, test } from "bun:test";
import { buildCalorieTrend, type CalorieHistoryData } from "./calorie-trend";

const day = (value: number) => `2026-11-${String(value).padStart(2, "0")}`;

describe("calorie trend", () => {
  function history(days: [string, number][], energy: [string, number][]): CalorieHistoryData {
    return {
      nutritionDays: days.map(([logDate, kcal]) => ({
        logDate,
        nutritionLogEntries: kcal > 0 ? [{ grams: "100", snapshotKcalPer100g: kcal }] : [],
      })),
      dailyEnergyEntries: energy.map(([energyOn, out]) => ({
        energyOn,
        activeKcal: 500,
        restingKcal: out - 500,
      })),
    };
  }

  test("today stays out of averages and net (iOS parity)", () => {
    const data = history(
      [
        [day(1), 2_000],
        [day(5), 0],
        [day(8), 2_400],
        [day(10), 2_600],
        [day(11), 2_200],
        [day(12), 1_400],
      ],
      [
        [day(1), 2_500],
        [day(5), 2_400],
        [day(8), 2_600],
        [day(11), 2_800],
        [day(12), 1_200],
      ],
    );
    const trend = buildCalorieTrend(data, { today: day(12), start: day(1) });
    expect(trend.consumed.map((point) => point.date)).toEqual([day(1), day(8), day(10), day(11)]);
    expect(trend.consumedToday).toEqual({ date: day(12), value: 1_400 });
    expect(trend.consumedPoints.at(-1)).toEqual({ date: day(12), value: 1_400, partial: true });
    expect(trend.consumedAverage.map((point) => point.value)).toEqual([2_000, 2_400, 2_500, 2_400]);
    expect(trend.net.map((point) => point.date)).toEqual([day(1), day(8), day(11)]);
    expect(trend.latestNetAverage).toBe(-400);
    expect(trend.latestConsumedAverage).toBe(2_400);
    expect(trend.latestNetWindow).toEqual({
      end: day(11),
      days: 2,
      consumed: 2_300,
      burned: 2_700,
      net: -400,
    });
  });

  test("warm-up days feed the first averages but are not plotted", () => {
    const data = history(
      [
        ["2026-10-31", 3_000],
        [day(2), 2_000],
      ],
      [
        ["2026-10-31", 2_000],
        [day(2), 2_500],
      ],
    );
    const trend = buildCalorieTrend(data, { today: day(12), start: day(1) });
    expect(trend.consumed).toEqual([{ date: day(2), value: 2_000 }]);
    expect(trend.consumedAverage).toEqual([{ date: day(2), value: 2_500 }]);
    expect(trend.netAverage).toEqual([{ date: day(2), value: 250 }]);
  });

  test("grouped and standalone entries add up from snapshots", () => {
    const trend = buildCalorieTrend(
      {
        nutritionDays: [
          {
            logDate: day(10),
            nutritionLogEntries: [
              { grams: "150", snapshotKcalPer100g: "200" },
              { grams: 50, snapshotKcalPer100g: 100 },
            ],
          },
        ],
        dailyEnergyEntries: [],
      },
      { today: day(12), start: day(1) },
    );
    expect(trend.consumed).toEqual([{ date: day(10), value: 350 }]);
    expect(trend.net).toEqual([]);
    expect(trend.latestNetWindow).toBeNull();
  });

  test("nothing logged is empty", () => {
    const trend = buildCalorieTrend(history([[day(3), 0]], [[day(3), 2_000]]), {
      today: day(12),
      start: day(1),
    });
    expect(trend.isEmpty).toBe(true);
    expect(trend.latestNetAverage).toBeNull();
  });
});
