import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat } from "lucide-react";
import { LibraryDetailSkeleton, MealSummary } from "@/components/nutrition-library";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const MealDetailQuery = graphql(`
  query MealDetail($id: uuid!) {
    meal(id: $id) {
      id
      name
      description
      createdAt
      updatedAt
      mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
        id
        grams
        position
        food {
          id
          name
          isPublic
          kcalPer100g
          fatPer100g
          carbsPer100g
          proteinPer100g
          fiberPer100g
          sugarPer100g
        }
      }
    }
  }
`);

export const Route = createFileRoute("/_authed/nutrition/meals/$mealId")({
  component: MealDetailRoute,
});

/** The Meals panel layout as a page: below 1100 px the table rows open it. */
function MealDetailRoute() {
  const { mealId } = Route.useParams();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nutrition", "meals", "detail", mealId],
    queryFn: () => gqlRequest(MealDetailQuery, { id: mealId }),
  });

  function renderContent() {
    if (isLoading) {
      return <LibraryDetailSkeleton />;
    }
    if (error) {
      return (
        <ErrorState
          title="Couldn’t load this meal"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      );
    }
    const meal = data?.meal;
    if (!meal) {
      return (
        <EmptyState
          icon={ChefHat}
          title="Meal not found"
          description="It may have been deleted."
          actions={
            <Button asChild variant="outline">
              <Link to="/nutrition/meals">Back to meals</Link>
            </Button>
          }
        />
      );
    }
    return (
      <article className="flex flex-col gap-3.5 rounded-xl border bg-card p-5">
        <MealSummary meal={meal} variant="page" />
      </article>
    );
  }

  return (
    <PageShell maxWidth="6xl" contentClassName="max-w-xl mx-0">
      {renderContent()}
    </PageShell>
  );
}
