import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { MealForm, type MealFormValues } from "@/components/meal-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const CreateMealMutation = graphql(`
  mutation CreateMeal($object: meals_insert_input!) {
    insertMeal(object: $object) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/nutrition/meals/new")({
  component: NewMealRoute,
});

const EMPTY_MEAL: MealFormValues = {
  name: "",
  description: "",
  ingredients: [],
};

function NewMealRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: MealFormValues) =>
      gqlRequest(CreateMealMutation, {
        object: {
          name: values.name,
          description: values.description === "" ? null : values.description,
          mealIngredients: {
            data: values.ingredients.map((ingredient) => ({
              foodId: ingredient.foodId,
              grams: ingredient.grams,
              position: ingredient.position,
            })),
          },
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "meals"] });
      toast.success("Meal created");
      const id = data.insertMeal?.id;
      if (id) {
        navigate({ to: "/nutrition/meals/$mealId", params: { mealId: id }, replace: true });
      } else {
        navigate({ to: "/nutrition/meals", replace: true });
      }
    },
    onError: (error) => {
      toast.error(`Failed to create meal: ${error.message}`);
    },
  });

  return (
    <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <CardHeader className="pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Meal templates
        </p>
        <CardTitle className="text-2xl tracking-tight">New meal</CardTitle>
      </CardHeader>
      <CardContent>
        <MealForm
          initialValues={EMPTY_MEAL}
          submitLabel="Create meal"
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => navigate({ to: "/nutrition/meals", replace: true })}
        />
      </CardContent>
    </Card>
  );
}
