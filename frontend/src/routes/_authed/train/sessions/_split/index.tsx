import { createFileRoute, Navigate } from "@tanstack/react-router";
import { EmptyState } from "@/components/patterns/query-states";
import { useIsSplit } from "@/lib/hooks/use-is-split";
import { useSessionsIndex } from "@/lib/hooks/use-sessions-index";

export const Route = createFileRoute("/_authed/train/sessions/_split/")({
  component: SessionsIndexPane,
});

/**
 * Below 1100 px the layout shows only the list here. From 1100 px the detail
 * pane opens the most recent session so the page is never half empty.
 */
function SessionsIndexPane() {
  const split = useIsSplit();
  const { data } = useSessionsIndex();
  const latest = data?.pages[0]?.workoutSessions[0];

  if (split && latest) {
    return <Navigate to="/train/sessions/$sessionId" params={{ sessionId: latest.id }} replace />;
  }
  if (split && data) {
    return (
      <EmptyState
        title="Nothing selected"
        description="Sessions you log appear in the list. Select one to see its sets."
      />
    );
  }
  return null;
}
