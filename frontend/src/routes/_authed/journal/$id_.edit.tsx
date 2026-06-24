import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { JournalEntryForm, type JournalEntryFormValues } from "@/components/journal-entry-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { JournalLabels_Constraint } from "@/gql/graphql";
import { gqlRequest } from "@/lib/graphql";

const EditJournalEntryQuery = graphql(`
  query EditJournalEntry($id: uuid!) {
    journalEntry(id: $id) {
      id
      entryDate
      title
      body
      journalEntryLabels {
        labelId
        label {
          id
          name
        }
      }
    }
    journalLabels(order_by: { name: asc }) {
      id
      name
    }
  }
`);

const SaveJournalEntryMutation = graphql(`
  mutation SaveJournalEntry(
    $id: uuid!
    $set: journalEntries_set_input!
    $deleteLabelIds: [uuid!]!
    $hasDeleteLabels: Boolean!
    $insertLabels: [journalEntryLabels_insert_input!]!
    $hasInsertLabels: Boolean!
  ) {
    updateJournalEntry(pk_columns: { id: $id }, _set: $set) {
      id
    }
    deleteJournalEntryLabels(
      where: { journalEntryId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }
    ) @include(if: $hasDeleteLabels) {
      affected_rows
    }
    insertJournalEntryLabels(
      objects: $insertLabels
      on_conflict: { constraint: journal_entry_labels_pkey, update_columns: [] }
    ) @include(if: $hasInsertLabels) {
      affected_rows
    }
  }
`);

const DeleteJournalEntryMutation = graphql(`
  mutation DeleteJournalEntry($id: uuid!) {
    deleteJournalEntry(id: $id) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/journal/$id_/edit")({
  component: EditJournalEntryRoute,
});

function EditJournalEntryRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["journal_entries", id, "edit"],
    queryFn: () => gqlRequest(EditJournalEntryQuery, { id }),
  });

  const entry = data?.journalEntry ?? null;

  const initialValues = useMemo<JournalEntryFormValues | null>(() => {
    if (!entry) {
      return null;
    }
    return {
      entryDate: entry.entryDate,
      title: entry.title ?? "",
      body: entry.body,
      labels: entry.journalEntryLabels.map((jel) => ({ id: jel.label.id, name: jel.label.name })),
    };
  }, [entry]);

  const saveMutation = useMutation({
    mutationFn: (values: JournalEntryFormValues) => {
      if (!initialValues) {
        throw new Error("Entry not loaded");
      }
      const originalIds = new Set(
        initialValues.labels.map((l) => l.id).filter((lid): lid is string => Boolean(lid)),
      );
      const nextIds = new Set(
        values.labels.map((l) => l.id).filter((lid): lid is string => Boolean(lid)),
      );
      const deleteLabelIds = [...originalIds].filter((lid) => !nextIds.has(lid));
      const insertLabels = values.labels
        .filter((l) => !l.id || !originalIds.has(l.id))
        .map((l) =>
          l.id
            ? { journalEntryId: id, labelId: l.id }
            : {
                journalEntryId: id,
                label: {
                  data: { name: l.name },
                  on_conflict: {
                    constraint: JournalLabels_Constraint.JournalLabelsUserNameKey,
                    update_columns: [],
                  },
                },
              },
        );

      return gqlRequest(SaveJournalEntryMutation, {
        id,
        set: {
          entryDate: values.entryDate,
          title: values.title || null,
          body: values.body,
        },
        deleteLabelIds,
        hasDeleteLabels: deleteLabelIds.length > 0,
        insertLabels,
        hasInsertLabels: insertLabels.length > 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      queryClient.invalidateQueries({ queryKey: ["journal_labels"] });
      navigate({ to: "/journal/$id", params: { id }, replace: true });
    },
    onError: (e) => {
      toast.error(`Failed to save: ${e.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteJournalEntryMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      navigate({ to: "/journal", replace: true });
    },
    onError: (e) => {
      toast.error(`Failed to delete: ${e.message}`);
    },
  });

  function renderContent() {
    if (isLoading) {
      return <EditSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!entry || !initialValues) {
      return <p className="text-sm text-muted-foreground">Entry not found.</p>;
    }
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl tracking-tight">
            {entry.title ?? "Untitled entry"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <JournalEntryForm
            initialValues={initialValues}
            submitLabel="Save changes"
            isSubmitting={saveMutation.isPending}
            labelSuggestions={data?.journalLabels ?? []}
            onSubmit={(values) => saveMutation.mutate(values)}
            onCancel={() => navigate({ to: "/journal/$id", params: { id }, replace: true })}
            extraActions={
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMutation.isPending || saveMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete entry
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Edit</p>
        {renderContent()}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              The entry and its label associations will be removed. Your custom labels stay
              available for future entries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EditSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <Skeleton className="h-7 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  );
}
