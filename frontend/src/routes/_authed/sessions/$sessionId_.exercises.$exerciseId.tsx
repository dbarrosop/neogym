import { createFileRoute } from "@tanstack/react-router";
import { ExerciseDetail } from "@/components/exercise-detail";

export const Route = createFileRoute("/_authed/sessions/$sessionId_/exercises/$exerciseId")({
  component: SessionExerciseRoute,
});

function SessionExerciseRoute() {
  const { exerciseId } = Route.useParams();
  return <ExerciseDetail exerciseId={exerciseId} />;
}
