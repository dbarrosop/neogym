import { createFileRoute } from "@tanstack/react-router";
import { ExerciseDetail } from "@/components/exercise-detail";

export const Route = createFileRoute("/_authed/workouts/$workoutId_/exercises/$exerciseId")({
  component: WorkoutExerciseRoute,
});

function WorkoutExerciseRoute() {
  const { exerciseId } = Route.useParams();
  return <ExerciseDetail exerciseId={exerciseId} />;
}
