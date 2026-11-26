import { describe, expect, test } from "bun:test";
import {
  formatApprox,
  formatChartDate,
  formatCompact,
  formatDateRange,
  formatDuration,
  formatKcal,
  formatKg,
  formatNumber,
  formatPercent,
  formatSets,
  formatSignedDelta,
  formatSignedKcal,
  formatWeekOf,
  MINUS,
} from "./metric-format";

const enGB = { locale: "en-GB" };

describe("metric formatters", () => {
  test("numbers group thousands and use the minus sign, never −0", () => {
    expect(formatNumber(2_312.4, enGB)).toBe("2,312");
    expect(formatNumber(-851, enGB)).toBe(`${MINUS}851`);
    expect(formatNumber(-0.3, enGB)).toBe("0");
    expect(formatNumber(0.04, { maxDecimals: 1, minDecimals: 1, signed: true, ...enGB })).toBe(
      "0.0",
    );
  });

  test("kilograms and percent", () => {
    expect(formatKg(70.85, enGB)).toBe("70.85 kg");
    expect(formatKg(71, enGB)).toBe("71 kg");
    expect(formatKg(70.72, { decimals: 1, minDecimals: 1, ...enGB })).toBe("70.7 kg");
    expect(formatKg(166.66, { decimals: 1, ...enGB })).toBe("166.7 kg");
    expect(formatPercent(12.6, enGB)).toBe("12.6 %");
    expect(formatPercent(13, enGB)).toBe("13.0 %");
  });

  test("kilocalories, plain and signed", () => {
    expect(formatKcal(2_370.4, enGB)).toBe("2,370 kcal");
    expect(formatSignedKcal(-371, enGB)).toBe(`${MINUS}371 kcal`);
    expect(formatSignedKcal(251, enGB)).toBe("+251 kcal");
    expect(formatSignedKcal(0.2, enGB)).toBe("0 kcal");
  });

  test("compact volume and sets", () => {
    expect(formatCompact(48_600, enGB)).toBe("48.6k");
    expect(formatCompact(20_500, enGB)).toBe("20.5k");
    expect(formatCompact(120_000, enGB)).toBe("120k");
    expect(formatCompact(3_500, enGB)).toBe("3,500");
    expect(formatSets(11.5, enGB)).toBe("11.5");
    expect(formatSets(12, enGB)).toBe("12");
  });

  test("signed deltas keep their decimals and leave zero unsigned", () => {
    expect(formatSignedDelta(-1.04, enGB)).toBe(`${MINUS}1.0`);
    expect(formatSignedDelta(0.44, enGB)).toBe("+0.4");
    expect(formatSignedDelta(0, enGB)).toBe("0.0");
    expect(formatSignedDelta(-0.02, enGB)).toBe("0.0");
  });

  test("approximate values", () => {
    expect(formatApprox(formatKcal(2_312, enGB))).toBe("≈ 2,312 kcal");
    expect(formatApprox(formatSignedKcal(-851, enGB))).toBe(`≈ ${MINUS}851 kcal`);
  });

  test("durations", () => {
    expect(formatDuration(2_100)).toBe("35:00");
    expect(formatDuration(3_723)).toBe("1:02:03");
  });

  test("chart dates follow the locale", () => {
    expect(formatChartDate("2026-11-12", enGB)).toBe("12 Nov");
    expect(formatChartDate("2026-11-12", { locale: "en-US" })).toBe("Nov 12");
    expect(formatChartDate("2026-11-12", { weekday: true, ...enGB })).toBe("Thu 12 Nov");
    expect(formatChartDate("2026-11-12", { month: "long", ...enGB })).toBe("12 November");
    expect(formatWeekOf("2026-09-21", enGB)).toBe("Week of 21 Sep");
    expect(formatChartDate("not a date", enGB)).toBe("not a date");
  });

  test("date ranges read in words", () => {
    expect(formatDateRange("2026-11-02", "2026-11-06", { month: "long", ...enGB })).toBe(
      "2 to 6 November",
    );
    expect(formatDateRange("2026-10-30", "2026-11-02", { month: "long", ...enGB })).toBe(
      "30 October to 2 November",
    );
    expect(formatDateRange("2026-11-04", "2026-11-04", { month: "long", ...enGB })).toBe(
      "4 November",
    );
    expect(formatDateRange("2026-11-02", "2026-11-06", { month: "long", locale: "en-US" })).toBe(
      "November 2 to 6",
    );
  });
});
