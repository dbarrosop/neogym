import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const JournalLabelsQuery = graphql(`
  query JournalLabelsForNew {
    journalLabels(order_by: { name: asc }) {
      id
      name
      color
    }
  }
`);

const InsertJournalEntryMutation = graphql(`
  mutation InsertJournalEntry($object: journalEntries_insert_input!) {
    insertJournalEntry(object: $object) {
      id
    }
  }
`);

export const Route = createFileRoute("/_authed/journal/new")({
  component: JournalNewRoute,
});

function JournalNewRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());

  const { data: labelsData } = useQuery({
    queryKey: ["journal-labels"],
    queryFn: () => gqlRequest(JournalLabelsQuery),
  });

  const labels = labelsData?.journalLabels ?? [];

  const insertMutation = useMutation({
    mutationFn: () =>
      gqlRequest(InsertJournalEntryMutation, {
        object: {
          entryDate: date,
          title: title.trim() || null,
          content,
          journalEntryLabels: {
            data: [...selectedLabelIds].map((labelId) => ({ labelId })),
          },
        },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      const id = result.insertJournalEntry?.id;
      toast.success("Entry saved");
      if (id) {
        navigate({ to: "/journal/$entryId", params: { entryId: id }, replace: true });
      } else {
        navigate({ to: "/journal", replace: true });
      }
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

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Journal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">New entry</h1>
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
            onClick={() => navigate({ to: "/journal", replace: true })}
            disabled={insertMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => insertMutation.mutate()}
            disabled={!content.trim() || insertMutation.isPending}
          >
            {insertMutation.isPending ? "Saving…" : "Save entry"}
          </Button>
        </div>
      </div>
    </section>
  );
}
