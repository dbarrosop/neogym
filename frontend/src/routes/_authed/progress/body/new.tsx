import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BodyMeasurementForm,
  type BodyMeasurementFormValues,
} from "@/components/body-measurement-form";
import { FormPage } from "@/components/patterns/form-page";
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

export const Route = createFileRoute("/_authed/progress/body/new")({
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
      queryClient.invalidateQueries({ queryKey: ["today"] });
      const id = res.insertBodyMeasurement?.id;
      if (id) {
        navigate({ to: "/progress/body/$id", params: { id }, replace: true });
      } else {
        navigate({ to: "/progress/body", replace: true });
      }
    },
    onError: (e) => {
      toast.error(`Failed to save: ${e.message}`);
    },
  });

  return (
    <FormPage title="New measurement" width="2xl">
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
        onCancel={() => navigate({ to: "/progress/body", replace: true })}
      />
    </FormPage>
  );
}
