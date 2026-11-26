import type { EntryFormError } from "@/lib/progress-entries";

export interface BodyMeasurementFormValues {
  measuredOn: string;
  weightKg: string;
  bodyFatPct: string;
  notes: string;
}

const NUMERIC_INPUT = /^\d{0,3}([.,]\d{0,2})?$/;

// Mirror the DB CHECK constraints in
// backend/nhost/migrations/default/1790000000000_body_measurements/up.sql so
// the user gets inline feedback rather than a generic Hasura error.
export const BODY_WEIGHT_MIN = 0;
export const BODY_WEIGHT_MAX = 500;
export const BODY_FAT_MIN = 0;
export const BODY_FAT_MAX = 100;

const AT_LEAST_ONE_VALUE = "Enter a weight, a body-fat %, or both.";
const WEIGHT_RANGE = `Weight must be greater than ${BODY_WEIGHT_MIN} and less than ${BODY_WEIGHT_MAX} kg.`;
const FAT_RANGE = `Body fat must be at least ${BODY_FAT_MIN} % and less than ${BODY_FAT_MAX} %.`;

/** Keystroke filter for the weight and body-fat inputs (up to 2 decimals, comma or dot). */
export function acceptsBodyMeasurementInput(value: string): boolean {
  return value === "" || NUMERIC_INPUT.test(value);
}

/** Validates the form and normalizes decimal commas; at least one value is required. */
export function validateBodyMeasurementFormValues(
  values: BodyMeasurementFormValues,
): { success: true; values: BodyMeasurementFormValues } | { success: false; message: string } {
  if (values.measuredOn.trim() === "") {
    return { success: false, message: "Date is required." };
  }
  const weightKg = values.weightKg.trim().replace(",", ".");
  const bodyFatPct = values.bodyFatPct.trim().replace(",", ".");
  if (weightKg === "" && bodyFatPct === "") {
    return { success: false, message: AT_LEAST_ONE_VALUE };
  }
  if (weightKg !== "") {
    const weight = Number(weightKg);
    if (!Number.isFinite(weight) || weight <= BODY_WEIGHT_MIN || weight >= BODY_WEIGHT_MAX) {
      return { success: false, message: WEIGHT_RANGE };
    }
  }
  if (bodyFatPct !== "") {
    const fat = Number(bodyFatPct);
    if (!Number.isFinite(fat) || fat < BODY_FAT_MIN || fat >= BODY_FAT_MAX) {
      return { success: false, message: FAT_RANGE };
    }
  }
  return {
    success: true,
    values: { measuredOn: values.measuredOn, weightKg, bodyFatPct, notes: values.notes.trim() },
  };
}

/** GraphQL insert/update columns: empty values are null. */
export function bodyMeasurementInput(values: BodyMeasurementFormValues) {
  return {
    measuredOn: values.measuredOn,
    weightKg: values.weightKg ? values.weightKg : null,
    bodyFatPct: values.bodyFatPct ? values.bodyFatPct : null,
    notes: values.notes ? values.notes : null,
  };
}

/**
 * A failed write in the user's terms. A date that already has a measurement
 * (the per-user date UNIQUE key) belongs under the Date field, so the form
 * shows it inline instead of overwriting the other entry.
 */
export function bodyMeasurementMutationError(
  error: Error,
  action: "save" | "delete",
): EntryFormError {
  const message = error.message;
  if (message.includes("body_measurements_user_date_key")) {
    return { message: "You already have a measurement for this date.", field: "date" };
  }
  if (message.includes("body_measurements_at_least_one_value_check")) {
    return { message: AT_LEAST_ONE_VALUE, field: null };
  }
  if (message.includes("body_measurements_weight_kg_range_check")) {
    return { message: WEIGHT_RANGE, field: null };
  }
  if (message.includes("body_measurements_body_fat_pct_range_check")) {
    return { message: FAT_RANGE, field: null };
  }
  return { message: `Failed to ${action}: ${message}`, field: null };
}
