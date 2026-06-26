import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, ArrowRight, CalendarClock, CalendarDays, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authed/nutrition/")({
  component: NutritionIndexRoute,
});

function NutritionIndexRoute() {
  return (
    <div className="space-y-4">
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
            <Apple className="h-5 w-5 text-primary" />
            Foods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Create private foods with kcal, fat, carbs, protein, fiber, and sugar per 100g, or
            browse public foods managed by the app.
          </p>
          <Button asChild>
            <Link to="/nutrition/foods">
              Open foods
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
            <ChefHat className="h-5 w-5 text-primary" />
            Meals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Combine your private foods and public foods into reusable private meal templates with
            live computed nutrition totals.
          </p>
          <Button asChild>
            <Link to="/nutrition/meals">
              Open meals
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
            <CalendarClock className="h-5 w-5 text-primary" />
            Plans
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Build reusable daily plan templates from timed meal slots. Plans are suggestions only,
            not scheduled calendar assignments.
          </p>
          <Button asChild>
            <Link to="/nutrition/plans">
              Open plans
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
            <CalendarDays className="h-5 w-5 text-primary" />
            Daily logs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Open a local calendar date, choose plan suggestions, log planned or ad-hoc meals and
            foods, then edit historical grams without changing templates.
          </p>
          <Button asChild>
            <Link to="/nutrition/days">
              Open days
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
