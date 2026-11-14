import { describe, expect, test } from "bun:test";
import { readingGaps, type SummarySeries, summarizeChart } from "./chart-summary";
import { formatCompact, formatDuration, formatKcal, formatKg } from "./metric-format";

// Mirrors ios/NeoGym/Tests/NeoGymKitTests/ChartAccessibilitySummaryTests.swift,
// framed with the chart's title as on the web boards.
const locale = "en-GB";
const kcal = (value: number) => formatKcal(value, { locale });
const day = (value: number) => `2026-11-${String(value).padStart(2, "0")}`;

describe("chart summaries", () => {
  test("a partial today is left out of the stats and named last", () => {
    const consumed: SummarySeries = {
      name: "Consumed",
      points: [
        { date: day(9), value: 2_140 },
        { date: day(10), value: 2_584 },
        { date: day(11), value: 2_386 },
        { date: day(12), value: 650, partial: true },
      ],
      format: kcal,
    };
    expect(summarizeChart({ title: "Calories consumed per day", series: [consumed], locale })).toBe(
      "Calories consumed per day, 9 Nov to 11 Nov: lowest 2,140 kcal, highest 2,584 kcal, " +
        "average 2,370 kcal, latest 2,386 kcal on 11 Nov. Today so far: 650 kcal.",
    );
  });

  test("several partial series share one closing sentence", () => {
    const resting: SummarySeries = {
      name: "Resting",
      points: [
        { date: day(11), value: 1_842 },
        { date: day(12), value: 679, partial: true },
      ],
      format: kcal,
    };
    const active: SummarySeries = {
      name: "Active",
      points: [
        { date: day(11), value: 728 },
        { date: day(12), value: 531, partial: true },
      ],
      format: kcal,
    };
    expect(summarizeChart({ title: "Energy out per day", series: [resting, active], locale })).toBe(
      "Energy out per day, on 11 Nov. Resting: latest 1,842 kcal on 11 Nov. " +
        "Active: latest 728 kcal on 11 Nov. Today so far: Resting 679 kcal, Active 531 kcal.",
    );
  });

  test("weekly series name weeks and this week so far", () => {
    const volume: SummarySeries = {
      name: "Volume",
      points: [
        { date: day(2), value: 28_400 },
        { date: day(9), value: 48_600 },
        { date: day(16), value: 20_500, partial: true },
      ],
      format: (value) => formatCompact(value, { locale }),
    };
    expect(
      summarizeChart({
        title: "Weekly strength volume",
        series: [volume],
        period: "week",
        locale,
      }),
    ).toBe(
      "Weekly strength volume, weeks of 2 Nov to 9 Nov: lowest 28.4k, highest 48.6k, " +
        "average 38.5k, latest 48.6k in the week of 9 Nov. This week so far: 20.5k.",
    );
  });

  test("a rolling-average series leaves out its own average", () => {
    const daily: SummarySeries = {
      name: "Daily",
      points: [
        { date: day(9), value: 2_140 },
        { date: day(10), value: 2_584 },
        { date: day(11), value: 2_386 },
        { date: day(12), value: 650, partial: true },
      ],
      format: kcal,
    };
    const average: SummarySeries = {
      name: "7-day avg",
      points: [
        { date: day(10), value: 2_362 },
        { date: day(11), value: 2_370 },
      ],
      rollingAverage: true,
      format: kcal,
    };
    // One partial series goes unnamed; the average line reports no average of its own.
    expect(summarizeChart({ title: "Consumed", series: [daily, average], locale })).toBe(
      "Consumed, 9 Nov to 11 Nov. Daily: lowest 2,140 kcal, highest 2,584 kcal, " +
        "average 2,370 kcal, latest 2,386 kcal on 11 Nov. 7-day avg: lowest 2,362 kcal, " +
        "highest 2,370 kcal, latest 2,370 kcal on 11 Nov. Today so far: 650 kcal.",
    );
  });

  test("only partial points, no partial points, and nothing at all", () => {
    const todayOnly: SummarySeries = {
      name: "Consumed",
      points: [{ date: day(12), value: 650, partial: true }],
      format: kcal,
    };
    expect(summarizeChart({ title: "Consumed", series: [todayOnly], locale })).toBe(
      "Consumed. Today so far: 650 kcal.",
    );
    const complete: SummarySeries = {
      name: "Duration",
      points: [
        { date: day(10), value: 2_100 },
        { date: day(3), value: 1_590 },
      ],
      format: formatDuration,
    };
    expect(
      summarizeChart({
        title: "Rowing machine, time per session",
        series: [complete],
        period: "session",
        locale,
      }),
    ).toBe(
      "Rowing machine, time per session, 3 Nov to 10 Nov: lowest 26:30, highest 35:00, " +
        "average 30:45, latest 35:00 on 10 Nov.",
    );
    expect(summarizeChart({ title: "Weight", series: [], locale })).toBe(
      "Weight. No readings in this period.",
    );
  });

  test("interior runs without readings are named as joined gaps", () => {
    const readings = [
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    ]
      .map((date) => ({ date: `2026-10-${date}`, value: 71 }))
      .concat([1, 7, 8, 9, 10, 11, 12].map((date) => ({ date: day(date), value: 70.5 })));
    const weight: SummarySeries = {
      name: "Daily",
      points: readings,
      format: (value) => formatKg(value, { locale }),
    };
    const average: SummarySeries = {
      name: "7-day avg",
      points: readings,
      rollingAverage: true,
      format: (value) => formatKg(value, { locale }),
    };
    expect(readingGaps([weight, average])).toEqual([
      { start: "2026-11-02", end: "2026-11-06", days: 5 },
    ]);
    expect(
      summarizeChart({
        title: "Weight, daily readings and 7-day average",
        series: [weight, average],
        locale,
      }),
    ).toBe(
      "Weight, daily readings and 7-day average, 12 Oct to 12 Nov. Daily: lowest 70.5 kg, " +
        "highest 71 kg, average 70.87 kg, latest 70.5 kg on 12 Nov. 7-day avg: lowest 70.5 kg, " +
        "highest 71 kg, latest 70.5 kg on 12 Nov. No readings 2 to 6 November; the lines join " +
        "across the gap.",
    );
  });

  test("short gaps stay unnamed and long lists are capped", () => {
    const sparse: SummarySeries = {
      name: "Weight",
      points: [1, 3, 8, 12, 17, 21, 26].map((date) => ({ date: day(date), value: 70 })),
      format: (value) => formatKg(value, { locale }),
    };
    expect(readingGaps([sparse])).toHaveLength(5);
    expect(summarizeChart({ title: "Weight", series: [sparse], maxGaps: 2, locale })).toBe(
      "Weight, 1 Nov to 26 Nov: lowest 70 kg, highest 70 kg, average 70 kg, latest 70 kg on " +
        "26 Nov. No readings 4 to 7 November, 9 to 11 November and 3 more gaps; the line joins " +
        "across the gaps.",
    );
    expect(summarizeChart({ title: "Weight", series: [sparse], minGapDays: 0, locale })).toBe(
      "Weight, 1 Nov to 26 Nov: lowest 70 kg, highest 70 kg, average 70 kg, latest 70 kg on 26 Nov.",
    );
  });

  test("a note follows the statistics", () => {
    const series: SummarySeries[] = [
      {
        name: "Volume",
        points: [
          { date: "2026-10-08", value: 3_500 },
          { date: day(12), value: 2_660 },
        ],
        format: (value) => `${formatKcal(value, { locale }).replace(" kcal", "")} kg`,
      },
    ];
    expect(
      summarizeChart({
        title: "Romanian Deadlift",
        series,
        note: "Both lines start at the same height.",
        period: "session",
        locale,
      }),
    ).toBe(
      "Romanian Deadlift, 8 Oct to 12 Nov: lowest 2,660 kg, highest 3,500 kg, average 3,080 kg, " +
        "latest 2,660 kg on 12 Nov. Both lines start at the same height.",
    );
  });
});
