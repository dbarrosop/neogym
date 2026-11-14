import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EDIT_FOOD_CAPTION, FoodForm, type FoodFormValues } from "@/components/food-form";
import { LibraryDetailSkeleton } from "@/components/nutrition-library";
import { ConfirmActionDialog } from "@/components/patterns/confirm-action-dialog";
import { DangerZone, FormPage } from "@/components/patterns/form-page";
import { PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import { isFoodInUseError, normalizeMacros } from "@/lib/nutrition";

const EditFoodQuery = graphql(`
  query EditFood($id: uuid!) {
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
    }
  }
`);

const SaveFoodMutation = graphql(`
  mutation SaveFood($id: uuid!, $set: foods_set_input!) {
    updateFood(pk_columns: { id: $id }, _set: $set) {
      id
    }
  }
`);

const DeleteFoodMutation = graphql(`
  mutation DeleteFood($id: uuid!) {
    deleteFood(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/nutrition/foods/$foodId_/edit")({
  component: EditFoodRoute,
});

function EditFoodRoute() {
  const { foodId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nutrition", "foods", "edit", foodId],
    queryFn: () => gqlRequest(EditFoodQuery, { id: foodId }),
  });

  const food = data?.food ?? null;
  const isOwner = Boolean(user && food && food.userId === user.id && !food.isPublic);

  useEffect(() => {
    if (!isLoading && food && !isOwner) {
      navigate({ to: "/nutrition/foods/$foodId", params: { foodId }, replace: true });
    }
  }, [food, foodId, isLoading, isOwner, navigate]);

  const initialValues = useMemo<FoodFormValues | null>(() => {
    if (!food) {
      return null;
    }
    return { name: food.name, ...normalizeMacros(food) };
  }, [food]);

  const saveMutation = useMutation({
    mutationFn: (values: FoodFormValues) =>
      gqlRequest(SaveFoodMutation, {
        id: foodId,
        set: {
          name: values.name,
          kcalPer100g: values.kcalPer100g,
          fatPer100g: values.fatPer100g,
          carbsPer100g: values.carbsPer100g,
          proteinPer100g: values.proteinPer100g,
          fiberPer100g: values.fiberPer100g,
          sugarPer100g: values.sugarPer100g,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "foods"] });
      toast.success("Food saved");
      navigate({ to: "/nutrition/foods/$foodId", params: { foodId }, replace: true });
    },
    onError: (error) => {
      toast.error(`Failed to save food: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteFoodMutation, { id: foodId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "foods"] });
      toast.success("Food deleted");
      navigate({ to: "/nutrition/foods", replace: true });
    },
    onError: (error) => {
      setConfirmDelete(false);
      const message = isFoodInUseError(error)
        ? "This food is used by a meal template or nutrition plan. Remove those references before deleting it."
        : `Failed to delete food: ${error.message}`;
      toast.error(message);
    },
  });

  function renderContent() {
    if (isLoading) {
      return (
        <PageShell maxWidth="2xl">
          <LibraryDetailSkeleton />
        </PageShell>
      );
    }
    if (error) {
      return (
        <PageShell maxWidth="2xl">
          <ErrorState
            title="Couldn’t load this food"
            message={error.message}
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        </PageShell>
      );
    }
    if (!food || !initialValues) {
      return (
        <PageShell maxWidth="2xl">
          <EmptyState title="Food not found" description="It may have been deleted." />
        </PageShell>
      );
    }
    if (!isOwner) {
      return null;
    }
    return (
      <FormPage
        title="Edit food"
        width="form"
        layout="sections"
        danger={
          <DangerZone
            title="Delete this food"
            description="Foods used by meals or plans can’t be deleted until they’re removed there."
            actionLabel="Delete food"
            onAction={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending || saveMutation.isPending}
          />
        }
      >
        <FoodForm
          initialValues={initialValues}
          submitLabel="Save"
          nameCaption={EDIT_FOOD_CAPTION}
          isSubmitting={saveMutation.isPending}
          onSubmit={(values) => saveMutation.mutate(values)}
          onCancel={() =>
            navigate({ to: "/nutrition/foods/$foodId", params: { foodId }, replace: true })
          }
        />
      </FormPage>
    );
  }

  return (
    <>
      {renderContent()}
      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={food ? `Delete ${food.name}?` : "Delete this food?"}
        description="This private food will be deleted. Days already logged keep their snapshot. This can't be undone."
        confirmLabel="Delete food"
        pendingLabel="Deleting…"
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
        destructive={true}
      />
    </>
  );
}
