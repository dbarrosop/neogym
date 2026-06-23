import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { FoodForm, type FoodFormValues } from "@/components/food-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const CreateFoodMutation = graphql(`
  mutation CreateFood($object: foods_insert_input!) {
    insertFood(object: $object) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/nutrition/foods/new")({
  component: NewFoodRoute,
});

const EMPTY_FOOD: FoodFormValues = {
  name: "",
  kcalPer100g: 0,
  fatPer100g: 0,
  carbsPer100g: 0,
  proteinPer100g: 0,
  fiberPer100g: 0,
  sugarPer100g: 0,
};

function NewFoodRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: FoodFormValues) =>
      gqlRequest(CreateFoodMutation, {
        object: {
          name: values.name,
          kcalPer100g: values.kcalPer100g,
          fatPer100g: values.fatPer100g,
          carbsPer100g: values.carbsPer100g,
          proteinPer100g: values.proteinPer100g,
          fiberPer100g: values.fiberPer100g,
          sugarPer100g: values.sugarPer100g,
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "foods"] });
      toast.success("Food created");
      const id = data.insertFood?.id;
      if (id) {
        navigate({ to: "/nutrition/foods/$foodId", params: { foodId: id }, replace: true });
      } else {
        navigate({ to: "/nutrition/foods", replace: true });
      }
    },
    onError: (error) => {
      toast.error(`Failed to create food: ${error.message}`);
    },
  });

  return (
    <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <CardHeader className="pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Food catalog
        </p>
        <CardTitle className="text-2xl tracking-tight">New food</CardTitle>
      </CardHeader>
      <CardContent>
        <FoodForm
          initialValues={EMPTY_FOOD}
          submitLabel="Create food"
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => navigate({ to: "/nutrition/foods", replace: true })}
        />
      </CardContent>
    </Card>
  );
}
