import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const JournalEntryEditQuery = graphql(`
  query JournalEntryEdit($id: uuid!) {
    journalEntry(id: $id) {
      id
      entryDate
      title
      content
      journalEntryLabels {
        labelId
        journalLabel {
          id
          name
          color
        }
      }
    }
    journalLabels(order_by: { name: asc }) {
      id
      name
      color
    }
  }
`);

const UpdateJournalEntryMutation = graphql(`
  mutation UpdateJournalEntry($id: uuid!, $set: journalEntries_set_input!) {
    updateJournalEntry(pk_columns: { id: $id }, _set: $set) {
      id
      entryDate
      title
      content
      updatedAt
    }
  }
`);

const DeleteJournalEntryLabelsMutation = graphql(`
  mutation DeleteJournalEntryLabels($entryId: uuid!) {
    deleteJournalEntryLabels(where: { entryId: { _eq: $entryId } }) {
      affected_rows
    }
  }
`);

const InsertJournalEntryLabelsMutation = graphql(`
  mutation InsertJournalEntryLabels($objects: [journalEntryLabels_insert_input!]!) {
    insertJournalEntryLabels(objects: $objects) {
      affected_rows
    }
  }
`);

export const Route = createFileRoute("/_authed/journal/$entryId_/edit")({
  component: JournalEntryEditRoute,
});

function JournalEntryEditRoute() {
  const { entryId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["journal-entry-edit", entryId],
    queryFn: () => gqlRequest(JournalEntryEditQuery, { id: entryId }),
    enabled: Boolean(entryId),
  });

  useEffect(() => {
    if (data?.journalEntry && !initialized) {
      const entry = data.journalEntry;
      setDate(entry.entryDate);
      setTitle(entry.title ?? "");
      setContent(entry.content);
      setSelectedLabelIds(new Set(entry.journalEntryLabels.map((jel) => jel.labelId)));
      setInitialized(true);
    }
  }, [data, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await gqlRequest(UpdateJournalEntryMutation, {
        id: entryId,
        set: {
          entryDate: date,
          title: title.trim() || null,
          content,
        },
      });
      await gqlRequest(DeleteJournalEntryLabelsMutation, { entryId });
      if (selectedLabelIds.size > 0) {
        await gqlRequest(InsertJournalEntryLabelsMutation, {
          objects: [...selectedLabelIds].map((labelId) => ({ entryId, labelId })),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entry", entryId] });
      queryClient.removeQueries({ queryKey: ["journal-entry-edit", entryId] });
      toast.success("Entry updated");
      navigate({ to: "/journal/$entryId", params: { entryId }, replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const labels = data?.journalLabels ?? [];

  if (isLoading && !initialized) {
    return (
      <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton className="h-9 w-40" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Journal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Edit entry</h1>
        </header>

        <Card className="border-border/60">
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-1.5">
              <Label htmlFor="je-date">Date</Label>
              <Input
                id="je-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="je-title">Title (optional)</Label>
              <Input
                id="je-title"
                placeholder="Give this entry a title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="je-content">Content</Label>
              <Textarea
                id="je-content"
                placeholder="Write your thoughts… Markdown is supported."
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="resize-none font-mono text-sm"
              />
            </div>

            {labels.length > 0 && (
              <div className="space-y-2">
                <Label>Labels</Label>
                <div className="flex flex-wrap gap-2">
                  {labels.map((l) => {
                    const active = selectedLabelIds.has(l.id);
                    return (
                      <button key={l.id} type="button" onClick={() => toggleLabel(l.id)}>
                        <Badge
                          variant="outline"
                          className="cursor-pointer px-2 py-0.5 transition-colors"
                          style={{
                            borderColor: l.color,
                            color: active ? "#fff" : l.color,
                            backgroundColor: active ? l.color : "transparent",
                          }}
                        >
                          {l.name}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() =>
              navigate({ to: "/journal/$entryId", params: { entryId }, replace: true })
            }
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!content.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </section>
  );
}
