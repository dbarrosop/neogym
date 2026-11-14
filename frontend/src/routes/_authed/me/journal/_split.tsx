import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Loader2, NotebookPen, Plus } from "lucide-react";
import { useMemo } from "react";
import { FilterChip } from "@/components/patterns/filter-chip";
import { ActionLabel, PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Tag } from "@/components/patterns/tag";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  journalSearchSchema,
  useJournalEntries,
  useJournalLabels,
} from "@/lib/hooks/use-journal-index";
import { formatChartDate } from "@/lib/metric-format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/me/journal/_split")({
  validateSearch: journalSearchSchema,
  component: JournalLayout,
  staticData: { splitView: true },
});

const TRAILING_SLASH = /\/$/;

function JournalLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hasDetail = pathname.replace(TRAILING_SLASH, "") !== "/me/journal";

  return (
    <PageShell maxWidth="6xl">
      <div className={cn(hasDetail && "hidden min-[1100px]:block")}>
        <PageHeader
          title="Me"
          tabs={<AreaTabs area="me" />}
          actions={
            <Button asChild>
              <Link to="/me/journal/new">
                <Plus />
                <ActionLabel>New entry</ActionLabel>
              </Link>
            </Button>
          }
        />
      </div>
      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[340px_minmax(0,1fr)]">
        <div
          className={cn(
            "min-[1100px]:sticky min-[1100px]:top-6",
            hasDetail && "hidden min-[1100px]:block",
          )}
        >
          <JournalList activePath={pathname} />
        </div>
        <div className={cn("min-w-0", !hasDetail && "hidden min-[1100px]:block")}>
          <Outlet />
        </div>
      </div>
    </PageShell>
  );
}

function JournalList({ activePath }: { activePath: string }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeLabels = useMemo(() => search.labels ?? [], [search.labels]);
  const { data: labelsData } = useJournalLabels();
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJournalEntries(activeLabels);
  const entries = useMemo(() => data?.pages.flatMap((p) => p.journalEntries) ?? [], [data]);
  const labels = labelsData?.journalLabels ?? [];

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

  function clearLabels() {
    navigate({ search: (prev) => ({ ...prev, labels: undefined }), replace: true });
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load journal entries"
        message={error.message}
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }

  return (
    <div className="flex flex-col gap-0.5 rounded-xl border bg-card p-2">
      {labels.length > 0 ? (
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 px-1.5 pt-1.5 pb-2.5">
          <legend className="sr-only">Filter by label</legend>
          {labels.map((label) => (
            <FilterChip
              key={label.id}
              selected={activeLabels.includes(label.id)}
              onClick={() => toggleLabel(label.id)}
            >
              {label.name}
            </FilterChip>
          ))}
        </fieldset>
      ) : null}
      {isLoading ? (
        <div className="flex flex-col gap-2 p-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : null}
      {!isLoading && entries.length === 0 && activeLabels.length > 0 ? (
        <EmptyState
          className="border-0"
          title="No entries with these labels"
          description="Clear a label to see more."
          actions={
            <Button type="button" variant="outline" onClick={clearLabels}>
              Clear labels
            </Button>
          }
        />
      ) : null}
      {!isLoading && entries.length === 0 && activeLabels.length === 0 ? (
        <EmptyState
          className="border-0"
          icon={NotebookPen}
          title="No entries yet"
          description="Write about training, food or anything else worth remembering."
        />
      ) : null}
      <nav aria-label="Journal entries" className="flex flex-col gap-0.5">
        {entries.map((entry) => (
          <JournalListRow
            key={entry.id}
            entry={entry}
            active={activePath.startsWith(`/me/journal/${entry.id}`)}
          />
        ))}
      </nav>
      {hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? <Loader2 className="animate-spin" /> : null}
          Load more
        </Button>
      ) : null}
    </div>
  );
}

type JournalListEntry = NonNullable<
  ReturnType<typeof useJournalEntries>["data"]
>["pages"][number]["journalEntries"][number];

/** One entry: weekday date, wrapping title and its labels (no body preview). */
function JournalListRow({ entry, active }: { entry: JournalListEntry; active: boolean }) {
  return (
    <Link
      to="/me/journal/$id"
      params={{ id: entry.id }}
      search={(prev) => prev}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col gap-1.5 rounded-[10px] px-3.5 py-3 transition-colors hover:bg-muted/60",
        active && "bg-accent-soft/60 ring-1 ring-primary/40 ring-inset hover:bg-accent-soft/60",
      )}
    >
      <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
        {formatChartDate(entry.entryDate, { weekday: true })}
      </span>
      <strong className="text-sm leading-[1.35] font-bold">
        {entry.title ?? "Untitled entry"}
      </strong>
      {entry.journalEntryLabels.length > 0 ? (
        <span className="flex flex-wrap gap-1.5">
          {entry.journalEntryLabels.map((link) => (
            <Tag key={link.labelId}>{link.label.name}</Tag>
          ))}
        </span>
      ) : null}
    </Link>
  );
}
