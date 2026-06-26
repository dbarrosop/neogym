import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, Globe2, Pencil, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import { formatMacro, normalizeMacros } from "@/lib/nutrition";

const FoodDetailQuery = graphql(`
  query FoodDetail($id: uuid!) {
    food(id: $id) {
      id
      name
      userId
      isPublic
      kcalPer100g
      fatPer100g
      carbsPer100g
      proteinPer100g
      fiberPer100g
      sugarPer100g
      createdAt
      updatedAt
    }
  }
`);

export const Route = createFileRoute("/_authed/nutrition/foods/$foodId")({
  component: FoodDetailRoute,
});

function FoodDetailRoute() {
  const { foodId } = Route.useParams();
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "foods", "detail", foodId],
    queryFn: () => gqlRequest(FoodDetailQuery, { id: foodId }),
  });

  function renderContent() {
    if (isLoading) {
      return <FoodDetailSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!data?.food) {
      return <p className="text-sm text-muted-foreground">Food not found.</p>;
    }

    const food = data.food;
    const canEdit = Boolean(user && food.userId === user.id && !food.isPublic);
    const macros = normalizeMacros(food);

    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Apple className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-2">
                <CardTitle className="truncate text-2xl tracking-tight">{food.name}</CardTitle>
                {food.isPublic ? (
                  <Badge variant="primary">
                    <Globe2 className="h-3 w-3" /> Public
                  </Badge>
                ) : (
                  <Badge>
                    <User className="h-3 w-3" /> Mine
                  </Badge>
                )}
              </div>
            </div>
            {canEdit ? (
              <Button asChild size="icon" variant="ghost" aria-label="Edit food">
                <Link to="/nutrition/foods/$foodId/edit" params={{ foodId: food.id }}>
                  <Pencil className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
          {canEdit ? null : (
            <p className="text-xs text-muted-foreground">
              Public foods are read-only. Copy values into a private food if you need a custom
              variant.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">Per 100 g</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MacroTile label="Calories" value={formatMacro(macros.kcalPer100g, "kcal")} />
              <MacroTile label="Fat" value={formatMacro(macros.fatPer100g, "g")} />
              <MacroTile label="Carbs" value={formatMacro(macros.carbsPer100g, "g")} />
              <MacroTile label="Protein" value={formatMacro(macros.proteinPer100g, "g")} />
              <MacroTile label="Fiber" value={formatMacro(macros.fiberPer100g, "g")} />
              <MacroTile label="Sugar" value={formatMacro(macros.sugarPer100g, "g")} />
            </dl>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <div className="space-y-4">{renderContent()}</div>;
}

function MacroTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function FoodDetailSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-16 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
