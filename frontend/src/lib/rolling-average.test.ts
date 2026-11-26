import { describe, expect, test } from "bun:test";
import {
  chartWindow,
  dateFromDayNumber,
  dayNumber,
  numericOrNull,
  rollingAverage,
  withPartial,
} from "./rolling-average";

const day = (value: number) => `2026-11-${String(value).padStart(2, "0")}`;

describe("rolling averages and windows", () => {
  test("a 30-day window ends today and fetches six warm-up days", () => {
    expect(chartWindow(30, "2026-11-12")).toEqual({
      start: "2026-10-14",
      end: "2026-11-12",
      fetchFrom: "2026-10-08",
    });
  });

  test("day numbers are whole across DST and month ends", () => {
    expect(dayNumber("2026-03-30") - dayNumber("2026-03-28")).toBe(2);
    expect(dayNumber("2026-11-01") - dayNumber("2026-10-31")).toBe(1);
    expect(dateFromDayNumber(dayNumber("2026-10-25") + 1)).toBe("2026-10-26");
    expect(Number.isNaN(dayNumber("2026-02-30"))).toBe(true);
  });

  test("each point averages the readings in the seven dates ending on it", () => {
    expect(
      rollingAverage([
        { date: day(9), value: 71 },
        { date: day(1), value: 70 },
        { date: day(3), value: 72 },
      ]),
    ).toEqual([
      { date: day(1), value: 70 },
      { date: day(3), value: 71 },
      { date: day(9), value: 71.5 },
    ]);
  });

  test("numeric parsing keeps missing values missing", () => {
    expect(numericOrNull("70.85")).toBe(70.85);
    expect(numericOrNull(null)).toBeNull();
    expect(numericOrNull("")).toBeNull();
    expect(numericOrNull(0)).toBe(0);
    expect(withPartial([{ date: day(1), value: 1 }], { date: day(2), value: 2 })).toEqual([
      { date: day(1), value: 1 },
      { date: day(2), value: 2, partial: true },
    ]);
  });
});
