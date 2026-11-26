import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Tag } from "@/components/patterns/tag";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { parseDateOnly } from "@/lib/dates";
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

export const Route = createFileRoute("/_authed/me/journal/_split/$id")({
  component: JournalEntryDetailRoute,
});

/** "Saturday 31 October 2026" (browser locale). */
function entryDateLabel(iso: string) {
  return (
    parseDateOnly(iso)?.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }) ?? iso
  );
}

function JournalEntryDetailRoute() {
  const { id } = Route.useParams();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["journal_entries", id],
    queryFn: () => gqlRequest(JournalEntryByIdQuery, { id }),
  });

  function renderContent() {
    if (isLoading) {
      return <DetailSkeleton />;
    }
    if (error) {
      return (
        <ErrorState
          title="Couldn't load entry"
          message={error.message}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      );
    }
    if (!data?.journalEntry) {
      return <EmptyState title="Entry not found." />;
    }
    const entry = data.journalEntry;
    return (
      <article className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:px-8 md:py-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">
            {entryDateLabel(entry.entryDate)}
          </p>
          <Button asChild variant="outline">
            <Link to="/me/journal/$id/edit" params={{ id: entry.id }}>
              <Pencil />
              Edit
            </Link>
          </Button>
        </div>
        <h2 className="max-w-[720px] wrap-anywhere text-[22px] leading-[1.25] font-bold tracking-[-0.015em] md:text-[26px]">
          {entry.title ?? "Untitled entry"}
        </h2>
        {entry.journalEntryLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {entry.journalEntryLabels.map((jel) => (
              <Tag key={jel.labelId}>{jel.label.name}</Tag>
            ))}
          </div>
        ) : null}
        <div className="max-w-[720px]">
          <Markdown size="reading">{entry.body}</Markdown>
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
