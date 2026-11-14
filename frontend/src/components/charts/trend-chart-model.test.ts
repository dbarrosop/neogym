import { describe, expect, test } from "bun:test";
import { metricFormat } from "@/lib/metric-format";
import { dayNumber } from "@/lib/rolling-average";
import { buildTrendChartModel, type TrendChartSeries } from "./trend-chart-model";

const locale = "en-GB";
const weeks = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];
const weekly: TrendChartSeries = {
  id: "volume",
  name: "Volume",
  color: "chart-1",
  points: [
    ...weeks.map((date, index) => ({
      date,
      value: [28_400, 31_000, 30_900, 30_500, 34_000, 48_600][index] ?? 0,
    })),
    { date: "2026-11-02", value: 41_200 },
    { date: "2026-11-09", value: 20_500, partial: true },
  ],
  format: metricFormat.weeklyVolume,
};

describe("trend chart model", () => {
  test("weekly volume: partial week dashed, week ticks, This week so far", () => {
    const model = buildTrendChartModel({
      title: "Weekly strength volume",
      period: "week",
      series: [weekly],
      locale,
    });
    const [line] = model.lines;
    expect(line?.partialKey).toBe("s0p");
    expect(line?.partialX).toBe(dayNumber("2026-11-09"));
    expect(line?.count).toBe(7);
    expect(line?.dotRadius).toBe(3);
    // The dashed segment runs from last week to this week only.
    expect(
      model.rows.filter((row) => row.values["s0p"] !== undefined).map((row) => row.date),
    ).toEqual(["2026-11-02", "2026-11-09"]);
    expect(model.xTicks.map((tick) => [tick.label, tick.anchor])).toEqual([
      ["21 Sep", "start"],
      ["19 Oct", "middle"],
      ["9 Nov", "end"],
    ]);
    expect(model.axes.left?.labels).toEqual(["20k", "40k", "60k"]);
    expect(model.label).toBe(
      "Weekly strength volume, weeks of 21 Sep to 2 Nov: lowest 28.4k, highest 48.6k, " +
        "average 34.9k, latest 41.2k in the week of 2 Nov. This week so far: 20.5k.",
    );
  });

  test("daily readings: the window is the domain, readings outside are dropped", () => {
    const model = buildTrendChartModel({
      title: "Weight",
      domain: { start: "2026-10-14", end: "2026-11-12" },
      axes: { left: { unit: "kg" } },
      series: [
        {
          id: "weight",
          name: "Weight",
          color: "chart-1",
          style: "daily",
          points: [
            { date: "2026-10-10", value: 72.4 },
            { date: "2026-10-14", value: 71.9 },
            { date: "2026-11-12", value: 70.45 },
          ],
          format: metricFormat.weight,
        },
      ],
      locale,
    });
    expect(model.xDomain).toEqual([dayNumber("2026-10-14"), dayNumber("2026-11-12")]);
    expect(model.rows.map((row) => row.date)).toEqual(["2026-10-14", "2026-11-12"]);
    expect(model.xTicks.map((tick) => tick.label)).toEqual(["14 Oct", "28 Oct", "12 Nov"]);
    expect(model.axes.left?.labels).toEqual(["70", "71", "72 kg"]);
    expect(model.lines[0]?.dotRadius).toBe(2.5);
  });

  test("two axes start aligned; one axis rounded with zero when asked", () => {
    const pair = buildTrendChartModel({
      title: "Weight and body fat",
      series: [
        {
          id: "w",
          name: "Weight",
          color: "chart-1",
          points: [
            { date: "2026-10-25", value: 71.6 },
            { date: "2026-11-12", value: 70.85 },
          ],
          format: metricFormat.weight,
        },
        {
          id: "f",
          name: "Body fat",
          color: "chart-2",
          axis: "right",
          points: [
            { date: "2026-10-25", value: 13.2 },
            { date: "2026-11-12", value: 12.6 },
          ],
          format: metricFormat.bodyFat,
        },
      ],
      xTicks: "first-last",
      locale,
    });
    expect(pair.startAligned).toBe(true);
    const left = pair.axes.left;
    const right = pair.axes.right;
    if (!(left && right)) {
      throw new Error("Expected two axes");
    }
    const height = (value: number, [low, high]: [number, number]) => (value - low) / (high - low);
    expect(height(71.6, left.domain)).toBeCloseTo(height(13.2, right.domain), 9);
    expect(pair.xTicks.map((tick) => tick.label)).toEqual(["25 Oct", "12 Nov"]);
    expect(pair.label).toContain(
      "Weight on the left axis, Body fat on the right; both lines start at the same height. " +
        "No readings 26 October to 11 November; the lines join across the gap.",
    );

    const energy = buildTrendChartModel({
      title: "Energy out",
      axes: { left: { includeZero: true } },
      series: [
        {
          id: "r",
          name: "Resting",
          color: "chart-1",
          points: [{ date: "2026-11-11", value: 1_842 }],
          format: metricFormat.kcal,
        },
      ],
      locale,
    });
    expect(energy.axes.left?.labels).toEqual(["0", "1,000", "2,000"]);
    expect(energy.xTicks.map((tick) => tick.label)).toEqual(["11 Nov"]);
  });

  test("index scale spaces sessions evenly; empty input is empty", () => {
    const sessions = buildTrendChartModel({
      title: "Volume",
      period: "session",
      xScale: "index",
      series: [
        {
          id: "v",
          name: "Volume",
          color: "chart-1",
          points: ["2026-10-08", "2026-10-09", "2026-10-22", "2026-11-12"].map((date) => ({
            date,
            value: 3_000,
          })),
          format: metricFormat.volume,
        },
      ],
      locale,
    });
    expect(sessions.rows.map((row) => row.x)).toEqual([0, 1, 2, 3]);
    expect(sessions.xTicks.map((tick) => tick.label)).toEqual(["8 Oct", "9 Oct", "12 Nov"]);
    expect(buildTrendChartModel({ title: "Nothing", series: [] }).isEmpty).toBe(true);
  });
});
