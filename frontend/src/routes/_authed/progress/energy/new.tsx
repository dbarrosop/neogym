import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { DailyEnergyForm, type DailyEnergyFormValues } from "@/components/daily-energy-form";
import { FormCardShell, PageShell } from "@/components/patterns/page-shell";
import { graphql } from "@/gql";
import { dailyEnergyMutationErrorMessage } from "@/lib/daily-energy";
import { parseDateOnly, todayLocalISO } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";

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
  const queryClient = useQueryClient();
  const { date } = Route.useSearch();
  const initialEnergyOn = date && parseDateOnly(date) ? date : todayLocalISO();

  const createMutation = useMutation({
    mutationFn: (values: DailyEnergyFormValues) =>
      gqlRequest(InsertDailyEnergyMutation, {
        obj: {
          energyOn: values.energyOn,
          activeKcal: values.activeKcal ? values.activeKcal : null,
          restingKcal: values.restingKcal ? values.restingKcal : null,
          notes: values.notes ? values.notes : null,
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["daily_energy"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "energy-projection"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      const id = res.insertDailyEnergyEntry?.id;
      if (id) {
        navigate({ to: "/progress/energy/$id", params: { id }, replace: true });
      } else {
        navigate({ to: "/progress/energy", replace: true });
      }
    },
    onError: (e) => {
      toast.error(dailyEnergyMutationErrorMessage(e, "save"));
    },
  });

  return (
    <PageShell maxWidth="2xl">
      <FormCardShell eyebrow="Tracking" title="New energy day">
        <DailyEnergyForm
          initialValues={{
            energyOn: initialEnergyOn,
            activeKcal: "",
            restingKcal: "",
            notes: "",
          }}
          submitLabel="Save energy day"
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => navigate({ to: "/progress/energy", replace: true })}
        />
      </FormCardShell>
    </PageShell>
  );
}
