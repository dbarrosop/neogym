import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { NutritionPlanForm, type NutritionPlanFormValues } from "@/components/nutrition-plan-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const CreateNutritionPlanMutation = graphql(`
  mutation CreateNutritionPlan($object: nutritionPlans_insert_input!) {
    insertNutritionPlan(object: $object) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/nutrition/plans/new")({
  component: NewNutritionPlanRoute,
});

const EMPTY_PLAN: NutritionPlanFormValues = {
  name: "",
  description: "",
  entries: [],
};

function NewNutritionPlanRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: NutritionPlanFormValues) =>
      gqlRequest(CreateNutritionPlanMutation, {
        object: {
          name: values.name,
          description: values.description === "" ? null : values.description,
          nutritionPlanMeals: {
            data: values.entries
              .filter((entry) => entry.kind === "meal")
              .map((entry) => ({
                mealId: entry.mealId,
                slotTime: entry.slotTime,
                label: entry.label === "" ? null : entry.label,
                position: entry.position,
              })),
          },
          nutritionPlanFoods: {
            data: values.entries
              .filter((entry) => entry.kind === "food")
              .map((entry) => ({
                foodId: entry.foodId,
                grams: entry.grams,
                slotTime: entry.slotTime,
                label: entry.label === "" ? null : entry.label,
                position: entry.position,
              })),
          },
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", "plans"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "days"] });
      toast.success("Plan created");
      const id = data.insertNutritionPlan?.id;
      if (id) {
        navigate({ to: "/nutrition/plans/$planId", params: { planId: id }, replace: true });
      } else {
        navigate({ to: "/nutrition/plans", replace: true });
      }
    },
    onError: (error) => {
      toast.error(`Failed to create plan: ${error.message}`);
    },
  });

  return (
    <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <CardHeader className="pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Daily plans
        </p>
        <CardTitle className="text-2xl tracking-tight">New plan</CardTitle>
      </CardHeader>
      <CardContent>
        <NutritionPlanForm
          initialValues={EMPTY_PLAN}
          submitLabel="Create plan"
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => navigate({ to: "/nutrition/plans", replace: true })}
        />
      </CardContent>
    </Card>
  );
}
