import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { formatDateLong } from "@/lib/dates";
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
      return <ErrorState title="Failed to load entry" message={error.message} />;
    }
    if (!data?.journalEntry) {
      return <EmptyState title="Entry not found." />;
    }
    const entry = data.journalEntry;
    return (
      <article className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">
              {formatDateLong(entry.entryDate)}
            </p>
            <h2 className="text-[22px] font-bold tracking-tight">
              {entry.title ?? "Untitled entry"}
            </h2>
            {entry.journalEntryLabels.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {entry.journalEntryLabels.map((jel) => (
                  <span
                    key={jel.labelId}
                    className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent-soft-foreground"
                  >
                    {jel.label.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <Button asChild variant="outline">
            <Link to="/journal/$id/edit" params={{ id: entry.id }}>
              <Pencil />
              Edit
            </Link>
          </Button>
        </header>
        <div className="max-w-prose">
          <Markdown className="text-[15px] text-foreground/90">{entry.body}</Markdown>
        </div>
      </article>
    );
  }

  return renderContent();
}

function DetailSkeleton() {
  return (
    <SkeletonState>
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
    </SkeletonState>
  );
}
