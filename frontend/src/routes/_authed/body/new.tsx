import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BodyMeasurementForm,
  type BodyMeasurementFormValues,
} from "@/components/body-measurement-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { graphql } from "@/gql";
import { todayLocalISO } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";

const InsertBodyMeasurementMutation = graphql(`
  mutation InsertBodyMeasurement($obj: bodyMeasurements_insert_input!) {
    insertBodyMeasurement(object: $obj) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/body/new")({
  component: NewBodyMeasurementRoute,
});

function NewBodyMeasurementRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: BodyMeasurementFormValues) =>
      gqlRequest(InsertBodyMeasurementMutation, {
        obj: {
          measuredOn: values.measuredOn,
          weightKg: values.weightKg ? values.weightKg : null,
          bodyFatPct: values.bodyFatPct ? values.bodyFatPct : null,
          notes: values.notes ? values.notes : null,
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["body_measurements"] });
      const id = res.insertBodyMeasurement?.id;
      if (id) {
        navigate({ to: "/body/$id", params: { id }, replace: true });
      } else {
        navigate({ to: "/body", replace: true });
      }
    },
    onError: (e) => {
      toast.error(`Failed to save: ${e.message}`);
    },
  });

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <CardHeader className="pb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tracking
            </p>
            <CardTitle className="text-2xl tracking-tight">New measurement</CardTitle>
          </CardHeader>
          <CardContent>
            <BodyMeasurementForm
              initialValues={{
                measuredOn: todayLocalISO(),
                weightKg: "",
                bodyFatPct: "",
                notes: "",
              }}
              submitLabel="Save measurement"
              isSubmitting={createMutation.isPending}
              onSubmit={(values) => createMutation.mutate(values)}
              onCancel={() => navigate({ to: "/body", replace: true })}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
