import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { DailyEnergyForm } from "@/components/daily-energy-form";
import { FormPage } from "@/components/patterns/form-page";
import { graphql } from "@/gql";
import {
  type DailyEnergyFormValues,
  dailyEnergyInput,
  dailyEnergyMutationError,
} from "@/lib/daily-energy";
import { parseDateOnly, todayLocalISO } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { useInvalidateDailyEnergy } from "@/lib/hooks/use-progress-entry-invalidation";

const searchSchema = z.object({
  date: z.string().optional(),
});

const InsertDailyEnergyMutation = graphql(`
  mutation InsertDailyEnergy($obj: dailyEnergy_insert_input!) {
    insertDailyEnergyEntry(object: $obj) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/progress/energy/new")({
  validateSearch: searchSchema,
  component: NewDailyEnergyRoute,
});

function NewDailyEnergyRoute() {
  const navigate = useNavigate();
  const invalidate = useInvalidateDailyEnergy();
  const { date } = Route.useSearch();
  const initialEnergyOn = date && parseDateOnly(date) ? date : todayLocalISO();

  const createMutation = useMutation({
    mutationFn: (values: DailyEnergyFormValues) =>
      gqlRequest(InsertDailyEnergyMutation, { obj: dailyEnergyInput(values) }),
    onSuccess: (res) => {
      invalidate();
      const id = res.insertDailyEnergyEntry?.id;
      if (id) {
        navigate({ to: "/progress/energy/$id", params: { id }, replace: true });
      } else {
        navigate({ to: "/progress/energy", replace: true });
      }
    },
  });

  return (
    <FormPage title="New energy day" width="form" layout="sections">
      <DailyEnergyForm
        initialValues={{
          energyOn: initialEnergyOn,
          activeKcal: "",
          restingKcal: "",
          notes: "",
        }}
        submitLabel="Create energy day"
        isSubmitting={createMutation.isPending}
        serverError={
          createMutation.error ? dailyEnergyMutationError(createMutation.error, "save") : null
        }
        onEdit={() => {
          if (createMutation.isError) {
            createMutation.reset();
          }
        }}
        onSubmit={(values) => createMutation.mutate(values)}
        onCancel={() => navigate({ to: "/progress/energy", replace: true })}
      />
    </FormPage>
  );
}
