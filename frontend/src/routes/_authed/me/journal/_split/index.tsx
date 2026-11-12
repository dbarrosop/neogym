import { createFileRoute, getRouteApi, Navigate } from "@tanstack/react-router";
import { EmptyState } from "@/components/patterns/query-states";
import { useIsSplit } from "@/lib/hooks/use-is-split";
import { useJournalEntries } from "@/lib/hooks/use-journal-index";

export const Route = createFileRoute("/_authed/me/journal/_split/")({
  component: JournalIndexPane,
});

const layoutRoute = getRouteApi("/_authed/me/journal/_split");

/** From 1100 px the detail pane opens the newest entry in the filtered list. */
function JournalIndexPane() {
  const split = useIsSplit();
  const search = layoutRoute.useSearch();
  const { data } = useJournalEntries(search.labels ?? []);
  const first = data?.pages[0]?.journalEntries[0];
  if (split && first) {
    return (
      <Navigate to="/me/journal/$id" params={{ id: first.id }} search={(prev) => prev} replace />
    );
  }
  if (split && data) {
    return <EmptyState title="Nothing selected" description="Write an entry to see it here." />;
  }
  return null;
}
