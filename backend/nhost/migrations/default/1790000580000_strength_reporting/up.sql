-- Shared, non-materialized strength-set facts. Keep report formulas here, not in clients.
-- A completed set has reps > 0; a zero-weight bodyweight set has volume 0 and
-- no usable load-based e1RM. Recorded single reps are measured 1RMs; for 2+
-- reps Epley is an estimate using the recorded (per-side) load.
CREATE VIEW public.strength_set_report_facts AS
SELECT ws.user_id, ws.id AS session_id, ws.workout_id, ws.started_at,
       wse.exercise_id, wse.id AS session_exercise_id, ss.id AS set_id, ss.reps, ss.weight,
       (ss.weight * ss.reps * CASE WHEN es.double_weight THEN 2 ELSE 1 END)::numeric AS volume,
       CASE WHEN ss.reps > 0 AND ss.weight > 0 THEN
         CASE WHEN ss.reps = 1 THEN ss.weight
              ELSE ss.weight * (1 + ss.reps::numeric / 30) END
       END AS estimated_one_rep_max
FROM public.workout_sessions ws
JOIN public.workout_session_exercises wse ON wse.workout_session_id = ws.id
JOIN public.workout_session_strength_sets ss ON ss.workout_session_exercise_id = wse.id
JOIN public.exercises_strength es ON es.exercise_id = wse.exercise_id;

-- Hasura return shapes only: there is no cached/materialized history.
CREATE TABLE public.workout_strength_history_rows (
  user_id uuid NOT NULL, workout_id uuid NOT NULL, session_id uuid NOT NULL,
  started_at timestamptz NOT NULL, logged_sets integer NOT NULL,
  completed_sets integer NOT NULL, reps integer NOT NULL, volume numeric NOT NULL,
  CONSTRAINT workout_strength_history_rows_no_storage CHECK (false)
);
CREATE TABLE public.exercise_strength_history_rows (
  user_id uuid NOT NULL, exercise_id uuid NOT NULL, session_id uuid NOT NULL,
  workout_id uuid, started_at timestamptz NOT NULL, logged_sets integer NOT NULL,
  completed_sets integer NOT NULL, reps integer NOT NULL, volume numeric NOT NULL,
  estimated_one_rep_max numeric,
  CONSTRAINT exercise_strength_history_rows_no_storage CHECK (false)
);

-- Range is absolute, half-open; per-session points retain the original timestamp.
-- The caller never supplies the owner. Rechecking ownership in SQL protects the
-- function even if invoked outside Hasura's row permissions.
CREATE FUNCTION public.workout_strength_history(
  workout_row public.workouts, from_at timestamptz, before_at timestamptz, hasura_session json
) RETURNS SETOF public.workout_strength_history_rows
LANGUAGE plpgsql STABLE AS $$
DECLARE owner_id uuid := (hasura_session ->> 'x-hasura-user-id')::uuid;
BEGIN
  IF owner_id IS NULL OR from_at IS NULL OR before_at IS NULL OR before_at <= from_at
     OR before_at - from_at > interval '367 days' THEN
    RAISE EXCEPTION 'Invalid strength history range or user' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT ws.user_id, ws.workout_id, ws.id, ws.started_at,
         count(f.set_id)::integer,
         count(f.set_id) FILTER (WHERE f.reps > 0)::integer,
         coalesce(sum(f.reps), 0)::integer, coalesce(sum(f.volume), 0)::numeric
  FROM public.workout_sessions ws
  LEFT JOIN public.strength_set_report_facts f ON f.session_id = ws.id
  WHERE ws.user_id = owner_id AND ws.workout_id = workout_row.id
    AND ws.started_at >= from_at AND ws.started_at < before_at
  GROUP BY ws.user_id, ws.workout_id, ws.id, ws.started_at
  ORDER BY ws.started_at, ws.id;
END;
$$;

-- One point per session/exercise even if an exercise occurs twice in a session.
-- A logged strength exercise without sets is retained with zero totals / NULL e1RM.
CREATE FUNCTION public.exercise_strength_history(
  exercise_row public.exercises, from_at timestamptz, before_at timestamptz, hasura_session json
) RETURNS SETOF public.exercise_strength_history_rows
LANGUAGE plpgsql STABLE AS $$
DECLARE owner_id uuid := (hasura_session ->> 'x-hasura-user-id')::uuid;
BEGIN
  IF owner_id IS NULL OR from_at IS NULL OR before_at IS NULL OR before_at <= from_at
     OR before_at - from_at > interval '367 days' THEN
    RAISE EXCEPTION 'Invalid strength history range or user' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT ws.user_id, wse.exercise_id, ws.id, ws.workout_id, ws.started_at,
         count(f.set_id)::integer,
         count(f.set_id) FILTER (WHERE f.reps > 0)::integer,
         coalesce(sum(f.reps), 0)::integer, coalesce(sum(f.volume), 0)::numeric,
         max(f.estimated_one_rep_max)::numeric
  FROM public.workout_sessions ws
  JOIN public.workout_session_exercises wse ON wse.workout_session_id = ws.id
    AND wse.exercise_id = exercise_row.id AND wse.kind = 'strength'
  LEFT JOIN public.strength_set_report_facts f ON f.session_exercise_id = wse.id
  WHERE ws.user_id = owner_id
    AND ws.started_at >= from_at AND ws.started_at < before_at
  GROUP BY ws.user_id, wse.exercise_id, ws.id, ws.workout_id, ws.started_at
  ORDER BY ws.started_at, ws.id;
END;
$$;
