import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

type RouteDef = { label: string; parent: string | null };

// Maps route patterns to their breadcrumb label and parent pattern. Parents
// must use the same pattern keys; param names are inherited from the deepest
// match (parents are URL prefixes of children).
const ROUTES: Record<string, RouteDef> = {
  "/exercises": { label: "Exercises", parent: null },
  "/exercises/$exerciseId": { label: "Exercise", parent: "/exercises" },
  "/workouts": { label: "Workouts", parent: null },
  "/workouts/new": { label: "New", parent: "/workouts" },
  "/workouts/$workoutId": { label: "Workout", parent: "/workouts" },
  "/workouts/$workoutId/edit": { label: "Edit", parent: "/workouts/$workoutId" },
  "/workouts/$workoutId/exercises/$exerciseId": {
    label: "Exercise",
    parent: "/workouts/$workoutId",
  },
  "/sessions": { label: "Sessions", parent: null },
  "/sessions/new": { label: "New", parent: "/sessions" },
  "/sessions/$sessionId": { label: "Session", parent: "/sessions" },
  "/sessions/$sessionId/exercises/$exerciseId": {
    label: "Exercise",
    parent: "/sessions/$sessionId",
  },
  "/body": { label: "Body", parent: null },
  "/journal": { label: "Journal", parent: null },
  "/journal/new": { label: "New", parent: "/journal" },
  "/journal/$entryId": { label: "Entry", parent: "/journal" },
  "/journal/$entryId/edit": { label: "Edit", parent: "/journal/$entryId" },
  "/profile": { label: "Profile", parent: null },
};

type Match = { pattern: string; params: Record<string, string> };

// Picks the most-specific match (fewest $param segments) so that ordering of
// keys in ROUTES doesn't matter — e.g. `/workouts/new` always beats
// `/workouts/$workoutId` regardless of which is declared first.
function matchPattern(pathname: string): Match | null {
  const pathParts = pathname.split("/");
  let best: { match: Match; paramCount: number } | null = null;
  for (const pattern of Object.keys(ROUTES)) {
    const parts = pattern.split("/");
    if (parts.length !== pathParts.length) {
      continue;
    }
    const params: Record<string, string> = {};
    let ok = true;
    let paramCount = 0;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      const got = pathParts[i];
      if (seg === undefined || got === undefined) {
        ok = false;
        break;
      }
      if (seg.startsWith("$")) {
        params[seg.slice(1)] = got;
        paramCount++;
      } else if (seg !== got) {
        ok = false;
        break;
      }
    }
    if (ok && (best === null || paramCount < best.paramCount)) {
      best = { match: { pattern, params }, paramCount };
      if (paramCount === 0) {
        break;
      }
    }
  }
  return best?.match ?? null;
}

type Crumb = { pattern: string; params: Record<string, string>; label: string };

function trailFor(pathname: string): Crumb[] {
  const matched = matchPattern(pathname);
  if (!matched) {
    return [];
  }
  const trail: Crumb[] = [];
  let current: string | null = matched.pattern;
  while (current) {
    const def: RouteDef | undefined = ROUTES[current];
    if (!def) {
      break;
    }
    trail.unshift({ pattern: current, params: matched.params, label: def.label });
    current = def.parent;
  }
  return trail;
}

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const trail = trailFor(pathname);

  if (trail.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-sm"
    >
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        return (
          <Fragment key={crumb.pattern}>
            {i > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            ) : null}
            {isLast ? (
              <span className="truncate font-medium text-foreground">
                <CrumbLabel crumb={crumb} />
              </span>
            ) : (
              <Link
                // The `to`/`params` types are route-pattern unions; this
                // component is a generic dispatcher across patterns.
                to={crumb.pattern as never}
                params={crumb.params as never}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                <CrumbLabel crumb={crumb} />
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

function CrumbLabel({ crumb }: { crumb: Crumb }) {
  switch (crumb.pattern) {
    case "/workouts/$workoutId":
      return <WorkoutName id={crumb.params["workoutId"] ?? ""} fallback={crumb.label} />;
    case "/sessions/$sessionId":
      return <SessionLabel id={crumb.params["sessionId"] ?? ""} fallback={crumb.label} />;
    case "/exercises/$exerciseId":
    case "/workouts/$workoutId/exercises/$exerciseId":
    case "/sessions/$sessionId/exercises/$exerciseId":
      return <ExerciseName id={crumb.params["exerciseId"] ?? ""} fallback={crumb.label} />;
    default:
      return <>{crumb.label}</>;
  }
}

const BreadcrumbWorkoutQuery = graphql(`
  query BreadcrumbWorkout($id: uuid!) {
    workout(id: $id) {
      id
      name
    }
  }
`);

function WorkoutName({ id, fallback }: { id: string; fallback: string }) {
  const { data } = useQuery({
    queryKey: ["workouts", "breadcrumb", id],
    queryFn: () => gqlRequest(BreadcrumbWorkoutQuery, { id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  return <>{data?.workout?.name ?? fallback}</>;
}

const BreadcrumbExerciseQuery = graphql(`
  query BreadcrumbExercise($id: uuid!) {
    exercise(id: $id) {
      id
      name
    }
  }
`);

function ExerciseName({ id, fallback }: { id: string; fallback: string }) {
  const { data } = useQuery({
    queryKey: ["exercises", "breadcrumb", id],
    queryFn: () => gqlRequest(BreadcrumbExerciseQuery, { id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  return <>{data?.exercise?.name ?? fallback}</>;
}

const BreadcrumbSessionQuery = graphql(`
  query BreadcrumbSession($id: uuid!) {
    workoutSession(id: $id) {
      id
      startedAt
      workout {
        id
        name
      }
    }
  }
`);

function SessionLabel({ id, fallback }: { id: string; fallback: string }) {
  const { data } = useQuery({
    queryKey: ["sessions", "breadcrumb", id],
    queryFn: () => gqlRequest(BreadcrumbSessionQuery, { id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  const session = data?.workoutSession;
  if (!session) {
    return <>{fallback}</>;
  }
  const date = new Date(session.startedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return <>{session.workout?.name ? `${session.workout.name} · ${date}` : date}</>;
}
