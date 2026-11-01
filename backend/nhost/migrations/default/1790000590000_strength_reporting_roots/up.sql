-- Constellation does not expose Hasura computed fields yet. Tracked root SQL
-- functions reuse the same per-session calculations and return shapes, with an
-- injected Hasura session argument, for normal web/iOS GraphQL clients.
-- Local-day range mirrors muscleSetProgress and handles DST at the boundaries.
CREATE FUNCTION public.workout_strength_report(
  workout_id uuid, from_day date, through_day date, time_zone text, hasura_session json
) RETURNS SETOF public.workout_strength_history_rows
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF from_day IS NULL OR through_day IS NULL OR through_day < from_day
     OR through_day - from_day > 365
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = time_zone) THEN
    RAISE EXCEPTION 'Invalid strength report range or time zone' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT report.*
  FROM public.workouts workout
  CROSS JOIN LATERAL public.workout_strength_history(
    workout, from_day::timestamp AT TIME ZONE time_zone,
    (through_day + 1)::timestamp AT TIME ZONE time_zone, hasura_session
  ) report
  WHERE workout.id = $1;
END;
$$;

CREATE FUNCTION public.exercise_strength_report(
  exercise_id uuid, from_day date, through_day date, time_zone text, hasura_session json
) RETURNS SETOF public.exercise_strength_history_rows
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF from_day IS NULL OR through_day IS NULL OR through_day < from_day
     OR through_day - from_day > 365
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = time_zone) THEN
    RAISE EXCEPTION 'Invalid strength report range or time zone' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT report.*
  FROM public.exercises exercise
  CROSS JOIN LATERAL public.exercise_strength_history(
    exercise, from_day::timestamp AT TIME ZONE time_zone,
    (through_day + 1)::timestamp AT TIME ZONE time_zone, hasura_session
  ) report
  WHERE exercise.id = $1;
END;
$$;
