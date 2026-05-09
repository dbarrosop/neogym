import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { gqlRequest } from "@/lib/graphql";

const JournalEntryQuery = graphql(`
  query JournalEntry($id: uuid!) {
    journalEntry(id: $id) {
      id
      entryDate
      title
      content
      createdAt
      updatedAt
      journalEntryLabels {
        journalLabel {
          id
          name
          color
        }
      }
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

export const Route = createFileRoute("/_authed/journal/$entryId")({
  component: JournalEntryRoute,
});

function JournalEntryRoute() {
  const { entryId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["journal-entry", entryId],
    queryFn: () => gqlRequest(JournalEntryQuery, { id: entryId }),
    enabled: Boolean(entryId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlRequest(DeleteJournalEntryMutation, { id: entryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.removeQueries({ queryKey: ["journal-entry", entryId] });
      toast.success("Entry deleted");
      navigate({ to: "/journal", replace: true });
    },
    onError: (e) => {
      toast.error(e.message);
      setConfirmDelete(false);
    },
  });

  if (isLoading) {
    return (
      <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !data?.journalEntry) {
    return (
      <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-destructive">
            {error ? `Failed to load: ${error.message}` : "Entry not found."}
          </p>
        </div>
      </section>
    );
  }

  const entry = data.journalEntry;
  const labels = entry.journalEntryLabels.flatMap((jel) =>
    jel.journalLabel ? [jel.journalLabel] : [],
  );

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {new Date(entry.entryDate).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </p>
            {entry.title ? (
              <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
            ) : (
              <h1 className="text-3xl font-semibold tracking-tight text-muted-foreground">
                Untitled
              </h1>
            )}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {labels.map((l) => (
                  <Badge
                    key={l.id}
                    variant="outline"
                    className="h-5 px-1.5 text-[10px]"
                    style={{ borderColor: l.color, color: l.color }}
                  >
                    {l.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/journal/$entryId/edit" params={{ entryId }}>
                <Edit className="mr-1 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <Card className="border-border/60">
          <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Last updated{" "}
          {new Date(entry.updatedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete entry?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
