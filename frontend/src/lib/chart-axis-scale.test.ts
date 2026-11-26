import { describe, expect, test } from "bun:test";
import {
  axisLabel,
  axisLabels,
  axisMax,
  axisMid,
  axisScale,
  axisTicks,
  niceStep,
  roundedAxisScale,
  startAlignedAxisScales,
} from "./chart-axis-scale";

// Mirrors ios/NeoGym/Tests/NeoGymKitTests/ChartAxisScaleTests.swift.
const enGB = { locale: "en-GB" };

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected a value");
  }
  return value;
}

describe("chart axis scale", () => {
  test("nice steps round up to 1, 2, 2.5 or 5 × 10ⁿ", () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.3)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(3.4)).toBe(5);
    expect(niceStep(6)).toBe(10);
    expect(niceStep(13_300)).toBe(20_000);
  });

  test("a count axis starts at zero", () => {
    const scale = required(roundedAxisScale([3, 7.5, 11], { includeZero: true }));
    expect(axisTicks(scale)).toEqual([0, 10, 20]);
    const tight = required(roundedAxisScale([3, 9, 10], { includeZero: true }));
    expect(axisTicks(tight)).toEqual([0, 5, 10]);
  });

  test("a body weight axis hugs the readings", () => {
    const scale = required(roundedAxisScale([70.45, 71.25, 71.9]));
    expect(axisTicks(scale)).toEqual([70, 71, 72]);
    expect(axisLabel(scale, 71, enGB)).toBe("71");
  });

  test("the range always contains the data", () => {
    for (const values of [
      [22_000, 48_596],
      [1_812, 2_640],
      [0.4, 0.9],
      [-1_180, 360],
      [158, 186],
    ]) {
      const scale = required(roundedAxisScale(values));
      expect(scale.min).toBeLessThanOrEqual(Math.min(...values));
      expect(axisMax(scale)).toBeGreaterThanOrEqual(Math.max(...values));
    }
  });

  test("a single value gets a range", () => {
    const scale = required(roundedAxisScale([70]));
    expect(scale.min).toBeLessThan(70);
    expect(axisMax(scale)).toBeGreaterThan(70);
    const zero = required(roundedAxisScale([0], { includeZero: true }));
    expect(zero.min).toBe(0);
    expect(axisMax(zero)).toBeGreaterThan(0);
  });

  test("no values have no scale", () => {
    expect(roundedAxisScale([])).toBeNull();
    expect(roundedAxisScale([Number.NaN])).toBeNull();
  });

  test("labels are bare compact numbers", () => {
    const volume = required(roundedAxisScale([22_000, 48_596]));
    expect(axisLabel(volume, axisMax(volume), enGB)).toBe("60k");
    expect(axisLabel(volume, axisMid(volume), enGB)).toBe("40k");
    const energy = axisScale(0, 1_000);
    expect(axisLabel(energy, 2_000, enGB)).toBe("2,000");
    expect(axisLabel(energy, 0, enGB)).toBe("0");
    const fractional = axisScale(0, 2.5);
    expect(axisLabel(fractional, 2.5, enGB)).toBe("2.5");
    expect(axisLabel(fractional, 5, enGB)).toBe("5");
  });

  test("close ticks keep distinct labels, including compact-range and start-aligned axes", () => {
    const volume = required(roundedAxisScale([12_000, 12_025, 12_050]));
    expect(axisLabels(volume, enGB)).toEqual(["12,000", "12,025", "12,050"]);
    const [left, right] = required(startAlignedAxisScales([71.234, 71.24], [12_000, 12_018]));
    for (const scale of [left, right]) {
      expect(new Set(axisLabels(scale, enGB)).size).toBe(3);
    }
    expect(axisLabels(axisScale(-0.002, 0.002), enGB)).toEqual(["−0.002", "0", "+0.002"]);
  });

  test("the Energy board's axes: 0 · 1,000 · 2,000 out, 1,000 · 2,000 · 3,000 consumed", () => {
    const out = required(roundedAxisScale([531, 679, 1_346, 1_892], { includeZero: true }));
    expect(axisLabels(out, enGB)).toEqual(["0", "1,000", "2,000"]);
    const consumed = required(roundedAxisScale([1_461, 2_140, 2_584]));
    expect(axisLabels(consumed, enGB)).toEqual(["1,000", "2,000", "3,000"]);
  });

  test("duration axes use whole-minute ticks in the values' notation", () => {
    // 26:30 to 35:00 per session, stored in seconds.
    const rowing = required(roundedAxisScale([1_590, 1_800, 2_100], { format: "duration" }));
    expect(rowing.step % 60).toBe(0);
    expect(rowing.min).toBeLessThanOrEqual(1_590);
    expect(axisMax(rowing)).toBeGreaterThanOrEqual(2_100);
    expect(axisLabels(rowing)).toEqual(["25:00", "30:00", "35:00"]);

    const single = required(roundedAxisScale([2_100], { format: "duration" }));
    expect(single.step % 60).toBe(0);
    expect(single.min).toBeLessThan(2_100);
    expect(axisMax(single)).toBeGreaterThan(2_100);

    const long = required(roundedAxisScale([3_000, 11_000], { format: "duration" }));
    expect(long.step % 60).toBe(0);
    // Once the axis reaches an hour, every label is h:mm:ss.
    expect(axisLabels(long)).toEqual(["0:00:00", "2:00:00", "4:00:00"]);
    expect(axisLabel(axisScale(0, 1_800, "duration"), 1_800)).toBe("0:30:00");
    expect(axisLabel(axisScale(0, 1_800, "duration"), 3_600)).toBe("1:00:00");
    expect(axisLabel(axisScale(0, 60, "duration"), 0)).toBe("0:00");
    expect(roundedAxisScale([1_590, 2_100])?.format).toBe("number");
  });

  test("an axis crossing zero shows signs with the minus sign", () => {
    const net = required(roundedAxisScale([-1_180, 360], { includeZero: true }));
    expect(net.min).toBeLessThan(0);
    expect(axisLabel(net, axisMax(net), enGB).startsWith("+")).toBe(true);
    expect(axisLabel(net, net.min, enGB).startsWith("−")).toBe(true);
    expect(axisLabel(axisScale(-2_000, 2_000), 0, enGB)).toBe("0");
    // An all-negative net axis (the Energy board): 0 · −500 · −1,000.
    const deficit = required(roundedAxisScale([-980, -120], { includeZero: true }));
    expect(axisLabels(deficit, enGB)).toEqual(["−1,000", "−500", "0"]);
  });

  test("start-aligned axes put both first values at the same height", () => {
    const volume = [3_500, 3_000, 2_800, 3_100, 4_000, 2_660];
    const estimate = [166.7, 169, 173.3, 175.5, 180, 172.7];
    const [left, right] = required(startAlignedAxisScales(volume, estimate));
    for (const [scale, values] of [
      [left, volume],
      [right, estimate],
    ] as const) {
      expect(scale.min).toBeLessThanOrEqual(Math.min(...values));
      expect(axisMax(scale)).toBeGreaterThanOrEqual(Math.max(...values));
    }
    const leftHeight = (3_500 - left.min) / (axisMax(left) - left.min);
    const rightHeight = (166.7 - right.min) / (axisMax(right) - right.min);
    expect(Math.abs(leftHeight - rightHeight)).toBeLessThan(1e-9);
    expect(axisLabel(left, axisMax(left), enGB)).not.toContain(".");
  });

  test("start-aligned axes handle a flat series and missing data", () => {
    const [weight, fat] = required(startAlignedAxisScales([70, 70], [13.2, 12.6, 12.9]));
    expect(weight.min).toBeLessThan(70);
    expect(axisMax(weight)).toBeGreaterThan(70);
    const weightHeight = (70 - weight.min) / (axisMax(weight) - weight.min);
    const fatHeight = (13.2 - fat.min) / (axisMax(fat) - fat.min);
    expect(Math.abs(weightHeight - fatHeight)).toBeLessThan(1e-9);
    expect(startAlignedAxisScales([], [1, 2])).toBeNull();
  });

  test("start-aligned labels keep fixed decimals so the column reads evenly", () => {
    const [weight, fat] = required(startAlignedAxisScales([71.8, 71.6, 70.7], [13.3, 13.1, 12.6]));
    for (const labels of [axisLabels(weight, enGB), axisLabels(fat, enGB)]) {
      const decimals = labels.map((label) => label.split(".")[1]?.length ?? 0);
      expect(new Set(decimals).size).toBe(1);
      expect(decimals[0]).toBe(1);
    }
  });
});
