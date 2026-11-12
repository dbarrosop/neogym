import { describe, expect, it } from "bun:test";
import { calculateDailyEnergyBalance, calculateDailyEnergyProjection } from "./daily-energy";

const today = "2026-11-02";
const input = {
  date: today,
  today,
  caloriesIn: 2000,
  dailyEnergy: { energyOn: today, activeKcal: "400", restingKcal: "1000" },
  history: [
    { energyOn: "2026-11-01", restingKcal: "1700" },
    { energyOn: "2026-10-26", restingKcal: "1900" },
  ],
};

describe("today energy projection", () => {
  it("averages available previous dates, adds only recorded activity, and keeps actuals unchanged", () => {
    expect(calculateDailyEnergyProjection(input)).toEqual({
      estimatedBurnedKcal: 2200,
      estimatedNetKcal: -200,
      restingAverageKcal: 1800,
      historyDayCount: 2,
    });
    expect(
      calculateDailyEnergyBalance({
        caloriesIn: 2000,
        activeKcal: 400,
        restingKcal: 1000,
        hasEnergyEntry: true,
      }).net,
    ).toBe(600);
  });

  it("includes all seven previous local dates, including across DST and year boundaries", () => {
    const history = [26, 27, 28, 29, 30, 31].map((day) => ({
      energyOn: `2026-10-${day}`,
      restingKcal: 1800,
    }));
    history.push({ energyOn: "2026-11-01", restingKcal: 1800 });
    expect(calculateDailyEnergyProjection({ ...input, history })?.historyDayCount).toBe(7);
    expect(
      calculateDailyEnergyProjection({
        ...input,
        date: "2027-01-01",
        today: "2027-01-01",
        dailyEnergy: { energyOn: "2027-01-01", activeKcal: "0", restingKcal: "0" },
        history: [{ energyOn: "2026-12-25", restingKcal: "1800" }],
      })?.estimatedBurnedKcal,
    ).toBe(1800);
  });

  it("ignores today, future, old, missing, zero, invalid and duplicate historical values", () => {
    expect(
      calculateDailyEnergyProjection({
        ...input,
        history: [
          { energyOn: today, restingKcal: "100" },
          { energyOn: "2026-11-03", restingKcal: "9000" },
          { energyOn: "2026-10-25", restingKcal: "9000" },
          { energyOn: "2026-10-26", restingKcal: "" },
          { energyOn: "2026-10-27", restingKcal: "0" },
          { energyOn: "2026-10-28", restingKcal: "-1" },
          { energyOn: "2026-10-29", restingKcal: "NaN" },
          { energyOn: "2026-10-30", restingKcal: "30000" },
          { energyOn: "2026-10-31", restingKcal: null },
          { energyOn: "2026-11-01", restingKcal: "1800,50" },
          { energyOn: "2026-11-01", restingKcal: "9000" },
        ],
      }),
    ).toMatchObject({ restingAverageKcal: 1800.5, historyDayCount: 1 });
  });

  it("floors resting at the already recorded value without adding the baseline twice", () => {
    expect(
      calculateDailyEnergyProjection({
        ...input,
        dailyEnergy: { energyOn: today, activeKcal: "400", restingKcal: "2000" },
      }),
    ).toMatchObject({ estimatedBurnedKcal: 2400, estimatedNetKcal: -400 });
  });

  it("keeps missing current components at zero but requires a current row and history", () => {
    expect(
      calculateDailyEnergyProjection({
        ...input,
        dailyEnergy: { energyOn: today, restingKcal: "1000" },
      })?.estimatedBurnedKcal,
    ).toBe(1800);
    expect(calculateDailyEnergyProjection({ ...input, dailyEnergy: null })).toBeNull();
    expect(calculateDailyEnergyProjection({ ...input, history: [] })).toBeNull();
    expect(calculateDailyEnergyProjection({ ...input, date: "2026-11-01" })).toBeNull();
    expect(calculateDailyEnergyProjection({ ...input, date: "2026-11-03" })).toBeNull();
    expect(calculateDailyEnergyProjection({ ...input, caloriesIn: Number.NaN })).toBeNull();
    expect(
      calculateDailyEnergyProjection({
        ...input,
        dailyEnergy: { energyOn: today, activeKcal: "Infinity" },
      }),
    ).toBeNull();
  });

  it("uses the same signed net semantics for deficit, balance and surplus", () => {
    for (const caloriesIn of [0, 2200, 3000]) {
      expect(calculateDailyEnergyProjection({ ...input, caloriesIn })?.estimatedNetKcal).toBe(
        caloriesIn - 2200,
      );
    }
  });
});
