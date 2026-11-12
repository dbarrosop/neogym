import { createFileRoute, Navigate } from "@tanstack/react-router";
import { todayLocalISO } from "@/lib/dates";

export const Route = createFileRoute("/_authed/nutrition/")({
  component: NutritionIndexRoute,
});

// Nutrition opens on today's log. The date is resolved on the client so it
// follows the user's local calendar day, not the server's.
function NutritionIndexRoute() {
  return <Navigate to="/nutrition/log/$date" params={{ date: todayLocalISO() }} replace />;
}
