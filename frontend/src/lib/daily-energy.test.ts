import { describe, expect, it } from "bun:test";
import {
  acceptsDailyEnergyNumericInput,
  dailyEnergyMutationErrorMessage,
  validateDailyEnergyFormValues,
} from "./daily-energy";

describe("daily energy form helpers", () => {
  it("normalizes valid active-only, resting-only, and combined entries", () => {
    expect(
      validateDailyEnergyFormValues({
        energyOn: "2026-07-08",
        activeKcal: "650,25",
        restingKcal: "",
        notes: "  Imported from watch  ",
      }),
    ).toEqual({
      success: true,
      values: {
        energyOn: "2026-07-08",
        activeKcal: "650.25",
        restingKcal: "",
        notes: "Imported from watch",
      },
    });

    expect(
      validateDailyEnergyFormValues({
        energyOn: "2026-07-08",
        activeKcal: "",
        restingKcal: "1800",
        notes: "",
      }),
    ).toMatchObject({ success: true });

    expect(
      validateDailyEnergyFormValues({
        energyOn: "2026-07-08",
        activeKcal: "650",
        restingKcal: "1800",
        notes: "",
      }),
    ).toMatchObject({ success: true });
  });

  it("mirrors daily_energy check constraints for at-least-one and kcal ranges", () => {
    expect(
      validateDailyEnergyFormValues({
        energyOn: "2026-07-08",
        activeKcal: "",
        restingKcal: "",
        notes: "",
      }),
    ).toEqual({ success: false, message: "Enter active energy, resting energy, or both." });

    expect(
      validateDailyEnergyFormValues({
        energyOn: "2026-07-08",
        activeKcal: "30000",
        restingKcal: "",
        notes: "",
      }),
    ).toEqual({
      success: false,
      message: "Active energy must be at least 0 and less than 30000 kcal.",
    });

    expect(
      validateDailyEnergyFormValues({
        energyOn: "2026-07-08",
        activeKcal: "29999.99",
        restingKcal: "0",
        notes: "",
      }),
    ).toMatchObject({ success: true });
  });

  it("keeps kcal typing to numeric values with up to two decimals", () => {
    expect(acceptsDailyEnergyNumericInput("12345.67")).toBe(true);
    expect(acceptsDailyEnergyNumericInput("123456")).toBe(false);
    expect(acceptsDailyEnergyNumericInput("120.123")).toBe(false);
    expect(acceptsDailyEnergyNumericInput("abc")).toBe(false);
  });

  it("maps duplicate-date and range database errors to friendly messages", () => {
    expect(
      dailyEnergyMutationErrorMessage(
        new Error('Uniqueness violation. duplicate key violates "daily_energy_user_date_key"'),
        "save",
      ),
    ).toBe("You already have an energy entry for this date.");

    expect(
      dailyEnergyMutationErrorMessage(
        new Error("violates check constraint daily_energy_resting_kcal_range_check"),
        "save",
      ),
    ).toBe("Energy must be at least 0 and less than 30000 kcal.");
  });
});
