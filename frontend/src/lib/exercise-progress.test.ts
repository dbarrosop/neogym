import { describe, expect, it } from "bun:test";
import type { CardioMetricSpec } from "@/lib/cardio-schema";
import {
  buildCardioProgress,
  buildStrengthProgress,
  changeFromPrevious,
  formatPercentChange,
  localDateOf,
  pointsInPeriod,
} from "./exercise-progress";

function session(id: string, day: string, sets: [number, number][], hour = 12) {
  const startedAt = new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    hour,
  ).toISOString();
  return {
    workoutSession: { id, startedAt },
    workoutSessionStrengthSets: sets.map(([weight, reps]) => ({ weight: String(weight), reps })),
    workoutSessionCardioEntries: [],
  };
}

describe("buildStrengthProgress", () => {
  it("sums volume, takes the best Epley set and sorts oldest first", () => {
    const points = buildStrengthProgress(
      [
        session("b", "2026-11-12", [
          [140, 6],
          [140, 7],
        ]),
        session("a", "2026-11-05", [[135, 10]]),
      ],
      false,
    );
    expect(points.map((point) => point.sessionId)).toEqual(["a", "b"]);
    expect(points[0]?.date).toBe("2026-11-05");
    expect(points[0]?.volume).toBe(1350);
    expect(points[0]?.oneRm).toBeCloseTo(180, 5);
    expect(points[1]?.volume).toBe(1820);
    expect(points[1]?.oneRm).toBeCloseTo(140 * (1 + 7 / 30), 5);
  });

  it("doubles per-side volume but never the estimated 1RM, uses a single's weight and skips zero reps", () => {
    const [point] = buildStrengthProgress(
      [
        session("s", "2026-11-12", [
          [28, 1],
          [20, 0],
        ]),
      ],
      true,
    );
    expect(point?.volume).toBe(56);
    expect(point?.oneRm).toBe(28);
  });

  it("skips sessions without sets", () => {
    expect(buildStrengthProgress([session("empty", "2026-11-12", [])], false)).toEqual([]);
  });
});

describe("buildCardioProgress", () => {
  const distance: CardioMetricSpec = {
    key: "distance_km",
    label: "Distance",
    unit: "km",
    format: "decimal",
    required: false,
    order: 0,
  };
  const heartRate: CardioMetricSpec = { ...distance, key: "hr", format: "average" };
  const entry = (metrics: Record<string, unknown>) => ({ metrics });
  const rows = [
    {
      ...session("r", "2026-11-12", []),
      workoutSessionCardioEntries: [
        entry({ distance_km: 2, hr: 140 }),
        entry({ distance_km: 3, hr: 150 }),
      ],
    },
    { ...session("none", "2026-11-11", []), workoutSessionCardioEntries: [entry({ hr: 120 })] },
  ];

  it("sums or averages the primary metric per session and skips sessions without it", () => {
    expect(buildCardioProgress(rows, distance).map((point) => point.value)).toEqual([5]);
    expect(buildCardioProgress(rows, heartRate).map((point) => point.value)).toEqual([120, 145]);
  });
});

describe("pointsInPeriod", () => {
  const points = ["2026-08-17", "2026-08-18", "2026-10-16", "2026-11-14", "2026-11-15"].map(
    (date) => ({ date }),
  );

  it("keeps the last N local dates, today included", () => {
    expect(pointsInPeriod(points, 30, "2026-11-14").map((point) => point.date)).toEqual([
      "2026-10-16",
      "2026-11-14",
    ]);
    expect(pointsInPeriod(points, 90, "2026-11-14").map((point) => point.date)).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-10-16",
      "2026-11-14",
    ]);
  });
});

describe("changeFromPrevious", () => {
  it("compares the latest point with the one before it", () => {
    expect(changeFromPrevious([3645, 2660], (v) => v)).toBeCloseTo(-27.02, 2);
    expect(changeFromPrevious([2660], (v) => v)).toBeNull();
    expect(changeFromPrevious([0, 10], (v) => v)).toBeNull();
  });
});

describe("formatPercentChange", () => {
  it("signs the change with a true minus", () => {
    expect(formatPercentChange(-27.02)).toBe("−27.0%");
    expect(formatPercentChange(4.1)).toBe("+4.1%");
  });
});

describe("localDateOf", () => {
  it("uses the local calendar date", () => {
    expect(localDateOf(new Date(2026, 10, 12, 23, 30).toISOString())).toBe("2026-11-12");
  });
});
