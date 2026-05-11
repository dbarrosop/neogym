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
  value: number | null | undefined,
  spec: CardioMetricSpec,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
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

const DECIMAL_RE = /^-?\d+([.,]\d+)?$/;
const INTEGER_RE = /^-?\d+$/;
const POSITIVE_INTEGER_RE = /^\d+$/;

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

// Accepts "h", "m", "s" as separate components (each can be empty/zero) and
// returns total seconds. Returns null if any component is non-numeric.
export function durationPartsToSeconds(parts: {
  h?: string;
  m?: string;
  s?: string;
}): number | null {
  const h = parseDurationPart(parts.h);
  const m = parseDurationPart(parts.m);
  const s = parseDurationPart(parts.s);
  if (h === null || m === null || s === null) {
    return null;
  }
  return h * 3600 + m * 60 + s;
}

function parseDurationPart(v: string | undefined): number | null {
  if (v === undefined) {
    return 0;
  }
  const trimmed = v.trim();
  if (trimmed === "") {
    return 0;
  }
  if (!POSITIVE_INTEGER_RE.test(trimmed)) {
    return null;
  }
  return Number.parseInt(trimmed, 10);
}

export function secondsToDurationParts(totalSeconds: number): {
  h: number;
  m: number;
  s: number;
} {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  return {
    h: Math.floor(safe / 3600),
    m: Math.floor((safe % 3600) / 60),
    s: safe % 60,
  };
}

export type CardioFieldState = string | { h: string; m: string; s: string };

export function seedFieldStates(
  specs: CardioMetricSpec[],
  seed: CardioMetrics | null,
): Record<string, CardioFieldState> {
  const next: Record<string, CardioFieldState> = {};
  for (const spec of specs) {
    const v = seed?.[spec.key];
    const numericValue = typeof v === "number" ? v : null;
    if (spec.format === "duration_seconds") {
      next[spec.key] = seedDurationField(spec, numericValue ?? 0);
    } else {
      next[spec.key] = numericValue === null ? "" : String(numericValue);
    }
  }
  return next;
}

function seedDurationField(
  spec: CardioMetricSpec,
  totalSeconds: number,
): { h: string; m: string; s: string } {
  const parts = secondsToDurationParts(totalSeconds);
  const showH = (spec.maximum ?? Number.POSITIVE_INFINITY) >= 3600;
  return {
    h: showH && parts.h > 0 ? String(parts.h) : "",
    m: parts.m > 0 ? String(parts.m) : "",
    s: parts.s > 0 ? String(parts.s) : "",
  };
}

export function parseField(
  spec: CardioMetricSpec,
  raw: CardioFieldState | undefined,
): number | "empty" | "invalid" {
  if (spec.format === "duration_seconds") {
    const parts = (raw as { h: string; m: string; s: string } | undefined) ?? {
      h: "",
      m: "",
      s: "",
    };
    if (!parts.h && !parts.m && !parts.s) {
      return "empty";
    }
    const seconds = durationPartsToSeconds(parts);
    return seconds === null ? "invalid" : seconds;
  }
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return "empty";
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
