import { z } from "zod";

// "average" marks a metric whose values are already an average over the entry
// (e.g. avg heart rate over a 30 min run). It displays like an integer but is
// averaged — not summed — when aggregating across entries in a session.
export type MetricFormat = "integer" | "decimal" | "duration_seconds" | "average";

export type MetricAggregation = "sum" | "average";

export function aggregationForFormat(format: MetricFormat): MetricAggregation {
  return format === "average" ? "average" : "sum";
}

export interface CardioMetricPropertySchema {
  type?: "integer" | "number";
  minimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  "x-label"?: string;
  "x-unit"?: string;
  "x-format"?: MetricFormat;
  "x-order"?: number;
}

export interface CardioMetricsSchema {
  type: "object";
  additionalProperties: false;
  properties: Record<string, CardioMetricPropertySchema>;
  required?: string[];
}

export type CardioMetrics = Record<string, number>;

export interface CardioMetricSpec {
  key: string;
  label: string;
  unit: string;
  format: MetricFormat;
  required: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  order: number;
}

export function asCardioMetricsSchema(raw: unknown): CardioMetricsSchema | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (obj["type"] !== "object" || !obj["properties"] || typeof obj["properties"] !== "object") {
    return null;
  }
  return raw as CardioMetricsSchema;
}

export function iterateMetrics(schema: CardioMetricsSchema): CardioMetricSpec[] {
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(schema.properties);
  const indexed = entries.map(([key, prop], index) => {
    const spec: CardioMetricSpec = {
      key,
      label: prop["x-label"] ?? key,
      unit: prop["x-unit"] ?? "",
      format: prop["x-format"] ?? (prop.type === "integer" ? "integer" : "decimal"),
      required: required.has(key),
      order: prop["x-order"] ?? 0,
    };
    if (prop.minimum !== undefined) {
      spec.minimum = prop.minimum;
    }
    if (prop.maximum !== undefined) {
      spec.maximum = prop.maximum;
    }
    if (prop.exclusiveMaximum !== undefined) {
      spec.exclusiveMaximum = prop.exclusiveMaximum;
    }
    return { spec, index };
  });
  indexed.sort((a, b) => a.spec.order - b.spec.order || a.index - b.index);
  return indexed.map(({ spec }) => spec);
}

export function formatSecondsAsDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const INT_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function formatMetricValue(
  value: number | string | boolean | null | undefined,
  spec: CardioMetricSpec,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  switch (spec.format) {
    case "duration_seconds":
      return formatSecondsAsDuration(value);
    case "integer":
    case "average":
      return INT_FORMAT.format(value) + (spec.unit ? ` ${spec.unit}` : "");
    default:
      return NUMBER_FORMAT.format(value) + (spec.unit ? ` ${spec.unit}` : "");
  }
}

const DECIMAL_RE = /^\d+([.,]\d+)?$/;
const INTEGER_RE = /^\d+$/;

export function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !DECIMAL_RE.test(trimmed)) {
    return null;
  }
  const n = Number.parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseIntegerInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !INTEGER_RE.test(trimmed)) {
    return null;
  }
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

// Hours are allowed only when the cap actually exceeds 1 hour. At exactly
// 3600s (the interval template) "mm:ss" covers the whole range ("60:00");
// offering "h:mm:ss" there invites typing the intended minutes into the hours
// slot. Shared between the seeder, the parser and the input so the three
// can't drift at the boundary.
export function shouldShowHoursInput(spec: Pick<CardioMetricSpec, "maximum">): boolean {
  return (spec.maximum ?? Number.POSITIVE_INFINITY) > 3600;
}

/** The single duration field's notation, shown beside its label and as its placeholder. */
export function durationInputNotation(spec: Pick<CardioMetricSpec, "maximum">): string {
  return shouldShowHoursInput(spec) ? "h:mm:ss" : "mm:ss";
}

/**
 * A stored duration as the text the duration field edits: "9:48", "1:02:03"
 * when hours are allowed, or "66:40" when they are not (minutes may exceed
 * 59 so a value above an hour is never silently truncated). Zero or missing
 * reads as an empty field.
 */
export function formatDurationInput(
  totalSeconds: number,
  spec: Pick<CardioMetricSpec, "maximum">,
): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "";
  }
  if (shouldShowHoursInput(spec)) {
    return formatSecondsAsDuration(totalSeconds);
  }
  const safe = Math.floor(totalSeconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

const DURATION_PART_RE = /^\d+$/;

/**
 * Total seconds from the duration field: "9:48" (m:ss), "1:02:03" (h:mm:ss)
 * or a bare "45" read as whole minutes. Seconds (and minutes after an hour)
 * must be below 60. Returns `null` for anything else.
 */
export function parseDurationInput(raw: string): number | null {
  const parts = raw.trim().split(":");
  if (parts.length > 3 || parts.some((part) => !DURATION_PART_RE.test(part))) {
    return null;
  }
  const values = parts.map((part) => Number.parseInt(part, 10));
  if (values.length === 1) {
    return (values[0] ?? 0) * 60;
  }
  const [first = 0, second = 0, third] = values;
  if (third === undefined) {
    return second < 60 ? first * 60 + second : null;
  }
  return second < 60 && third < 60 ? first * 3600 + second * 60 + third : null;
}

/** Form field order: required fields first, then optional, each keeping schema order. */
export function orderMetricsForForm(specs: readonly CardioMetricSpec[]): CardioMetricSpec[] {
  return [...specs.filter((spec) => spec.required), ...specs.filter((spec) => !spec.required)];
}

/** Each field edits text; a duration is one "mm:ss" (or "h:mm:ss") value. */
export type CardioFieldState = string;

export function seedFieldStates(
  specs: CardioMetricSpec[],
  seed: CardioMetrics | null,
): Record<string, CardioFieldState> {
  const next: Record<string, CardioFieldState> = {};
  for (const spec of specs) {
    const v = seed?.[spec.key];
    const numericValue = typeof v === "number" ? v : null;
    if (spec.format === "duration_seconds") {
      next[spec.key] = formatDurationInput(numericValue ?? 0, spec);
    } else {
      next[spec.key] = numericValue === null ? "" : String(numericValue);
    }
  }
  return next;
}

export function parseField(
  spec: CardioMetricSpec,
  raw: CardioFieldState | undefined,
): number | "empty" | "invalid" {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return "empty";
  }
  if (spec.format === "duration_seconds") {
    return parseDurationInput(text) ?? "invalid";
  }
  const wantsInteger = spec.format === "integer" || spec.format === "average";
  const parsed = wantsInteger ? parseIntegerInput(text) : parseDecimalInput(text);
  return parsed === null ? "invalid" : parsed;
}

export function buildZodSchemaFromMetricsSchema(
  schema: CardioMetricsSchema,
): z.ZodType<CardioMetrics> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const spec of iterateMetrics(schema)) {
    let field: z.ZodTypeAny =
      spec.format === "integer" || spec.format === "duration_seconds" || spec.format === "average"
        ? z.number().int()
        : z.number();
    if (spec.minimum !== undefined) {
      field = (field as z.ZodNumber).gte(spec.minimum);
    }
    if (spec.maximum !== undefined) {
      field = (field as z.ZodNumber).lte(spec.maximum);
    }
    if (spec.exclusiveMaximum !== undefined) {
      field = (field as z.ZodNumber).lt(spec.exclusiveMaximum);
    }
    shape[spec.key] = spec.required ? field : field.optional();
  }
  return z.object(shape).strict() as z.ZodType<CardioMetrics>;
}
