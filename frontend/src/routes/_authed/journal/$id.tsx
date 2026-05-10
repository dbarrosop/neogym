import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Tag } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const JournalEntryByIdQuery = graphql(`
  query JournalEntryById($id: uuid!) {
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
  }
`);

export const Route = createFileRoute("/_authed/journal/$id")({
  component: JournalEntryDetailRoute,
});

function JournalEntryDetailRoute() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["journal_entries", id],
    queryFn: () => gqlRequest(JournalEntryByIdQuery, { id }),
  });

  function renderContent() {
    if (isLoading) {
      return <DetailSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (!data?.journalEntry) {
      return <p className="text-sm text-muted-foreground">Entry not found.</p>;
    }
    const entry = data.journalEntry;
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
                {formatDate(entry.entryDate)}
              </p>
              <CardTitle className="text-2xl tracking-tight">
                {entry.title ?? "Untitled entry"}
              </CardTitle>
            </div>
            <Button asChild size="icon" variant="ghost" aria-label="Edit entry">
              <Link to="/journal/$id/edit" params={{ id: entry.id }}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {entry.journalEntryLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {entry.journalEntryLabels.map((jel) => (
                <Badge key={jel.labelId} variant="primary">
                  <Tag className="h-3 w-3" />
                  {jel.label.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <Markdown>{entry.body}</Markdown>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl space-y-6">{renderContent()}</div>
    </section>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) {
    return iso;
  }
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DetailSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-64" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  );
}
