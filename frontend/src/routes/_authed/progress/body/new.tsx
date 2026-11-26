import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BodyMeasurementForm } from "@/components/body-measurement-form";
import { FormPage } from "@/components/patterns/form-page";
import { graphql } from "@/gql";
import {
  type BodyMeasurementFormValues,
  bodyMeasurementInput,
  bodyMeasurementMutationError,
} from "@/lib/body-measurements";
import { todayLocalISO } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { useInvalidateBodyMeasurements } from "@/lib/hooks/use-progress-entry-invalidation";

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
  const invalidate = useInvalidateBodyMeasurements();

  const createMutation = useMutation({
    mutationFn: (values: BodyMeasurementFormValues) =>
      gqlRequest(InsertBodyMeasurementMutation, { obj: bodyMeasurementInput(values) }),
    onSuccess: (res) => {
      invalidate();
      const id = res.insertBodyMeasurement?.id;
      if (id) {
        navigate({ to: "/progress/body/$id", params: { id }, replace: true });
      } else {
        navigate({ to: "/progress/body", replace: true });
      }
    },
  });

  return (
    <FormPage title="New measurement" width="form" layout="sections">
      <BodyMeasurementForm
        initialValues={{
          measuredOn: todayLocalISO(),
          weightKg: "",
          bodyFatPct: "",
          notes: "",
        }}
        submitLabel="Create measurement"
        isSubmitting={createMutation.isPending}
        serverError={
          createMutation.error ? bodyMeasurementMutationError(createMutation.error, "save") : null
        }
        onEdit={() => {
          if (createMutation.isError) {
            createMutation.reset();
          }
        }}
        onSubmit={(values) => createMutation.mutate(values)}
        onCancel={() => navigate({ to: "/progress/body", replace: true })}
      />
    </FormPage>
  );
}
