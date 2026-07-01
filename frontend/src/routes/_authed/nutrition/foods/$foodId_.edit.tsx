import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FoodForm, type FoodFormValues } from "@/components/food-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
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

  const { data, isLoading, error } = useQuery({
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
      const message = isFoodInUseError(error)
        ? "This food is used by a meal template or nutrition plan. Remove those references before deleting it."
        : `Failed to delete food: ${error.message}`;
      toast.error(message);
    },
  });

  function renderContent() {
    if (isLoading) {
      return <EditFoodSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!food || !initialValues) {
      return <p className="text-sm text-muted-foreground">Food not found.</p>;
    }
    if (!isOwner) {
      return null;
    }
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Edit food
          </p>
          <CardTitle className="text-2xl tracking-tight">{food.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <FoodForm
            initialValues={initialValues}
            submitLabel="Save changes"
            isSubmitting={saveMutation.isPending}
            onSubmit={(values) => saveMutation.mutate(values)}
            onCancel={() =>
              navigate({ to: "/nutrition/foods/$foodId", params: { foodId }, replace: true })
            }
            extraActions={
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMutation.isPending || saveMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete food
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {renderContent()}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this food?</DialogTitle>
            <DialogDescription>
              {food?.name
                ? `"${food.name}" will be removed from your private food catalog.`
                : "This food will be removed from your private food catalog."}{" "}
              Food used by meal templates or nutrition plans cannot be deleted until those
              references are removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete food"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditFoodSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-16 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
