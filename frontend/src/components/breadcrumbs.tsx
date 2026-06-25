import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { graphql } from "@/gql";
import { formatDateShort } from "@/lib/dates";
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
  "/sessions/$sessionId": { label: "Session", parent: "/sessions" },
  "/sessions/$sessionId/exercises/$exerciseId": {
    label: "Exercise",
    parent: "/sessions/$sessionId",
  },
  "/body": { label: "Body", parent: null },
  "/body/new": { label: "New", parent: "/body" },
  "/body/$id": { label: "Measurement", parent: "/body" },
  "/body/$id/edit": { label: "Edit", parent: "/body/$id" },
  "/journal": { label: "Journal", parent: null },
  "/journal/new": { label: "New", parent: "/journal" },
  "/journal/$id": { label: "Entry", parent: "/journal" },
  "/journal/$id/edit": { label: "Edit", parent: "/journal/$id" },
  "/nutrition": { label: "Nutrition", parent: null },
  "/nutrition/days": { label: "Days", parent: "/nutrition" },
  "/nutrition/days/$date": { label: "Day", parent: "/nutrition/days" },
  "/nutrition/foods": { label: "Foods", parent: "/nutrition" },
  "/nutrition/foods/new": { label: "New", parent: "/nutrition/foods" },
  "/nutrition/foods/$foodId": { label: "Food", parent: "/nutrition/foods" },
  "/nutrition/foods/$foodId/edit": {
    label: "Edit",
    parent: "/nutrition/foods/$foodId",
  },
  "/nutrition/meals": { label: "Meals", parent: "/nutrition" },
  "/nutrition/meals/new": { label: "New", parent: "/nutrition/meals" },
  "/nutrition/meals/$mealId": { label: "Meal", parent: "/nutrition/meals" },
  "/nutrition/meals/$mealId/edit": {
    label: "Edit",
    parent: "/nutrition/meals/$mealId",
  },
  "/nutrition/plans": { label: "Plans", parent: "/nutrition" },
  "/nutrition/plans/new": { label: "New", parent: "/nutrition/plans" },
  "/nutrition/plans/$planId": { label: "Plan", parent: "/nutrition/plans" },
  "/nutrition/plans/$planId/edit": {
    label: "Edit",
    parent: "/nutrition/plans/$planId",
  },
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

export const __testing = { matchPattern, trailFor };

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

const CRUMB_LABEL_RENDERERS: Record<string, (crumb: Crumb) => ReactNode> = {
  "/workouts/$workoutId": (crumb) => (
    <WorkoutName id={crumb.params["workoutId"] ?? ""} fallback={crumb.label} />
  ),
  "/sessions/$sessionId": (crumb) => (
    <SessionLabel id={crumb.params["sessionId"] ?? ""} fallback={crumb.label} />
  ),
  "/exercises/$exerciseId": (crumb) => (
    <ExerciseName id={crumb.params["exerciseId"] ?? ""} fallback={crumb.label} />
  ),
  "/workouts/$workoutId/exercises/$exerciseId": (crumb) => (
    <ExerciseName id={crumb.params["exerciseId"] ?? ""} fallback={crumb.label} />
  ),
  "/sessions/$sessionId/exercises/$exerciseId": (crumb) => (
    <ExerciseName id={crumb.params["exerciseId"] ?? ""} fallback={crumb.label} />
  ),
  "/body/$id": (crumb) => (
    <BodyMeasurementLabel id={crumb.params["id"] ?? ""} fallback={crumb.label} />
  ),
  "/journal/$id": (crumb) => (
    <JournalEntryLabel id={crumb.params["id"] ?? ""} fallback={crumb.label} />
  ),
  "/nutrition/days/$date": (crumb) => formatDateShort(crumb.params["date"] ?? ""),
  "/nutrition/foods/$foodId": (crumb) => (
    <FoodName id={crumb.params["foodId"] ?? ""} fallback={crumb.label} />
  ),
  "/nutrition/meals/$mealId": (crumb) => (
    <MealName id={crumb.params["mealId"] ?? ""} fallback={crumb.label} />
  ),
  "/nutrition/plans/$planId": (crumb) => (
    <NutritionPlanName id={crumb.params["planId"] ?? ""} fallback={crumb.label} />
  ),
};

function CrumbLabel({ crumb }: { crumb: Crumb }) {
  return <>{CRUMB_LABEL_RENDERERS[crumb.pattern]?.(crumb) ?? crumb.label}</>;
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

const BreadcrumbBodyMeasurementQuery = graphql(`
  query BreadcrumbBodyMeasurement($id: uuid!) {
    bodyMeasurement(id: $id) {
      id
      measuredOn
    }
  }
`);

function BodyMeasurementLabel({ id, fallback }: { id: string; fallback: string }) {
  const { data } = useQuery({
    queryKey: ["body_measurements", "breadcrumb", id],
    queryFn: () => gqlRequest(BreadcrumbBodyMeasurementQuery, { id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  const m = data?.bodyMeasurement;
  if (!m) {
    return <>{fallback}</>;
  }
  return <>{formatDateShort(m.measuredOn)}</>;
}

const BreadcrumbJournalEntryQuery = graphql(`
  query BreadcrumbJournalEntry($id: uuid!) {
    journalEntry(id: $id) {
      id
      entryDate
      title
    }
  }
`);

function JournalEntryLabel({ id, fallback }: { id: string; fallback: string }) {
  const { data } = useQuery({
    queryKey: ["journal_entries", "breadcrumb", id],
    queryFn: () => gqlRequest(BreadcrumbJournalEntryQuery, { id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  const e = data?.journalEntry;
  if (!e) {
    return <>{fallback}</>;
  }
  return <>{e.title ?? formatDateShort(e.entryDate)}</>;
}

const BreadcrumbFoodQuery = graphql(`
  query BreadcrumbFood($id: uuid!) {
    food(id: $id) {
      id
      name
    }
  }
`);

function FoodName({ id, fallback }: { id: string; fallback: string }) {
  const { data } = useQuery({
    queryKey: ["foods", "breadcrumb", id],
    queryFn: () => gqlRequest(BreadcrumbFoodQuery, { id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  return <>{data?.food?.name ?? fallback}</>;
}

const BreadcrumbMealQuery = graphql(`
  query BreadcrumbMeal($id: uuid!) {
    meal(id: $id) {
      id
      name
    }
  }
`);

function MealName({ id, fallback }: { id: string; fallback: string }) {
  const { data } = useQuery({
    queryKey: ["meals", "breadcrumb", id],
    queryFn: () => gqlRequest(BreadcrumbMealQuery, { id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  return <>{data?.meal?.name ?? fallback}</>;
}

const BreadcrumbNutritionPlanQuery = graphql(`
  query BreadcrumbNutritionPlan($id: uuid!) {
    nutritionPlan(id: $id) {
      id
      name
    }
  }
`);

function NutritionPlanName({ id, fallback }: { id: string; fallback: string }) {
  const { data } = useQuery({
    queryKey: ["nutrition_plans", "breadcrumb", id],
    queryFn: () => gqlRequest(BreadcrumbNutritionPlanQuery, { id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  return <>{data?.nutritionPlan?.name ?? fallback}</>;
}
