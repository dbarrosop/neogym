import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useMemo } from "react";
import { stripMarkdown } from "@/components/markdown";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateShort } from "@/lib/dates";
import {
  journalSearchSchema,
  useJournalEntries,
  useJournalLabels,
} from "@/lib/hooks/use-journal-index";
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
                New entry
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
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJournalEntries(activeLabels);
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

  if (error) {
    return <ErrorState title="Couldn't load journal entries" message={error.message} />;
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-2">
      {labels.length > 0 ? (
        <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-1.5">
          <legend className="sr-only">Filter by label</legend>
          {labels.map((label) => {
            const active = activeLabels.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleLabel(label.id)}
                className={cn(
                  "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label.name}
              </button>
            );
          })}
        </fieldset>
      ) : null}
      {isLoading ? (
        <div className="flex flex-col gap-2 p-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : null}
      {!isLoading && entries.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent shadow-none"
          title={activeLabels.length > 0 ? "No entries with these labels" : "No entries yet"}
          description={
            activeLabels.length > 0
              ? "Clear a label to see more."
              : "Write about training, food or anything else worth remembering."
          }
        />
      ) : null}
      <nav aria-label="Journal entries" className="flex flex-col gap-0.5">
        {entries.map((entry) => {
          const active = activePath.startsWith(`/me/journal/${entry.id}`);
          const preview = stripMarkdown(entry.body).trim();
          return (
            <Link
              key={entry.id}
              to="/me/journal/$id"
              params={{ id: entry.id }}
              search={(prev) => prev}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60",
                active &&
                  "bg-accent-soft/60 ring-1 ring-primary/40 ring-inset hover:bg-accent-soft/60",
              )}
            >
              <span className="text-[12px] font-semibold text-muted-foreground tabular-nums">
                {formatDateShort(entry.entryDate)}
              </span>
              <strong className="truncate text-sm font-semibold">
                {entry.title ?? "Untitled entry"}
              </strong>
              {preview ? (
                <span className="line-clamp-2 text-[13px] text-muted-foreground">{preview}</span>
              ) : null}
            </Link>
          );
        })}
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
