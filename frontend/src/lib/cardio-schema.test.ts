import { describe, expect, it } from "bun:test";
import {
  aggregationForFormat,
  asCardioMetricsSchema,
  buildZodSchemaFromMetricsSchema,
  type CardioMetricsSchema,
  durationPartsToSeconds,
  formatMetricValue,
  formatSecondsAsDuration,
  iterateMetrics,
  parseDecimalInput,
  parseField,
  parseIntegerInput,
  secondsToDurationParts,
  seedFieldStates,
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
      "x-format": "average",
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

  it("formats 'average' metrics like integers with unit", () => {
    expect(hr.format).toBe("average");
    expect(formatMetricValue(165, hr)).toBe("165 bpm");
    expect(formatMetricValue(165.7, hr)).toBe("166 bpm");
  });

  it("formats duration without trailing unit", () => {
    expect(formatMetricValue(125, duration)).toBe("2:05");
  });
});

describe("aggregationForFormat", () => {
  it("returns 'average' only for 'average' format; everything else sums", () => {
    expect(aggregationForFormat("average")).toBe("average");
    expect(aggregationForFormat("integer")).toBe("sum");
    expect(aggregationForFormat("decimal")).toBe("sum");
    expect(aggregationForFormat("duration_seconds")).toBe("sum");
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

const shortDurationSchema: CardioMetricsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    duration_s: {
      type: "integer",
      minimum: 0,
      maximum: 3599,
      "x-label": "Duration",
      "x-format": "duration_seconds",
    },
  },
  required: ["duration_s"],
};

describe("seedFieldStates", () => {
  it("returns empty placeholders when no seed is given (add-mode, no previousMetrics)", () => {
    const specs = iterateMetrics(runningSchema);
    const state = seedFieldStates(specs, null);
    expect(state["distance_km"]).toBe("");
    expect(state["duration_s"]).toEqual({ h: "", m: "", s: "" });
    expect(state["avg_hr_bpm"]).toBe("");
  });

  it("seeds non-duration fields from numeric values (edit-mode initialMetrics)", () => {
    const specs = iterateMetrics(runningSchema);
    const state = seedFieldStates(specs, {
      distance_km: 5.42,
      duration_s: 3723,
      avg_hr_bpm: 165,
    });
    expect(state["distance_km"]).toBe("5.42");
    expect(state["avg_hr_bpm"]).toBe("165");
    expect(state["duration_s"]).toEqual({ h: "1", m: "2", s: "3" });
  });

  it("folds the h component into m when the duration spec hides hours", () => {
    const specs = iterateMetrics(shortDurationSchema);
    // 4000s would otherwise split into 1h6m40s; with the hours input hidden
    // the value is preserved as m=66, s=40 (instead of silently truncating to
    // 6m40s, which would corrupt the stored value on a no-op edit). A value
    // that overshoots the cap is then surfaced by zod validation on save.
    const state = seedFieldStates(specs, { duration_s: 4000 });
    expect(state["duration_s"]).toEqual({ h: "", m: "66", s: "40" });
  });

  it("hides the h component at the maximum: 3600 boundary (matches MetricInput)", () => {
    // The interval template caps duration at 3600s exactly; the form's input
    // shows only m/s in that case, so the seeder must agree — otherwise a
    // stored 3600s value would populate a hidden hours field and subsequent
    // edits could silently overshoot the cap.
    const boundarySchema: CardioMetricsSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        duration_s: {
          type: "integer",
          minimum: 0,
          maximum: 3600,
          "x-format": "duration_seconds",
        },
      },
      required: ["duration_s"],
    };
    const specs = iterateMetrics(boundarySchema);
    const state = seedFieldStates(specs, { duration_s: 3600 });
    expect(state["duration_s"]).toEqual({ h: "", m: "60", s: "" });
  });
});

describe("parseField", () => {
  const specs = iterateMetrics(runningSchema);
  const distance = specs.find((s) => s.key === "distance_km");
  const duration = specs.find((s) => s.key === "duration_s");
  const hr = specs.find((s) => s.key === "avg_hr_bpm");

  if (!distance || !duration || !hr) {
    throw new Error("missing specs in fixture");
  }

  it("returns 'empty' for a missing/blank scalar field", () => {
    expect(parseField(distance, undefined)).toBe("empty");
    expect(parseField(distance, "")).toBe("empty");
    expect(parseField(distance, "   ")).toBe("empty");
  });

  it("returns 'empty' when every duration component is blank", () => {
    expect(parseField(duration, { h: "", m: "", s: "" })).toBe("empty");
    expect(parseField(duration, undefined)).toBe("empty");
  });

  it("returns 'invalid' for a non-integer in an integer-like field", () => {
    expect(parseField(hr, "1.5")).toBe("invalid");
  });

  it("accepts decimal with comma in a decimal field", () => {
    expect(parseField(distance, "5,42")).toBe(5.42);
  });

  it("honours only m/s when the h component is empty (maximum < 3600 case)", () => {
    const shortSpec = iterateMetrics(shortDurationSchema)[0];
    if (!shortSpec) {
      throw new Error("missing short-duration spec");
    }
    expect(parseField(shortSpec, { h: "", m: "2", s: "5" })).toBe(125);
  });

  it("parses a full h/m/s duration to total seconds", () => {
    expect(parseField(duration, { h: "1", m: "2", s: "3" })).toBe(3723);
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
