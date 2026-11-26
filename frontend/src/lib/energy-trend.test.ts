import { describe, expect, test } from "bun:test";
import { buildEnergyTrend } from "./energy-trend";

const day = (value: number) => `2026-11-${String(value).padStart(2, "0")}`;

describe("energy trend", () => {
  const rows = [
    { energyOn: day(9), activeKcal: 800, restingKcal: 1_800 },
    { energyOn: day(10), activeKcal: "1000", restingKcal: "1900" },
    { energyOn: day(11), activeKcal: null, restingKcal: 1_850 },
    { energyOn: day(12), activeKcal: 531, restingKcal: 679 },
    { energyOn: day(1), activeKcal: 5_000, restingKcal: 5_000 },
  ];

  test("today is partial and every average uses full days only", () => {
    const trend = buildEnergyTrend(rows, { today: day(12), start: day(9) });
    expect(trend.resting.at(-1)).toEqual({ date: day(12), value: 679, partial: true });
    expect(trend.active.map((point) => point.date)).toEqual([day(9), day(10), day(12)]);
    expect(trend.fullDayCount).toBe(3);
    expect(trend.averageOut).toBeCloseTo((2_600 + 2_900 + 1_850) / 3, 10);
    expect(trend.averageResting).toBeCloseTo((1_800 + 1_900 + 1_850) / 3, 10);
    expect(trend.averageActive).toBeCloseTo((800 + 1_000) / 3, 10);
    expect((trend.averageResting ?? 0) + (trend.averageActive ?? 0)).toBeCloseTo(
      trend.averageOut ?? 0,
      10,
    );
    expect(trend.today).toEqual({ date: day(12), resting: 679, active: 531, total: 1_210 });
  });

  test("a window before today has no partial point", () => {
    const trend = buildEnergyTrend(rows, { today: day(12), start: day(9), end: day(11) });
    expect(trend.total.some((point) => point.partial)).toBe(false);
    expect(trend.today).toBeNull();
  });
});
