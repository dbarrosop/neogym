import { z } from "zod";

export interface DailyEnergyFormValues {
  energyOn: string;
  activeKcal: string;
  restingKcal: string;
  notes: string;
}

export type DailyEnergyNumericValue = number | string | null | undefined;

export interface DailyEnergyBalanceInput {
  caloriesIn: number;
  activeKcal?: DailyEnergyNumericValue;
  restingKcal?: DailyEnergyNumericValue;
  hasEnergyEntry: boolean;
}

export interface DailyEnergyBalance {
  caloriesIn: number;
  caloriesOut: number | null;
  net: number | null;
  state: "intake-only" | "deficit" | "surplus" | "balanced";
}

const NUMERIC_INPUT = /^\d{0,5}([.,]\d{0,2})?$/;
const NORMALIZED_KCAL = /^\d{1,5}(\.\d{0,2})?$/;

// Mirror the DB CHECK constraints in
// backend/nhost/migrations/default/1790000530000_daily_energy/up.sql so the
// user gets inline feedback rather than a generic Hasura error toast.
export const DAILY_ENERGY_KCAL_MIN = 0;
export const DAILY_ENERGY_KCAL_MAX = 30_000;

const dailyEnergyFormSchema = z
  .object({
    energyOn: z.string().min(1, "Date is required."),
    activeKcal: z.string(),
    restingKcal: z.string(),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    validateKcalField(values.activeKcal, "activeKcal", "Active energy", ctx);
    validateKcalField(values.restingKcal, "restingKcal", "Resting energy", ctx);

    if (values.activeKcal.trim() === "" && values.restingKcal.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activeKcal"],
        message: "Enter active energy, resting energy, or both.",
      });
    }
  });

export function acceptsDailyEnergyNumericInput(value: string): boolean {
  return value === "" || NUMERIC_INPUT.test(value);
}

export function validateDailyEnergyFormValues(
  values: DailyEnergyFormValues,
): { success: true; values: DailyEnergyFormValues } | { success: false; message: string } {
  const result = dailyEnergyFormSchema.safeParse(values);
  if (!result.success) {
    return {
      success: false,
      message: result.error.issues[0]?.message ?? "Check the energy values and try again.",
    };
  }

  return {
    success: true,
    values: {
      energyOn: result.data.energyOn,
      activeKcal: normalizeKcalInput(result.data.activeKcal),
      restingKcal: normalizeKcalInput(result.data.restingKcal),
      notes: result.data.notes.trim(),
    },
  };
}

export function formatDailyEnergyValue(value: DailyEnergyNumericValue): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${Number(value).toFixed(0)} kcal`;
}

export function formatDailyEnergyValues(
  activeKcal: DailyEnergyNumericValue,
  restingKcal: DailyEnergyNumericValue,
): string {
  const parts: string[] = [];
  if (activeKcal !== null && activeKcal !== undefined) {
    parts.push(`Active ${Number(activeKcal).toFixed(0)} kcal`);
  }
  if (restingKcal !== null && restingKcal !== undefined) {
    parts.push(`Resting ${Number(restingKcal).toFixed(0)} kcal`);
  }
  return parts.join(" · ");
}

export function calculateDailyEnergyBalance({
  caloriesIn,
  activeKcal,
  restingKcal,
  hasEnergyEntry,
}: DailyEnergyBalanceInput): DailyEnergyBalance {
  if (!hasEnergyEntry) {
    return { caloriesIn, caloriesOut: null, net: null, state: "intake-only" };
  }

  const caloriesOut = normalizeEnergyNumber(activeKcal) + normalizeEnergyNumber(restingKcal);
  const net = caloriesIn - caloriesOut;
  let state: DailyEnergyBalance["state"] = "balanced";
  if (net < 0) {
    state = "deficit";
  } else if (net > 0) {
    state = "surplus";
  }
  return { caloriesIn, caloriesOut, net, state };
}

export function dailyEnergyMutationErrorMessage(error: Error, action: "save" | "delete"): string {
  const message = error.message;
  if (message.includes("daily_energy_user_date_key")) {
    return "You already have an energy entry for this date.";
  }
  if (message.includes("daily_energy_at_least_one_value_check")) {
    return "Enter active energy, resting energy, or both.";
  }
  if (
    message.includes("daily_energy_active_kcal_range_check") ||
    message.includes("daily_energy_resting_kcal_range_check")
  ) {
    return `Energy must be at least ${DAILY_ENERGY_KCAL_MIN} and less than ${DAILY_ENERGY_KCAL_MAX} kcal.`;
  }
  return `Failed to ${action}: ${message}`;
}

function normalizeKcalInput(value: string): string {
  return value.trim().replace(",", ".");
}

function normalizeEnergyNumber(value: DailyEnergyNumericValue): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = typeof value === "number" ? value : Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

function validateKcalField(
  rawValue: string,
  path: "activeKcal" | "restingKcal",
  label: string,
  ctx: z.RefinementCtx,
) {
  const value = normalizeKcalInput(rawValue);
  if (value === "") {
    return;
  }
  if (!NORMALIZED_KCAL.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: `${label} must be a number with up to 2 decimal places.`,
    });
    return;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < DAILY_ENERGY_KCAL_MIN || n >= DAILY_ENERGY_KCAL_MAX) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: `${label} must be at least ${DAILY_ENERGY_KCAL_MIN} and less than ${DAILY_ENERGY_KCAL_MAX} kcal.`,
    });
  }
}
