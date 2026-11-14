import { describe, expect, it } from "bun:test";
import {
  acceptsBodyMeasurementInput,
  bodyMeasurementInput,
  bodyMeasurementMutationError,
  validateBodyMeasurementFormValues,
} from "./body-measurements";

const values = (overrides: Partial<Parameters<typeof bodyMeasurementInput>[0]> = {}) => ({
  measuredOn: "2026-11-12",
  weightKg: "",
  bodyFatPct: "",
  notes: "",
  ...overrides,
});

describe("body measurement form values", () => {
  it("accepts up to three integer digits and two decimals while typing", () => {
    for (const input of ["", "7", "70.", "70,8", "70.85", "100"]) {
      expect(acceptsBodyMeasurementInput(input)).toBe(true);
    }
    for (const input of ["1000", "70.855", "-1", "7a"]) {
      expect(acceptsBodyMeasurementInput(input)).toBe(false);
    }
  });

  it("needs a weight, a body fat or both, inside the database ranges", () => {
    expect(validateBodyMeasurementFormValues(values())).toEqual({
      success: false,
      message: "Enter a weight, a body-fat %, or both.",
    });
    expect(validateBodyMeasurementFormValues(values({ weightKg: "0" }))).toEqual({
      success: false,
      message: "Weight must be greater than 0 and less than 500 kg.",
    });
    expect(validateBodyMeasurementFormValues(values({ bodyFatPct: "100" }))).toEqual({
      success: false,
      message: "Body fat must be at least 0 % and less than 100 %.",
    });
    expect(validateBodyMeasurementFormValues(values({ measuredOn: "", weightKg: "70" }))).toEqual({
      success: false,
      message: "Date is required.",
    });
  });

  it("normalizes decimal commas and trims notes", () => {
    expect(
      validateBodyMeasurementFormValues(
        values({ weightKg: " 70,85 ", bodyFatPct: "0", notes: "  Caliper  " }),
      ),
    ).toEqual({
      success: true,
      values: { measuredOn: "2026-11-12", weightKg: "70.85", bodyFatPct: "0", notes: "Caliper" },
    });
  });

  it("sends empty values as null", () => {
    expect(bodyMeasurementInput(values({ weightKg: "70.85" }))).toEqual({
      measuredOn: "2026-11-12",
      weightKg: "70.85",
      bodyFatPct: null,
      notes: null,
    });
  });
});

describe("body measurement write errors", () => {
  it("puts a date that already has a measurement under the Date field", () => {
    expect(
      bodyMeasurementMutationError(
        new Error(
          'Uniqueness violation. duplicate key value violates unique constraint "body_measurements_user_date_key"',
        ),
        "save",
      ),
    ).toEqual({ message: "You already have a measurement for this date.", field: "date" });
  });

  it("maps CHECK constraints to the form's own messages", () => {
    expect(
      bodyMeasurementMutationError(
        new Error("violates check constraint body_measurements_body_fat_pct_range_check"),
        "save",
      ),
    ).toEqual({ message: "Body fat must be at least 0 % and less than 100 %.", field: null });
    expect(
      bodyMeasurementMutationError(
        new Error("violates check constraint body_measurements_at_least_one_value_check"),
        "save",
      ),
    ).toEqual({ message: "Enter a weight, a body-fat %, or both.", field: null });
  });

  it("keeps other failures general", () => {
    expect(bodyMeasurementMutationError(new Error("Connection interrupted"), "delete")).toEqual({
      message: "Failed to delete: Connection interrupted",
      field: null,
    });
  });
});
