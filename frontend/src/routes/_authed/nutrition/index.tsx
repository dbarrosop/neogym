import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, ArrowRight, Info } from "lucide-react";
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

      <Card className="border-border/60 border-dashed bg-muted/20">
        <CardContent className="flex gap-3 py-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This phase intentionally links only to implemented nutrition routes. Meal templates,
            plans, and daily logging will be added in later phases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
