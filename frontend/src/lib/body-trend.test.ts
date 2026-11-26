import { describe, expect, test } from "bun:test";
import { buildBodyTrend } from "./body-trend";

const day = (value: number) => `2026-11-${String(value).padStart(2, "0")}`;

describe("body trend", () => {
  test("rolling averages use the seven days ending at each reading (iOS parity)", () => {
    const trend = buildBodyTrend(
      [
        { measuredOn: day(1), weightKg: 70, bodyFatPct: null },
        { measuredOn: day(3), weightKg: "72", bodyFatPct: null },
        { measuredOn: day(9), weightKg: 71, bodyFatPct: null },
      ],
      { today: day(12), start: day(1) },
    );
    expect(trend.weight.rollingAverage).toEqual([
      { date: day(1), value: 70 },
      { date: day(3), value: 71 },
      { date: day(9), value: 71.5 },
    ]);
    expect(trend.bodyFat.rollingAverage).toEqual([]);
    expect(trend.isEmpty).toBe(false);
  });

  test("warm-up readings feed the first averages but are not plotted", () => {
    const trend = buildBodyTrend(
      [
        { measuredOn: "2026-10-10", weightKg: 72 },
        { measuredOn: "2026-10-14", weightKg: 71 },
        { measuredOn: "2026-10-20", weightKg: 70 },
      ],
      { today: "2026-11-12", start: "2026-10-14" },
    );
    expect(trend.weight.readings.map((reading) => reading.date)).toEqual([
      "2026-10-14",
      "2026-10-20",
    ]);
    expect(trend.weight.rollingAverage).toEqual([
      { date: "2026-10-14", value: 71.5 },
      { date: "2026-10-20", value: 70.5 },
    ]);
  });

  test("the week average, its change and the latest reading match Today's card", () => {
    const rows = [
      { measuredOn: day(1), weightKg: 72, bodyFatPct: 13.4 },
      { measuredOn: day(4), weightKg: 71.6, bodyFatPct: null },
      { measuredOn: day(7), weightKg: 70.8, bodyFatPct: 12.8 },
      { measuredOn: day(10), weightKg: 70.6, bodyFatPct: null },
      { measuredOn: day(12), weightKg: 70.85, bodyFatPct: 12.6 },
    ];
    const trend = buildBodyTrend(rows, { today: day(12), start: "2026-10-14" });
    // Week: 6 to 12 Nov. Prior week: 30 Oct to 5 Nov.
    expect(trend.weight.weekAverage).toBeCloseTo((70.8 + 70.6 + 70.85) / 3, 10);
    expect(trend.weight.priorWeekAverage).toBeCloseTo((72 + 71.6) / 2, 10);
    expect(trend.weight.weekChange).toBeCloseTo((70.8 + 70.6 + 70.85) / 3 - 71.8, 10);
    expect(trend.weight.latest).toEqual({ date: day(12), value: 70.85 });
    expect(trend.bodyFat.latest).toEqual({ date: day(12), value: 12.6 });
    expect(trend.bodyFat.weekAverage).toBeCloseTo(12.7, 10);
    expect(trend.bodyFat.priorWeekAverage).toBe(13.4);
  });

  test("no readings in the window is empty; no prior week has no change", () => {
    const trend = buildBodyTrend([{ measuredOn: day(12), weightKg: 70 }], {
      today: day(12),
      start: day(10),
    });
    expect(trend.weight.weekChange).toBeNull();
    expect(buildBodyTrend([], { today: day(12), start: day(1) }).isEmpty).toBe(true);
  });
});
