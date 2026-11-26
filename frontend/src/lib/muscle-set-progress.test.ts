import { describe, expect, it } from "bun:test";
import {
  latestMuscleSets,
  type MuscleSetRow,
  muscleHistory,
  muscleName,
  muscleSetBar,
  muscleSetOverview,
} from "./muscle-set-progress";

function row(day: string, muscleGroup: string, direct: number, indirect: number): MuscleSetRow {
  return {
    day,
    muscleGroup,
    rollingDirectSets: direct,
    rollingIndirectSets: indirect,
    rollingWeightedSets: String(direct + indirect / 2),
  };
}

// The Web-Progress board's trailing seven days on 12 Nov.
const latest = [
  ["quadriceps", 15, 0],
  ["triceps", 6, 14],
  ["biceps", 6, 12],
  ["front_delts", 6, 11],
  ["chest", 8, 6],
  ["lats", 6, 9],
  ["middle_back", 6, 6],
  ["side_delts", 6, 6],
  ["glutes", 0, 15],
  ["hamstrings", 3, 9],
  ["abdominals", 6, 0],
  ["calves", 6, 0],
  ["lower_back", 0, 9],
  ["rear_delts", 0, 9],
  ["traps", 3, 0],
  ["shoulders", 0, 3],
] as const;
const rows: MuscleSetRow[] = [
  row("2026-11-11", "quadriceps", 9, 0),
  row("2026-11-11", "forearms", 2, 0),
  ...latest.map(([group, direct, indirect]) => row("2026-11-12", group, direct, indirect)),
  row("2026-11-12", "forearms", 0, 0),
];

describe("muscle names", () => {
  it("reads groups as sentence case and names unspecified shoulders", () => {
    expect(muscleName("front_delts")).toBe("Front delts");
    expect(muscleName("lower_back")).toBe("Lower back");
    expect(muscleName("shoulders")).toBe("Shoulders (unspecified)");
  });
});

describe("latest muscle sets", () => {
  it("lists every muscle on the latest date, most weighted sets first, zeros last", () => {
    const muscles = latestMuscleSets(rows);
    expect(muscles.map((muscle) => [muscle.name, muscle.weighted])).toEqual([
      ["Quadriceps", 15],
      ["Triceps", 13],
      ["Biceps", 12],
      ["Front delts", 11.5],
      ["Chest", 11],
      ["Lats", 10.5],
      ["Middle back", 9],
      ["Side delts", 9],
      ["Glutes", 7.5],
      ["Hamstrings", 7.5],
      ["Abdominals", 6],
      ["Calves", 6],
      ["Lower back", 4.5],
      ["Rear delts", 4.5],
      ["Traps", 3],
      ["Shoulders (unspecified)", 1.5],
      ["Forearms", 0],
    ]);
    expect(muscles[1]).toEqual({
      group: "triceps",
      name: "Triceps",
      direct: 6,
      indirect: 14,
      weighted: 13,
    });
  });

  it("is empty without rows", () => {
    expect(latestMuscleSets([])).toEqual([]);
  });
});

describe("muscle history", () => {
  it("plots one muscle's weighted sets by date, oldest first", () => {
    expect(muscleHistory([...rows].reverse(), "quadriceps")).toEqual([
      { date: "2026-11-11", value: 9 },
      { date: "2026-11-12", value: 15 },
    ]);
  });
});

describe("muscle set bars", () => {
  it("scales to the largest weighted total with no floor", () => {
    const muscles = latestMuscleSets(rows);
    const max = muscles[0]?.weighted ?? 0;
    const bar = (index: number) => {
      const muscle = muscles[index];
      if (!muscle) {
        throw new Error(`No muscle ${index}`);
      }
      return muscleSetBar(muscle, max);
    };
    expect(bar(0)).toEqual({ direct: 1, halfIndirect: 0 });
    expect(bar(1).direct).toBeCloseTo(0.4);
    expect(bar(1).halfIndirect).toBeCloseTo(7 / 15);
    expect(bar(8)).toEqual({ direct: 0, halfIndirect: 0.5 });
  });

  it("never overflows the track and survives an empty week", () => {
    const muscle = { group: "chest", name: "Chest", direct: 4, indirect: 4, weighted: 6 };
    const capped = muscleSetBar(muscle, 5);
    expect(capped.direct).toBe(0.8);
    expect(capped.halfIndirect).toBeCloseTo(0.2);
    expect(muscleSetBar({ ...muscle, direct: 0, indirect: 0, weighted: 0 }, 0)).toEqual({
      direct: 0,
      halfIndirect: 0,
    });
  });
});

describe("muscle set overview", () => {
  it("totals the week, ranks the top six and the three least trained after them", () => {
    const overview = muscleSetOverview(rows);
    expect(overview?.totalWeightedSets).toBe(131.5);
    expect(overview?.mostTrained.map((muscle) => [muscle.name, muscle.weighted])).toEqual([
      ["Quadriceps", 15],
      ["Triceps", 13],
      ["Biceps", 12],
      ["Front delts", 11.5],
      ["Chest", 11],
      ["Lats", 10.5],
    ]);
    // Unspecified shoulders (1.5) and untrained muscles stay out of "Lowest".
    expect(overview?.leastTrained.map((muscle) => [muscle.name, muscle.weighted])).toEqual([
      ["Traps", 3],
      ["Lower back", 4.5],
      ["Rear delts", 4.5],
    ]);
  });

  it("has nothing to show without sets in the last seven days", () => {
    expect(muscleSetOverview([])).toBeNull();
    expect(muscleSetOverview([row("2026-11-12", "chest", 0, 0)])).toBeNull();
  });

  it("lists no lowest muscles when every trained muscle is in the top six", () => {
    const overview = muscleSetOverview([row("2026-11-12", "chest", 3, 0)]);
    expect(overview?.mostTrained.map((muscle) => muscle.name)).toEqual(["Chest"]);
    expect(overview?.leastTrained).toEqual([]);
  });
});
