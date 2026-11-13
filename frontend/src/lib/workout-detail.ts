import type { WorkoutDetailQueryVariables } from "@/gql/graphql";
import { addLocalDateDays } from "@/lib/nutrition";

/** Latest-session reports use the backend's maximum of 366 inclusive local dates. */
export function workoutDetailVariables(
  workoutId: string,
  today: string,
  timeZone: string,
): WorkoutDetailQueryVariables {
  return { id: workoutId, from: addLocalDateDays(today, -365), through: today, timeZone };
}
