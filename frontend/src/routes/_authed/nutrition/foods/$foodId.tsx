import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple } from "lucide-react";
import { FoodSummary, LibraryDetailSkeleton } from "@/components/nutrition-library";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";

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

/** The Foods panel layout as a page: below 1100 px the table rows open it. */
function FoodDetailRoute() {
  const { foodId } = Route.useParams();
  const { user } = useAuth();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nutrition", "foods", "detail", foodId],
    queryFn: () => gqlRequest(FoodDetailQuery, { id: foodId }),
  });

  function renderContent() {
    if (isLoading) {
      return <LibraryDetailSkeleton />;
    }
    if (error) {
      return (
        <ErrorState
          title="Couldn’t load this food"
          message={error.message}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      );
    }
    const food = data?.food;
    if (!food) {
      return (
        <EmptyState
          icon={Apple}
          title="Food not found"
          description="It may have been deleted, or it belongs to someone else."
          actions={
            <Button asChild variant="outline">
              <Link to="/nutrition/foods">Back to foods</Link>
            </Button>
          }
        />
      );
    }
    const canEdit = Boolean(user && food.userId === user.id && !food.isPublic);
    return (
      <article className="flex flex-col gap-3.5 rounded-xl border bg-card p-5">
        <FoodSummary food={food} variant="page" canEdit={canEdit} />
      </article>
    );
  }

  return (
    <PageShell maxWidth="6xl" contentClassName="max-w-xl mx-0">
      {renderContent()}
    </PageShell>
  );
}
