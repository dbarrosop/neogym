import { describe, expect, it } from "bun:test";
import type { CardioMetricsSchema } from "@/lib/cardio-schema";
import {
  addExercisesDescription,
  cardioLastTimeCaption,
  exerciseStatus,
  removeExerciseDescription,
  summarizeCardioEntries,
} from "./session-logging";

const rowing: CardioMetricsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["duration_s"],
  properties: {
    duration_s: { type: "integer", "x-label": "Duration", "x-format": "duration_seconds" },
    distance_km: { type: "number", "x-label": "Distance", "x-unit": "km", "x-order": 1 },
  },
};

describe("exerciseStatus", () => {
  it("is not started without logged sets", () => {
    expect(exerciseStatus(0, 3)).toBe("todo");
  });

  it("is done once the count reaches last time's", () => {
    expect(exerciseStatus(2, 3)).toBe("started");
    expect(exerciseStatus(3, 3)).toBe("done");
    expect(exerciseStatus(4, 3)).toBe("done");
  });

  it("never completes against missing or empty history", () => {
    expect(exerciseStatus(5)).toBe("started");
    expect(exerciseStatus(1, 0)).toBe("started");
  });
});

describe("cardioLastTimeCaption", () => {
  const entries = [{ metrics: { duration_s: 1260 } }, { metrics: { duration_s: 600 } }];

  it("reads 'last' beside logged entries and 'Last time' before any", () => {
    expect(cardioLastTimeCaption(entries, rowing, { hasLoggedEntries: true })).toBe(
      "last 21:00 · 10:00",
    );
    expect(cardioLastTimeCaption(entries, rowing, { hasLoggedEntries: false })).toBe(
      "Last time 21:00 · 10:00",
    );
  });

  it("is null without history", () => {
    expect(cardioLastTimeCaption(undefined, rowing, { hasLoggedEntries: false })).toBeNull();
    expect(cardioLastTimeCaption([], rowing, { hasLoggedEntries: true })).toBeNull();
  });
});

describe("summarizeCardioEntries", () => {
  it("uses the first metric in schema order that was recorded", () => {
    expect(summarizeCardioEntries([{ metrics: { duration_s: 588, distance_km: 2 } }], rowing)).toBe(
      "9:48",
    );
    expect(
      summarizeCardioEntries(
        [{ metrics: { distance_km: 2 } }, { metrics: { distance_km: 1.5 } }],
        rowing,
      ),
    ).toBe("2 km · 1.5 km");
  });

  it("marks an entry without that metric and counts entries without any reading", () => {
    expect(summarizeCardioEntries([{ metrics: { duration_s: 60 } }, { metrics: {} }], rowing)).toBe(
      "1:00 · —",
    );
    expect(summarizeCardioEntries([{ metrics: {} }], rowing)).toBe("1 entry");
    expect(summarizeCardioEntries([], rowing)).toBeNull();
  });
});

describe("removeExerciseDescription", () => {
  it("warns about all child deletes independently of any displayed count", () => {
    expect(removeExerciseDescription({ isCardio: false, fromWorkout: true })).toBe(
      "This permanently deletes any logged sets for this exercise in this session. The workout template is not changed.",
    );
    expect(removeExerciseDescription({ isCardio: true, fromWorkout: false })).toBe(
      "This permanently deletes any logged cardio entries for this exercise in this session.",
    );
  });
});

describe("addExercisesDescription", () => {
  it("explains that appending to a session leaves its workout template alone", () => {
    expect(addExercisesDescription(true)).toBe(
      "Added to the end of the session. The workout template is not changed.",
    );
    expect(addExercisesDescription(false)).toBe("Added to the end of the session.");
  });
});
