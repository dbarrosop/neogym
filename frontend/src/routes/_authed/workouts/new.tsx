import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BackLink } from "@/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutForm, type WorkoutFormValues } from "@/components/workout-form";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const CreateWorkoutMutation = graphql(`
  mutation CreateWorkout($obj: workouts_insert_input!) {
    insertWorkout(object: $obj) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/workouts/new")({
  component: NewWorkoutRoute,
});

function NewWorkoutRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: WorkoutFormValues) =>
      gqlRequest(CreateWorkoutMutation, {
        obj: {
          name: values.name,
          description: values.description || null,
          workoutExercises: {
            data: values.exercises.map((e, idx) => ({
              exerciseId: e.exerciseId,
              position: idx + 1,
            })),
          },
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      const id = res.insertWorkout?.id;
      // Replace so the (now-submitted) form doesn't sit on the history stack.
      if (id) {
        navigate({
          to: "/workouts/$workoutId",
          params: { workoutId: id },
          replace: true,
        });
      } else {
        navigate({ to: "/workouts", replace: true });
      }
      toast.success("Workout created");
    },
    onError: (e) => {
      toast.error(`Failed to create: ${e.message}`);
    },
  });

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-1">
              <BackLink fallback="/workouts" />
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Plans
              </p>
            </div>
            <CardTitle className="text-2xl tracking-tight">New workout</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkoutForm
              initialValues={{ name: "", description: "", exercises: [] }}
              submitLabel="Create workout"
              isSubmitting={createMutation.isPending}
              onSubmit={(values) => createMutation.mutate(values)}
              onCancel={() => navigate({ to: "/workouts", replace: true })}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
