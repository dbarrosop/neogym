import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { BodyMeasurementForm } from "@/components/body-measurement-form";
import { DailyEnergyForm } from "@/components/daily-energy-form";
import { graphql } from "@/gql";
import {
  type BodyMeasurementFormValues,
  bodyMeasurementInput,
  bodyMeasurementMutationError,
} from "@/lib/body-measurements";
import {
  type DailyEnergyFormValues,
  dailyEnergyInput,
  dailyEnergyMutationError,
} from "@/lib/daily-energy";
import { todayLocalISO } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import {
  useInvalidateBodyMeasurements,
  useInvalidateDailyEnergy,
} from "@/lib/hooks/use-progress-entry-invalidation";

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
  children: ReactNode;
  note: string;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3.5 rounded-xl border bg-card p-5"
    >
      <h2 id={titleId} className="text-[17px] font-semibold">
        {title}
      </h2>
      {children}
      <p className="text-[13px] leading-normal text-muted-foreground">{note}</p>
    </section>
  );
}

/** Inline "Log measurement" card for the Body page; stays on the page after saving. */
export function QuickBodyMeasurementForm() {
  const invalidate = useInvalidateBodyMeasurements();
  const [formKey, setFormKey] = useState(0);
  const mutation = useMutation({
    mutationFn: (values: BodyMeasurementFormValues) =>
      gqlRequest(QuickInsertBodyMeasurementMutation, { obj: bodyMeasurementInput(values) }),
    onSuccess: () => {
      invalidate();
      toast.success("Measurement saved");
      setFormKey((key) => key + 1);
    },
  });
  const reset = () => {
    mutation.reset();
    setFormKey((key) => key + 1);
  };
  return (
    <QuickFormCard
      title="Log measurement"
      note="One entry per date with at least one value. The iPhone app can import weight and body fat from Apple Health."
    >
      <BodyMeasurementForm
        key={formKey}
        variant="quick"
        initialValues={{ measuredOn: todayLocalISO(), weightKg: "", bodyFatPct: "", notes: "" }}
        submitLabel="Save"
        isSubmitting={mutation.isPending}
        serverError={mutation.error ? bodyMeasurementMutationError(mutation.error, "save") : null}
        onEdit={() => {
          if (mutation.isError) {
            mutation.reset();
          }
        }}
        onSubmit={(values) => mutation.mutate(values)}
        onCancel={reset}
      />
    </QuickFormCard>
  );
}

/** Inline "Log energy" card for the Energy page; stays on the page after saving. */
export function QuickDailyEnergyForm() {
  const invalidate = useInvalidateDailyEnergy();
  const [formKey, setFormKey] = useState(0);
  const mutation = useMutation({
    mutationFn: (values: DailyEnergyFormValues) =>
      gqlRequest(QuickInsertDailyEnergyMutation, { obj: dailyEnergyInput(values) }),
    onSuccess: () => {
      invalidate();
      toast.success("Energy saved");
      setFormKey((key) => key + 1);
    },
  });
  const reset = () => {
    mutation.reset();
    setFormKey((key) => key + 1);
  };
  return (
    <QuickFormCard
      title="Log energy"
      note="One row per date, at least one value. The NeoGym Apple Watch app imports these from Apple Health."
    >
      <DailyEnergyForm
        key={formKey}
        variant="quick"
        initialValues={{ energyOn: todayLocalISO(), activeKcal: "", restingKcal: "", notes: "" }}
        submitLabel="Save"
        isSubmitting={mutation.isPending}
        serverError={mutation.error ? dailyEnergyMutationError(mutation.error, "save") : null}
        onEdit={() => {
          if (mutation.isError) {
            mutation.reset();
          }
        }}
        onSubmit={(values) => mutation.mutate(values)}
        onCancel={reset}
      />
    </QuickFormCard>
  );
}
