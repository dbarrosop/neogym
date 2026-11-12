import { createFileRoute, Navigate } from "@tanstack/react-router";
import { todayLocalISO } from "@/lib/dates";

export const Route = createFileRoute("/_authed/nutrition/log/")({
  component: NutritionLogIndexRoute,
});

// The date is resolved on the client so it follows the user's local day.
function NutritionLogIndexRoute() {
  return <Navigate to="/nutrition/log/$date" params={{ date: todayLocalISO() }} replace />;
}
