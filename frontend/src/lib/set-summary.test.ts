import { describe, expect, it } from "bun:test";
import {
  formatLastTimeCaption,
  formatSet,
  formatSetsSummary,
  formatSetWeight,
  formatTopSet,
  topSet,
} from "./set-summary";

const sets = (weight: unknown, ...reps: number[]) => reps.map((r) => ({ weight, reps: r }));

describe("formatSetsSummary", () => {
  it("shares one weight label when every set uses it", () => {
    expect(formatSetsSummary(sets(140, 6, 7, 6))).toBe("140 kg × 6 · 7 · 6");
    expect(formatSetsSummary(sets("95", 12, 11, 10), { style: "compact" })).toBe(
      "95 × 12 · 11 · 10",
    );
  });

  it("groups consecutive sets at the same weight when the weight changes", () => {
    expect(formatSetsSummary([...sets(100, 8, 8), ...sets(95, 10)])).toBe(
      "100 kg × 8 · 8, 95 kg × 10",
    );
    expect(
      formatSetsSummary([...sets(60, 10), ...sets(80, 8), ...sets(60, 12)], {
        style: "compact",
      }),
    ).toBe("60 × 10, 80 × 8, 60 × 12");
  });

  it("orders by set number when present", () => {
    expect(
      formatSetsSummary([
        { setNumber: 2, weight: 90, reps: 9 },
        { setNumber: 1, weight: 90, reps: 10 },
      ]),
    ).toBe("90 kg × 10 · 9");
  });

  it("labels bodyweight sets and keeps decimal weights", () => {
    expect(formatSetsSummary(sets(0, 20, 15, 15))).toBe("BW × 20 · 15 · 15");
    expect(formatSetsSummary(sets("0.00", 20), { bodyweightLabel: "bodyweight" })).toBe(
      "bodyweight × 20",
    );
    expect(formatSetsSummary(sets("92.50", 5), { style: "compact" })).toBe("92.5 × 5");
    expect(formatSetsSummary(sets(21.25, 5))).toBe("21.25 kg × 5");
  });

  it("marks per-side weights only when a set is weighted", () => {
    expect(formatSetsSummary(sets(28, 9, 8), { perSide: true })).toBe("28 kg × 9 · 8 per side");
    expect(formatSetsSummary(sets(0, 12), { perSide: true })).toBe("BW × 12");
  });

  it("returns null without sets", () => {
    expect(formatSetsSummary([])).toBeNull();
  });
});

describe("single sets and top sets", () => {
  it("formats one set and its weight", () => {
    expect(formatSet({ weight: 140, reps: 7 })).toBe("140 kg × 7");
    expect(formatSet({ weight: 95, reps: 12 }, { style: "compact" })).toBe("95 × 12");
    expect(formatSet({ weight: 20, reps: 10 }, { perSide: true })).toBe("20 kg × 10 per side");
    expect(formatSetWeight(null)).toBe("BW");
    expect(formatSetWeight("abc", { style: "compact" })).toBe("BW");
  });

  it("picks the heaviest set, most reps breaking ties", () => {
    const logged = [
      { weight: 135, reps: 10 },
      { weight: 140, reps: 6 },
      { weight: "140", reps: 7 },
    ];
    expect(topSet(logged)).toEqual({ weight: "140", reps: 7 });
    expect(formatTopSet(logged)).toBe("140 kg × 7");
    expect(formatTopSet(sets(0, 15, 20))).toBe("BW × 20");
    expect(formatTopSet([])).toBeNull();
  });
});

describe("formatLastTimeCaption", () => {
  it("is compact beside logged sets and full when nothing is logged", () => {
    expect(formatLastTimeCaption(sets(135, 10, 9, 8), { hasLoggedSets: true })).toBe(
      "last 135 × 10 · 9 · 8",
    );
    expect(formatLastTimeCaption(sets(180, 11, 11, 10), { hasLoggedSets: false })).toBe(
      "Last time 180 kg × 11 · 11 · 10",
    );
    expect(formatLastTimeCaption(sets(0, 20, 15, 15), { hasLoggedSets: false })).toBe(
      "Last time bodyweight × 20 · 15 · 15",
    );
    expect(formatLastTimeCaption(sets(0, 20), { hasLoggedSets: true })).toBe("last BW × 20");
  });

  it("returns null without a last time", () => {
    expect(formatLastTimeCaption(undefined, { hasLoggedSets: false })).toBeNull();
    expect(formatLastTimeCaption([], { hasLoggedSets: true })).toBeNull();
  });
});
