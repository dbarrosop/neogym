import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BodyMeasurementForm,
  type BodyMeasurementFormValues,
} from "@/components/body-measurement-form";
import { FormCardShell, PageShell } from "@/components/patterns/page-shell";
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
    <PageShell maxWidth="2xl">
      <FormCardShell eyebrow="Tracking" title="New measurement">
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
      </FormCardShell>
    </PageShell>
  );
}
