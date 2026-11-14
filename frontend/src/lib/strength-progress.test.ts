import { describe, expect, it } from "bun:test";
import { localDateToDate } from "@/lib/nutrition";
import {
  buildWeeklyStrength,
  recentExerciseTrends,
  type StrengthProgressRow,
  strengthPeriodStart,
  weekStartOf,
} from "./strength-progress";

const FIRST_LETTER = /^\w/;

function startedAt(day: string, hour = 12): string {
  const date = localDateToDate(day);
  if (!date) {
    throw new Error(`Bad date ${day}`);
  }
  date.setHours(hour);
  return date.toISOString();
}

function row(
  day: string,
  exercise: string,
  volume: number | string,
  estimatedOneRepMax: number | string | null = null,
  hour = 12,
): StrengthProgressRow {
  return {
    exerciseId: exercise,
    sessionId: `${exercise}-${day}-${hour}`,
    startedAt: startedAt(day, hour),
    volume,
    estimatedOneRepMax,
    exercise: { id: exercise, name: exercise.replace(FIRST_LETTER, (c) => c.toUpperCase()) },
  };
}

describe("Monday weeks", () => {
  it("starts each week on Monday, across months, years and DST changes", () => {
    expect(weekStartOf("2026-11-12")).toBe("2026-11-09"); // Thursday
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09"); // Monday
    expect(weekStartOf("2026-11-15")).toBe("2026-11-09"); // Sunday
    expect(weekStartOf("2026-03-08")).toBe("2026-03-02"); // US DST starts
    expect(weekStartOf("2026-03-29")).toBe("2026-03-23"); // EU DST starts
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
    expect(weekStartOf("1970-01-01")).toBe("1969-12-29");
  });

  it("opens a period on the Monday that makes it `weeks` weeks long", () => {
    expect(strengthPeriodStart("2026-11-12", 8)).toBe("2026-09-21");
    expect(strengthPeriodStart("2026-11-09", 1)).toBe("2026-11-09");
    expect(strengthPeriodStart("2026-11-15", 26)).toBe("2026-05-18");
  });
});

describe("weekly strength volume", () => {
  const rows = [
    row("2026-09-22", "squat", 3_000),
    row("2026-09-24", "bench", "1500.5"),
    row("2026-10-27", "squat", 48_600),
    row("2026-11-10", "squat", 20_500),
    row("2026-11-14", "bench", 1_000), // after today: ignored
  ];
  const weekly = buildWeeklyStrength(rows, { today: "2026-11-12" });

  it("fills every week from the first with volume through this week", () => {
    expect(weekly.weeks).toEqual([
      { weekStart: "2026-09-21", volume: 4_500.5 },
      { weekStart: "2026-09-28", volume: 0 },
      { weekStart: "2026-10-05", volume: 0 },
      { weekStart: "2026-10-12", volume: 0 },
      { weekStart: "2026-10-19", volume: 0 },
      { weekStart: "2026-10-26", volume: 48_600 },
      { weekStart: "2026-11-02", volume: 0 },
      { weekStart: "2026-11-09", volume: 20_500 },
    ]);
    expect(weekly.fullWeeks).toHaveLength(7);
    expect(weekly.thisWeek).toEqual({ weekStart: "2026-11-09", volume: 20_500 });
    expect(weekly.bestWeek).toEqual({ weekStart: "2026-10-26", volume: 48_600 });
  });

  it("plots full weeks with this week as the partial last point", () => {
    expect(weekly.points.at(-2)).toEqual({ date: "2026-11-02", value: 0 });
    expect(weekly.points.at(-1)).toEqual({ date: "2026-11-09", value: 20_500, partial: true });
    expect(weekly.points.filter((point) => "partial" in point)).toHaveLength(1);
  });

  it("keeps an empty current week as a zero partial point", () => {
    const monday = buildWeeklyStrength([row("2026-11-05", "squat", 900)], {
      today: "2026-11-09",
    });
    expect(monday.thisWeek).toEqual({ weekStart: "2026-11-09", volume: 0 });
    expect(monday.bestWeek).toEqual({ weekStart: "2026-11-02", volume: 900 });
    expect(monday.points).toEqual([
      { date: "2026-11-02", value: 900 },
      { date: "2026-11-09", value: 0, partial: true },
    ]);
  });

  it("keeps the earliest of equal best weeks and has nothing without rows", () => {
    const tie = buildWeeklyStrength([row("2026-11-03", "a", 500), row("2026-11-10", "a", 500)], {
      today: "2026-11-12",
    });
    expect(tie.bestWeek?.weekStart).toBe("2026-11-02");
    expect(buildWeeklyStrength([], { today: "2026-11-12" })).toEqual({
      weeks: [],
      fullWeeks: [],
      thisWeek: null,
      bestWeek: null,
      points: [],
    });
  });

  it("buckets sessions by their local start date", () => {
    // 23:30 on Sunday stays in that week; 00:30 on Monday opens the next.
    const late = buildWeeklyStrength(
      [row("2026-11-08", "squat", 100, null, 23), row("2026-11-09", "squat", 200, null, 0)],
      { today: "2026-11-09" },
    );
    expect(late.weeks).toEqual([
      { weekStart: "2026-11-02", volume: 100 },
      { weekStart: "2026-11-09", volume: 200 },
    ]);
  });
});

