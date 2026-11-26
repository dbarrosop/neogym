import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkoutForm } from "@/components/workout-form";

const CARDIO_TAG = />Cardio</g;
const EXERCISES_HEADING = />Exercises <span[^>]*>· 1<\/span>/;

describe("WorkoutForm", () => {
  it("tags cardio exercises, whose primary muscle alone reads like a leg exercise", () => {
    const markup = renderToStaticMarkup(
      <WorkoutForm
        initialValues={{
          name: "Upper A",
          description: "",
          labels: [],
          exercises: [
            {
              rowId: "r1",
              exerciseId: "bench",
              name: "Bench press",
              kind: "strength",
              primaryMuscleGroup: "chest",
              doubleWeight: false,
            },
            {
              rowId: "r2",
              exerciseId: "row",
              name: "Rowing, Stationary",
              kind: "cardio",
              primaryMuscleGroup: "quadriceps",
              doubleWeight: false,
            },
          ],
        }}
        submitLabel="Save"
        isSubmitting={false}
        labelSuggestions={[]}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    );

    // KindTag renders "Cardio" and uppercases it with CSS only.
    expect(markup.match(CARDIO_TAG)?.length).toBe(1);
    expect(markup.indexOf(">Cardio<")).toBeGreaterThan(markup.indexOf("Rowing, Stationary"));
  });

  it("names each row's drag handle and counts the exercises in the section heading", () => {
    const markup = renderToStaticMarkup(
      <WorkoutForm
        initialValues={{
          name: "Lower A",
          description: "",
          labels: [],
          exercises: [
            {
              rowId: "r1",
              exerciseId: "rdl",
              name: "Romanian Deadlift",
              kind: "strength",
              primaryMuscleGroup: "hamstrings",
              doubleWeight: false,
              image1FileId: null,
            },
          ],
        }}
        submitLabel="Save"
        isSubmitting={false}
        labelSuggestions={[]}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Drag to reorder Romanian Deadlift"');
    expect(markup).toContain('aria-label="Remove Romanian Deadlift"');
    expect(markup).toMatch(EXERCISES_HEADING);
    expect(markup).toContain(">Notes<");
  });
});
