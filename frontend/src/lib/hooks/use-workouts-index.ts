import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { graphql } from "@/gql";
import type { WorkoutsIndexQuery as WorkoutsIndexData } from "@/gql/graphql";
import { gqlRequest } from "@/lib/graphql";

const WorkoutsIndexQuery = graphql(`
  query WorkoutsIndex {
    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {
      id
      name
      description
      isPublic
      workoutExercises_aggregate {
        aggregate {
          count
        }
      }
      workoutLabels {
        labelId
        label {
          id
          name
        }
      }
    }
    labels(order_by: { name: asc }) {
      id
      name
    }
  }
`);

export const workoutVisibilityValues = ["mine", "public"] as const;
export type WorkoutVisibility = (typeof workoutVisibilityValues)[number];

export const workoutsSearchSchema = z.object({
  visibility: z.enum(workoutVisibilityValues).optional(),
  labels: z.array(z.string()).optional(),
});
export type WorkoutsSearch = z.infer<typeof workoutsSearchSchema>;

export type WorkoutSummary = WorkoutsIndexData["workouts"][number];

export function useWorkoutsIndex() {
  return useQuery({
    queryKey: ["workouts", "index"],
    queryFn: () => gqlRequest(WorkoutsIndexQuery),
  });
}

/** Visibility is exclusive; labels combine with AND. */
export function filterWorkouts(workouts: WorkoutSummary[], search: WorkoutsSearch) {
  const labels = search.labels ?? [];
  return workouts.filter((workout) => {
    if (search.visibility === "mine" && workout.isPublic) {
      return false;
    }
    if (search.visibility === "public" && !workout.isPublic) {
      return false;
    }
    const ids = new Set(workout.workoutLabels.map((wl) => wl.labelId));
    return labels.every((label) => ids.has(label));
  });
}
