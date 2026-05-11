import { describe, expect, it } from "bun:test";
import {
  asCardioMetricsSchema,
  buildZodSchemaFromMetricsSchema,
  type CardioMetricsSchema,
  durationPartsToSeconds,
  formatMetricValue,
  formatSecondsAsDuration,
  iterateMetrics,
  parseDecimalInput,
  parseIntegerInput,
  secondsToDurationParts,
} from "./cardio-schema";

const runningSchema: CardioMetricsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    distance_km: {
      type: "number",
      minimum: 0,
      exclusiveMaximum: 1000,
      "x-label": "Distance",
      "x-unit": "km",
      "x-format": "decimal",
      "x-order": 1,
    },
    duration_s: {
      type: "integer",
      minimum: 0,
      maximum: 86400,
      "x-label": "Duration",
      "x-unit": "",
      "x-format": "duration_seconds",
      "x-order": 2,
    },
    avg_hr_bpm: {
      type: "integer",
      minimum: 0,
      maximum: 300,
      "x-label": "Avg HR",
      "x-unit": "bpm",
      "x-format": "integer",
      "x-order": 4,
    },
  },
  required: ["duration_s"],
};

describe("asCardioMetricsSchema", () => {
  it("returns null for non-objects", () => {
    expect(asCardioMetricsSchema(null)).toBeNull();
    expect(asCardioMetricsSchema("foo")).toBeNull();
    expect(asCardioMetricsSchema({ type: "array" })).toBeNull();
  });

  it("returns the schema for a valid shape", () => {
    expect(asCardioMetricsSchema(runningSchema)).toBe(runningSchema);
  });
});

describe("iterateMetrics", () => {
  it("sorts by x-order then by insertion order", () => {
    const specs = iterateMetrics(runningSchema);
    expect(specs.map((s) => s.key)).toEqual(["distance_km", "duration_s", "avg_hr_bpm"]);
  });

  it("marks required fields", () => {
    const specs = iterateMetrics(runningSchema);
    expect(specs.find((s) => s.key === "duration_s")?.required).toBe(true);
    expect(specs.find((s) => s.key === "distance_km")?.required).toBe(false);
  });

  it("falls back when x-* annotations are missing", () => {
    const bare: CardioMetricsSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        reps: { type: "integer" },
        weight_kg: { type: "number" },
        anything: {},
      },
    };
    const specs = iterateMetrics(bare);
    const reps = specs.find((s) => s.key === "reps");
    const weight = specs.find((s) => s.key === "weight_kg");
    const anything = specs.find((s) => s.key === "anything");
    expect(reps).toMatchObject({ label: "reps", unit: "", format: "integer", required: false });
    expect(weight).toMatchObject({ label: "weight_kg", format: "decimal" });
    expect(anything).toMatchObject({ format: "decimal" });
  });
});

describe("formatSecondsAsDuration", () => {
  it("renders mm:ss when under an hour", () => {
    expect(formatSecondsAsDuration(0)).toBe("0:00");
    expect(formatSecondsAsDuration(65)).toBe("1:05");
    expect(formatSecondsAsDuration(3599)).toBe("59:59");
  });

  it("renders h:mm:ss when over an hour", () => {
    expect(formatSecondsAsDuration(3600)).toBe("1:00:00");
    expect(formatSecondsAsDuration(3725)).toBe("1:02:05");
  });
});

describe("formatMetricValue", () => {
  const specs = iterateMetrics(runningSchema);
  const distance = specs.find((s) => s.key === "distance_km");
  const duration = specs.find((s) => s.key === "duration_s");
  const hr = specs.find((s) => s.key === "avg_hr_bpm");

  if (!distance || !duration || !hr) {
    throw new Error("missing specs in fixture");
  }

  it("renders a placeholder for null/undefined", () => {
    expect(formatMetricValue(null, distance)).toBe("—");
    expect(formatMetricValue(undefined, distance)).toBe("—");
  });

  it("formats decimals with unit", () => {
    expect(formatMetricValue(5.42, distance)).toBe("5.42 km");
  });

  it("formats integers with unit", () => {
    expect(formatMetricValue(165, hr)).toBe("165 bpm");
  });

  it("formats duration without trailing unit", () => {
    expect(formatMetricValue(125, duration)).toBe("2:05");
  });
});

describe("parseDecimalInput", () => {
  it("accepts dot- and comma-decimal", () => {
    expect(parseDecimalInput("5.42")).toBe(5.42);
    expect(parseDecimalInput("5,42")).toBe(5.42);
  });

  it("rejects garbage", () => {
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
    expect(parseDecimalInput("1.2.3")).toBeNull();
  });
});

describe("parseIntegerInput", () => {
  it("rejects non-integers", () => {
    expect(parseIntegerInput("5")).toBe(5);
    expect(parseIntegerInput("5.0")).toBeNull();
    expect(parseIntegerInput("")).toBeNull();
  });
});

describe("durationPartsToSeconds + secondsToDurationParts", () => {
  it("rounds-trips", () => {
    expect(durationPartsToSeconds({ h: "1", m: "2", s: "3" })).toBe(3723);
    expect(secondsToDurationParts(3723)).toEqual({ h: 1, m: 2, s: 3 });
  });

  it("treats empty as zero", () => {
    expect(durationPartsToSeconds({ h: "", m: "5", s: "" })).toBe(300);
  });

  it("returns null for invalid", () => {
    expect(durationPartsToSeconds({ h: "1", m: "abc", s: "0" })).toBeNull();
  });
});

describe("buildZodSchemaFromMetricsSchema", () => {
  const zodSchema = buildZodSchemaFromMetricsSchema(runningSchema);

  it("accepts a valid payload", () => {
    expect(() => zodSchema.parse({ duration_s: 1800, distance_km: 5 })).not.toThrow();
  });

  it("rejects missing required", () => {
    expect(() => zodSchema.parse({ distance_km: 5 })).toThrow();
  });

  it("rejects unknown keys", () => {
    expect(() => zodSchema.parse({ duration_s: 100, bogus: 1 })).toThrow();
  });

  it("rejects out-of-range", () => {
    expect(() => zodSchema.parse({ duration_s: 100, distance_km: -1 })).toThrow();
    expect(() => zodSchema.parse({ duration_s: 100, distance_km: 1000 })).toThrow();
    expect(() => zodSchema.parse({ duration_s: 100, avg_hr_bpm: 1000 })).toThrow();
  });
});
