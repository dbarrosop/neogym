import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BodyMeasurementForm } from "@/components/body-measurement-form";
import { DailyEnergyForm } from "@/components/daily-energy-form";
import { graphql } from "@/gql";
import { type DailyEnergyFormValues, dailyEnergyMutationErrorMessage } from "@/lib/daily-energy";
import { todayLocalISO } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";

const QuickInsertBodyMeasurementMutation = graphql(`
  mutation QuickInsertBodyMeasurement($obj: bodyMeasurements_insert_input!) {
    insertBodyMeasurement(object: $obj) {
      id
    }
  }
`);

const QuickInsertDailyEnergyMutation = graphql(`
  mutation QuickInsertDailyEnergy($obj: dailyEnergy_insert_input!) {
    insertDailyEnergyEntry(object: $obj) {
      id
    }
  }
`);

function QuickFormCard({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note: string;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
      <p className="text-[12px] text-muted-foreground">{note}</p>
    </section>
  );
}

/** Inline "log measurement" card for the Body page; stays on the page after saving. */
export function QuickBodyMeasurementForm() {
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const mutation = useMutation({
    mutationFn: (values: {
      measuredOn: string;
      weightKg: string;
      bodyFatPct: string;
      notes: string;
    }) =>
      gqlRequest(QuickInsertBodyMeasurementMutation, {
        obj: {
          measuredOn: values.measuredOn,
          weightKg: values.weightKg ? values.weightKg : null,
          bodyFatPct: values.bodyFatPct ? values.bodyFatPct : null,
          notes: values.notes ? values.notes : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body_measurements"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      toast.success("Measurement saved");
      setFormKey((key) => key + 1);
    },
    onError: (e) => toast.error(`Failed to save: ${e.message}`),
  });
  return (
    <QuickFormCard
      title="Log measurement"
      note="One entry per date with at least one value. The iPhone app can import weight and body fat from Apple Health."
    >
      <BodyMeasurementForm
        key={formKey}
        initialValues={{ measuredOn: todayLocalISO(), weightKg: "", bodyFatPct: "", notes: "" }}
        submitLabel="Save"
        isSubmitting={mutation.isPending}
        onSubmit={(values) => mutation.mutate(values)}
        onCancel={() => setFormKey((key) => key + 1)}
      />
    </QuickFormCard>
  );
}

/** Inline "log energy" card for the Energy page; stays on the page after saving. */
export function QuickDailyEnergyForm() {
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const mutation = useMutation({
    mutationFn: (values: DailyEnergyFormValues) =>
      gqlRequest(QuickInsertDailyEnergyMutation, {
        obj: {
          energyOn: values.energyOn,
          activeKcal: values.activeKcal ? values.activeKcal : null,
          restingKcal: values.restingKcal ? values.restingKcal : null,
          notes: values.notes ? values.notes : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily_energy"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition", "energy-projection"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      toast.success("Energy saved");
      setFormKey((key) => key + 1);
    },
    onError: (e) => toast.error(dailyEnergyMutationErrorMessage(e, "save")),
  });
  return (
    <QuickFormCard
      title="Log energy"
      note="Active and resting kilocalories for one date. The NeoGym Apple Watch app can import them from Apple Health."
    >
      <DailyEnergyForm
        key={formKey}
        initialValues={{ energyOn: todayLocalISO(), activeKcal: "", restingKcal: "", notes: "" }}
        submitLabel="Save"
        isSubmitting={mutation.isPending}
        onSubmit={(values) => mutation.mutate(values)}
        onCancel={() => setFormKey((key) => key + 1)}
      />
    </QuickFormCard>
  );
}
