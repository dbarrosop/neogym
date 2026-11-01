import { describe, expect, it } from "bun:test";
import { estimateOneRepMax } from "./strength-metrics";

describe("estimated one-rep max", () => {
  it("uses measured weight for one rep and Epley for higher reps", () => {
    expect(estimateOneRepMax(60, 1)).toBe(60);
    expect(estimateOneRepMax(50, 5)).toBe(50 * (1 + 5 / 30));
  });

  it("ignores zero-rep and bodyweight sets", () => {
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(0, 10)).toBe(0);
  });
});
