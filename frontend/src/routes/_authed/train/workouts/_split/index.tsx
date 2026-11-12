import { createFileRoute, getRouteApi, Navigate } from "@tanstack/react-router";
import { EmptyState } from "@/components/patterns/query-states";
import { useIsSplit } from "@/lib/hooks/use-is-split";
import { filterWorkouts, useWorkoutsIndex } from "@/lib/hooks/use-workouts-index";

export const Route = createFileRoute("/_authed/train/workouts/_split/")({
  component: WorkoutsIndexPane,
});

const layoutRoute = getRouteApi("/_authed/train/workouts/_split");

/** From 1100 px the detail pane opens the first workout in the filtered list. */
function WorkoutsIndexPane() {
  const split = useIsSplit();
  const search = layoutRoute.useSearch();
  const { data } = useWorkoutsIndex();
  const first = data ? filterWorkouts(data.workouts, search)[0] : undefined;

  if (split && first) {
    return (
      <Navigate
        to="/train/workouts/$workoutId"
        params={{ workoutId: first.id }}
        search={(prev) => prev}
        replace
      />
    );
  }
  if (split && data) {
    return (
      <EmptyState
        title="Nothing selected"
        description="Create a workout, or clear the filters to see more."
      />
    );
  }
  return null;
}
