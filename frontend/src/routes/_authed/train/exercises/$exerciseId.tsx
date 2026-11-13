import { createFileRoute } from "@tanstack/react-router";
import { ExerciseDetail } from "@/components/exercise-detail";

export const Route = createFileRoute("/_authed/train/exercises/$exerciseId")({
  component: ExerciseDetailRoute,
});

function ExerciseDetailRoute() {
  const { exerciseId } = Route.useParams();
  return <ExerciseDetail exerciseId={exerciseId} />;
}
