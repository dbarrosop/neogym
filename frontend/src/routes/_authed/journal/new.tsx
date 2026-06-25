import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { JournalEntryForm, type JournalEntryFormValues } from "@/components/journal-entry-form";
import { FormCardShell, PageShell } from "@/components/patterns/page-shell";
import { graphql } from "@/gql";
import { JournalLabels_Constraint } from "@/gql/graphql";
import { todayLocalISO } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";

const JournalLabelsForFormQuery = graphql(`
  query JournalLabelsForForm {
    journalLabels(order_by: { name: asc }) {
      id
      name
    }
  }
`);

const InsertJournalEntryMutation = graphql(`
  mutation InsertJournalEntry($obj: journalEntries_insert_input!) {
    insertJournalEntry(object: $obj) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/journal/new")({
  component: NewJournalEntryRoute,
});

function NewJournalEntryRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: labelsData } = useQuery({
    queryKey: ["journal_labels"],
    queryFn: () => gqlRequest(JournalLabelsForFormQuery),
  });

  const createMutation = useMutation({
    mutationFn: (values: JournalEntryFormValues) =>
      gqlRequest(InsertJournalEntryMutation, {
        obj: {
          entryDate: values.entryDate,
          title: values.title || null,
          body: values.body,
          journalEntryLabels: {
            data: values.labels.map((l) =>
              l.id
                ? { labelId: l.id }
                : {
                    label: {
                      data: { name: l.name },
                      on_conflict: {
                        constraint: JournalLabels_Constraint.JournalLabelsUserNameKey,
                        update_columns: [],
                      },
                    },
                  },
            ),
          },
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal_labels"] });
      const id = res.insertJournalEntry?.id;
      if (id) {
        navigate({ to: "/journal/$id", params: { id }, replace: true });
      } else {
        navigate({ to: "/journal", replace: true });
      }
    },
    onError: (e) => {
      toast.error(`Failed to save: ${e.message}`);
    },
  });

  return (
    <PageShell maxWidth="2xl">
      <FormCardShell eyebrow="Tracking" title="New entry">
        <JournalEntryForm
          initialValues={{
            entryDate: todayLocalISO(),
            title: "",
            body: "",
            labels: [],
          }}
          submitLabel="Save entry"
          isSubmitting={createMutation.isPending}
          labelSuggestions={labelsData?.journalLabels ?? []}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => navigate({ to: "/journal", replace: true })}
        />
      </FormCardShell>
    </PageShell>
  );
}
