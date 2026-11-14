import { describe, expect, it } from "bun:test";
import {
  aggregationForFormat,
  asCardioMetricsSchema,
  buildZodSchemaFromMetricsSchema,
  type CardioMetricsSchema,
  durationInputNotation,
  formatDurationInput,
  formatMetricValue,
  formatSecondsAsDuration,
  iterateMetrics,
  orderMetricsForForm,
  parseDecimalInput,
  parseDurationInput,
  parseField,
  parseIntegerInput,
  seedFieldStates,
  shouldShowHoursInput,
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

  it("renders placeholder for non-numeric stored values (jsonb shape drift)", () => {
    expect(formatMetricValue("5.0" as unknown as number, distance)).toBe("—");
    expect(formatMetricValue(true as unknown as number, distance)).toBe("—");
    expect(formatMetricValue(Number.POSITIVE_INFINITY, distance)).toBe("—");
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

  it("rejects negative numbers (cardio metrics are never negative)", () => {
    expect(parseDecimalInput("-5")).toBeNull();
    expect(parseDecimalInput("-5.42")).toBeNull();
    expect(parseDecimalInput("-0")).toBeNull();
  });
});

describe("parseIntegerInput", () => {
  it("rejects non-integers", () => {
    expect(parseIntegerInput("5")).toBe(5);
    expect(parseIntegerInput("5.0")).toBeNull();
    expect(parseIntegerInput("")).toBeNull();
  });

  it("rejects negative integers", () => {
    expect(parseIntegerInput("-5")).toBeNull();
  });
});

describe("parseDurationInput", () => {
  it("reads m:ss and h:mm:ss", () => {
    expect(parseDurationInput("9:48")).toBe(588);
    expect(parseDurationInput("09:05")).toBe(545);
    expect(parseDurationInput("1:02:03")).toBe(3723);
    expect(parseDurationInput(" 60:00 ")).toBe(3600);
  });

  it("reads a bare number as whole minutes", () => {
    expect(parseDurationInput("45")).toBe(2700);
    expect(parseDurationInput("0")).toBe(0);
  });

  it("rejects seconds or minutes past 59 and anything that is not digits and colons", () => {
    expect(parseDurationInput("9:75")).toBeNull();
    expect(parseDurationInput("1:60:00")).toBeNull();
    expect(parseDurationInput("9:4.5")).toBeNull();
    expect(parseDurationInput("-1:00")).toBeNull();
    expect(parseDurationInput("1:2:3:4")).toBeNull();
    expect(parseDurationInput("9:")).toBeNull();
    expect(parseDurationInput("abc")).toBeNull();
  });
});

describe("formatDurationInput", () => {
  it("writes h:mm:ss when hours are allowed and m:ss below an hour", () => {
    expect(formatDurationInput(3723, {})).toBe("1:02:03");
    expect(formatDurationInput(588, {})).toBe("9:48");
  });

  it("keeps minutes past 59 when the cap hides hours", () => {
    expect(formatDurationInput(3600, { maximum: 3600 })).toBe("60:00");
    expect(formatDurationInput(4000, { maximum: 3599 })).toBe("66:40");
  });

  it("leaves zero or invalid values empty", () => {
    expect(formatDurationInput(0, {})).toBe("");
    expect(formatDurationInput(Number.NaN, {})).toBe("");
  });

  it("round-trips through parseDurationInput", () => {
    for (const seconds of [1, 59, 60, 588, 3599, 3600, 3723, 86_399]) {
      expect(parseDurationInput(formatDurationInput(seconds, {}))).toBe(seconds);
      expect(parseDurationInput(formatDurationInput(seconds, { maximum: 3600 }))).toBe(seconds);
    }
  });
});

describe("durationInputNotation", () => {
  it("names the hours segment only when the cap exceeds an hour", () => {
    expect(durationInputNotation({ maximum: 3600 })).toBe("mm:ss");
    expect(durationInputNotation({ maximum: 3601 })).toBe("h:mm:ss");
    expect(durationInputNotation({})).toBe("h:mm:ss");
  });
});

describe("orderMetricsForForm", () => {
  it("puts required fields first and keeps schema order within each group", () => {
    expect(orderMetricsForForm(iterateMetrics(runningSchema)).map((spec) => spec.key)).toEqual([
      "duration_s",
      "distance_km",
      "avg_hr_bpm",
    ]);
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

describe("shouldShowHoursInput", () => {
  it("hides hours below the 3600-second boundary (interval cap)", () => {
    expect(shouldShowHoursInput({ maximum: 3599 })).toBe(false);
  });

  it("hides hours at exactly 3600 seconds (one hour reachable via m + s)", () => {
    expect(shouldShowHoursInput({ maximum: 3600 })).toBe(false);
  });

  it("shows hours when the cap exceeds one hour", () => {
    expect(shouldShowHoursInput({ maximum: 3601 })).toBe(true);
  });

  it("shows hours when no maximum is configured (unbounded)", () => {
    expect(shouldShowHoursInput({})).toBe(true);
  });
});

describe("seedFieldStates", () => {
  it("returns empty placeholders when no seed is given (add-mode, no previousMetrics)", () => {
    const specs = iterateMetrics(runningSchema);
    const state = seedFieldStates(specs, null);
    expect(state["distance_km"]).toBe("");
    expect(state["duration_s"]).toBe("");
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
    expect(state["duration_s"]).toBe("1:02:03");
  });

  it("folds hours into minutes when the duration spec hides hours", () => {
    const specs = iterateMetrics(shortDurationSchema);
    // 4000s would otherwise read 1:06:40; without an hours segment the value
    // is preserved as 66:40 (instead of silently truncating to 6:40, which
    // would corrupt the stored value on a no-op edit). A value that
    // overshoots the cap is then surfaced by zod validation on save.
    const state = seedFieldStates(specs, { duration_s: 4000 });
    expect(state["duration_s"]).toBe("66:40");
  });

  it("writes mm:ss at the maximum: 3600 boundary (matches MetricInput)", () => {
    // The interval template caps duration at 3600s exactly; the form's input
    // reads mm:ss in that case, so the seeder must agree.
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
    expect(state["duration_s"]).toBe("60:00");
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

  it("returns 'empty' for a blank duration", () => {
    expect(parseField(duration, "")).toBe("empty");
    expect(parseField(duration, undefined)).toBe("empty");
  });

  it("returns 'invalid' for a malformed duration", () => {
    expect(parseField(duration, "9:75")).toBe("invalid");
  });

  it("returns 'invalid' for a non-integer in an integer-like field", () => {
    expect(parseField(hr, "1.5")).toBe("invalid");
  });

  it("accepts decimal with comma in a decimal field", () => {
    expect(parseField(distance, "5,42")).toBe(5.42);
  });

  it("parses mm:ss when the cap hides hours", () => {
    const shortSpec = iterateMetrics(shortDurationSchema)[0];
    if (!shortSpec) {
      throw new Error("missing short-duration spec");
    }
    expect(parseField(shortSpec, "2:05")).toBe(125);
  });

  it("parses h:mm:ss to total seconds", () => {
    expect(parseField(duration, "1:02:03")).toBe(3723);
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

  it("honours exclusiveMaximum (rejects at the cap, accepts just below)", () => {
    // distance_km has exclusiveMaximum: 1000, so 999.99 is valid but 1000 is not.
    // An inclusive `.lte(1000)` regression would still reject 1000 + accept 999.99,
    // but only on the wrong side of the boundary — the next assertion catches that.
    expect(() => zodSchema.parse({ duration_s: 100, distance_km: 999.99 })).not.toThrow();
    expect(() => zodSchema.parse({ duration_s: 100, distance_km: 1000 })).toThrow();
  });
});
