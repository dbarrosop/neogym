import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, Plus, Tag } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { stripMarkdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import type { JournalEntries_Bool_Exp } from "@/gql/graphql";
import { gqlRequest } from "@/lib/graphql";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

const JournalEntriesQuery = graphql(`
  query JournalEntries($limit: Int!, $offset: Int!, $where: journalEntries_bool_exp) {
    journalEntries(
      where: $where
      order_by: [{ entryDate: desc }, { createdAt: desc }]
      limit: $limit
      offset: $offset
    ) {
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

const JournalLabelsFilterQuery = graphql(`
  query JournalLabelsFilter {
    journalLabels(order_by: { name: asc }) {
      id
      name
    }
  }
`);

const journalSearchSchema = z.object({
  labels: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/_authed/journal/")({
  validateSearch: journalSearchSchema,
  component: JournalRoute,
});

function JournalRoute() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeLabels = useMemo(() => searchParams.labels ?? [], [searchParams.labels]);
  const activeLabelSet = useMemo(() => new Set(activeLabels), [activeLabels]);
  const isFiltered = activeLabels.length > 0;

  const where = useMemo<JournalEntries_Bool_Exp | undefined>(() => {
    if (activeLabels.length === 0) {
      return undefined;
    }
    // AND semantics: each label gets its own clause requiring at least one
    // matching join row. Hasura's array-relationship filters are existential,
    // so combining them with _and means every selected label must be present.
    return {
      _and: activeLabels.map((labelId) => ({
        journalEntryLabels: { labelId: { _eq: labelId } },
      })),
    };
  }, [activeLabels]);

  const { data: labelsData } = useQuery({
    queryKey: ["journal_labels", "filter"],
    queryFn: () => gqlRequest(JournalLabelsFilterQuery),
  });

  const allLabels = useMemo(() => labelsData?.journalLabels ?? [], [labelsData]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["journal_entries", "index", activeLabels],
      queryFn: ({ pageParam }) =>
        gqlRequest(JournalEntriesQuery, {
          limit: PAGE_SIZE,
          offset: pageParam,
          ...(where ? { where } : {}),
        }),
      initialPageParam: 0 as number,
      getNextPageParam: (lastPage, allPages): number | undefined => {
        if (lastPage.journalEntries.length < PAGE_SIZE) {
          return undefined;
        }
        return allPages.reduce((acc, p) => acc + p.journalEntries.length, 0);
      },
    });

  const entries = useMemo(() => data?.pages.flatMap((p) => p.journalEntries) ?? [], [data]);

  function toggleLabel(label: string) {
    navigate({
      search: (prev) => {
        const current = prev.labels ?? [];
        const next = current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label];
        return { ...prev, labels: next.length === 0 ? undefined : next };
      },
      replace: true,
    });
  }

  function clearAll() {
    navigate({ search: {}, replace: true });
  }

  function renderContent() {
    if (isLoading) {
      return <JournalSkeleton />;
    }
    if (error) {
      return <p className="text-sm text-destructive">Failed to load: {error.message}</p>;
    }
    if (entries.length === 0) {
      const emptyMsg = isFiltered
        ? "No entries match the selected labels."
        : "No journal entries yet.";
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>{emptyMsg}</p>
            {isFiltered ? null : (
              <Button asChild size="sm">
                <Link to="/journal/new">
                  <Plus className="h-4 w-4" />
                  Write your first entry
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-3">
        <ul className="space-y-2">
          {entries.map((e) => {
            const preview = stripMarkdown(e.body).trim();
            return (
              <li key={e.id}>
                <Link to="/journal/$id" params={{ id: e.id }} className="group block">
                  <Card className="border-border/60 py-0 backdrop-blur transition-colors group-hover:border-primary/40 supports-[backdrop-filter]:bg-card/80">
                    <CardContent className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
                            {formatDate(e.entryDate)}
                          </p>
                          {e.title ? (
                            <h2 className="min-w-0 truncate text-sm font-medium">{e.title}</h2>
                          ) : null}
                        </div>
                        {preview ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">{preview}</p>
                        ) : null}
                        {e.journalEntryLabels.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {e.journalEntryLabels.map((jel) => (
                              <Badge key={jel.labelId} variant="primary" className="px-1.5 py-0">
                                <Tag className="h-2.5 w-2.5" />
                                {jel.label.name}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
        {hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tracking
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Journal</h1>
            <p className="text-sm text-muted-foreground">
              Notes, reflections, and anything else worth remembering.
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/journal/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New entry</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
        </header>

        {allLabels.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Filter
            </span>
            {allLabels.map((label) => (
              <FilterPill
                key={label.id}
                active={activeLabelSet.has(label.id)}
                onClick={() => toggleLabel(label.id)}
              >
                <Tag className="h-3 w-3" />
                {label.name}
              </FilterPill>
            ))}
            {isFiltered ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        {renderContent()}
      </div>
    </section>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
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

function JournalSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <li key={i}>
          <Card className="border-border/60 py-0">
            <CardContent className="space-y-2 px-4 py-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
