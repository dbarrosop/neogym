import { describe, expect, it } from "bun:test";
import type { CardioMetricsSchema } from "@/lib/cardio-schema";
import {
  addExercisesDescription,
  cardioLastTimeCaption,
  exerciseStatus,
  pluralChild,
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
  it("counts the logged children and mentions the template for workout sessions", () => {
    expect(removeExerciseDescription({ childCount: 3, childNoun: "set", fromWorkout: true })).toBe(
      "Its 3 logged sets are deleted with it. The workout template is not changed.",
    );
    expect(
      removeExerciseDescription({ childCount: 1, childNoun: "entry", fromWorkout: false }),
    ).toBe("Its 1 logged entry is deleted with it.");
  });

  it("says the removal only affects this session when nothing is logged", () => {
    expect(removeExerciseDescription({ childCount: 0, childNoun: "set", fromWorkout: false })).toBe(
      "It's removed from this session only.",
    );
  });
});

describe("pluralChild", () => {
  it("pluralises sets and entries", () => {
    expect(pluralChild("set", 1)).toBe("set");
    expect(pluralChild("set", 2)).toBe("sets");
    expect(pluralChild("entry", 2)).toBe("entries");
  });
});

describe("addExercisesDescription", () => {
  it("points to the workout for reordering only when there is one", () => {
    expect(addExercisesDescription(true)).toBe(
      "Added to the end of the session. Reorder on the workout.",
    );
    expect(addExercisesDescription(false)).toBe("Added to the end of the session.");
  });
});
