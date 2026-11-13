import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkoutForm } from "@/components/workout-form";

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

    expect(markup.match(/CARDIO/g)?.length).toBe(1);
    expect(markup.indexOf("CARDIO")).toBeGreaterThan(markup.indexOf("Rowing, Stationary"));
  });
});