describe("recent exercise trends", () => {
  const rows = [
    row("2026-10-08", "deadlift", 3_500, 166.7),
    row("2026-10-22", "deadlift", 3_000, "171.2"),
    row("2026-11-12", "deadlift", 2_660, 172.7, 9),
    row("2026-11-12", "deadlift", 400, 180, 18), // second session the same day
    row("2026-11-02", "bench", 2_100, null),
    row("2026-11-03", "bench", 0, 0),
    row("2026-10-20", "expired", 900, 100), // last logged before the ten dates
    row("2026-11-13", "tomorrow", 900, 100),
  ];
  const trends = recentExerciseTrends(rows, { today: "2026-11-12" });

  it("keeps exercises logged in the last ten local dates, by name", () => {
    expect(trends.map((trend) => trend.name)).toEqual(["Bench", "Deadlift"]);
    expect(recentExerciseTrends(rows, { today: "2026-11-11" }).map((t) => t.name)).toEqual([
      "Bench",
    ]);
    expect(recentExerciseTrends(rows, { today: "2026-11-13" }).map((t) => t.name)).toEqual([
      "Deadlift",
      "Tomorrow",
    ]);
  });

  it("plots one point per date: volume summed, the best estimate kept", () => {
    const deadlift = trends.find((trend) => trend.id === "deadlift");
    expect(deadlift?.points).toEqual([
      { date: "2026-10-08", volume: 3_500, estimatedOneRepMax: 166.7 },
      { date: "2026-10-22", volume: 3_000, estimatedOneRepMax: 171.2 },
      { date: "2026-11-12", volume: 3_060, estimatedOneRepMax: 180 },
    ]);
    expect(deadlift?.latestEstimatedOneRepMax).toBe(180);
    expect(deadlift?.bestEstimatedOneRepMax).toBe(180);
    expect(deadlift?.latestVolume).toBe(3_060);
    expect(deadlift?.bestVolume).toBe(3_500);
  });

  it("leaves missing or zero estimates out and keeps the volume", () => {
    const bench = trends.find((trend) => trend.id === "bench");
    expect(bench?.points).toEqual([
      { date: "2026-11-02", volume: 2_100, estimatedOneRepMax: null },
      { date: "2026-11-03", volume: 0, estimatedOneRepMax: null },
    ]);
    expect(bench?.latestEstimatedOneRepMax).toBeNull();
    expect(bench?.bestEstimatedOneRepMax).toBeNull();
    expect(bench?.latestVolume).toBe(0);
    expect(bench?.bestVolume).toBe(2_100);
  });
});
