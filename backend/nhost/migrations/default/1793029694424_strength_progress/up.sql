-- All-exercise strength history for the optional Strength Progress dashboard.
-- Reuse the shared facts and existing empty, owner-filtered return shape.
CREATE FUNCTION public.strength_progress(
  from_day date, through_day date, time_zone text, hasura_session json
) RETURNS SETOF public.exercise_strength_history_rows
LANGUAGE plpgsql STABLE AS $$
DECLARE owner_id uuid := (hasura_session ->> 'x-hasura-user-id')::uuid;
BEGIN
  IF owner_id IS NULL OR from_day IS NULL OR through_day IS NULL
     OR through_day < from_day OR through_day - from_day > 365
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = time_zone) THEN
    RAISE EXCEPTION 'Invalid strength progress range, time zone or user' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT f.user_id, f.exercise_id, f.session_id, f.workout_id, f.started_at,
         count(*)::integer, count(*) FILTER (WHERE f.reps > 0)::integer,
         sum(f.reps)::integer, sum(f.volume)::numeric, max(f.estimated_one_rep_max)::numeric
  FROM public.strength_set_report_facts f
  WHERE f.user_id = owner_id
    AND f.started_at >= from_day::timestamp AT TIME ZONE time_zone
    AND f.started_at < (through_day + 1)::timestamp AT TIME ZONE time_zone
  GROUP BY f.user_id, f.exercise_id, f.session_id, f.workout_id, f.started_at
  ORDER BY f.started_at, f.session_id, f.exercise_id;
END;
$$;
