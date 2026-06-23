import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { DailyIntakeLog } from "@/components/daily-intake-log";
import { Card, CardContent } from "@/components/ui/card";
import { formatLocalDate, isValidLocalDate } from "@/lib/nutrition";

export const Route = createFileRoute("/_authed/nutrition/days/$date")({
  component: NutritionDayRoute,
});

function NutritionDayRoute() {
  const { date } = Route.useParams();
  const navigate = useNavigate();
  const isValidDate = isValidLocalDate(date);

  useEffect(() => {
    if (!isValidDate) {
      navigate({
        to: "/nutrition/days/$date",
        params: { date: formatLocalDate() },
        replace: true,
      });
    }
  }, [isValidDate, navigate]);

  if (!isValidDate) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-4 text-sm text-muted-foreground">
          Redirecting to today's nutrition log…
        </CardContent>
      </Card>
    );
  }

  return <DailyIntakeLog date={date} />;
}
