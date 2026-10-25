-- Restore the original qualifying-set rule, including stretching.
CREATE OR REPLACE FUNCTION public.muscle_set_progress(
  from_day date, through_day date, time_zone text, hasura_session json
) RETURNS SETOF public.muscle_set_progress_rows
LANGUAGE plpgsql STABLE AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id := (hasura_session ->> 'x-hasura-user-id')::uuid;
  IF owner_id IS NULL OR from_day IS NULL OR through_day IS NULL
     OR through_day < from_day OR through_day - from_day > 365
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = time_zone) THEN
    RAISE EXCEPTION 'Invalid progress range or time zone' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  -- Read eligible sets once; primary and secondary credits share the same owner/date filter.
  WITH base_sets AS MATERIALIZED (
    SELECT (ws.started_at AT TIME ZONE time_zone)::date AS local_day,
           e.id AS exercise_id, e.primary_muscle_group
    FROM public.workout_sessions ws
    JOIN public.workout_session_exercises wse ON wse.workout_session_id = ws.id
    JOIN public.workout_session_strength_sets ss ON ss.workout_session_exercise_id = wse.id
    JOIN public.exercises e ON e.id = wse.exercise_id
    WHERE ws.user_id = owner_id AND ss.reps > 0
      AND ws.started_at >= ((from_day - 6)::timestamp AT TIME ZONE time_zone)
      AND ws.started_at < ((through_day + 1)::timestamp AT TIME ZONE time_zone)
  ), set_credits AS (
    SELECT local_day, primary_muscle_group AS muscle, 1 AS direct, 0 AS indirect
    FROM base_sets
    UNION ALL
    SELECT base_sets.local_day, sm.muscle_group, 0, 1
    FROM base_sets
    JOIN public.exercise_secondary_muscle_groups sm ON sm.exercise_id = base_sets.exercise_id
      AND sm.muscle_group <> base_sets.primary_muscle_group
  ), daily AS (
    SELECT local_day, muscle, sum(direct)::integer AS direct_count,
           sum(indirect)::integer AS indirect_count
    FROM set_credits GROUP BY local_day, muscle
  ), dates AS (
    SELECT d::date AS local_day
    FROM generate_series(from_day - 6, through_day, interval '1 day') AS d
  ), filled AS (
    SELECT dates.local_day, muscles.muscle,
           coalesce(daily.direct_count, 0) AS direct_count,
           coalesce(daily.indirect_count, 0) AS indirect_count
    FROM dates CROSS JOIN (SELECT DISTINCT muscle FROM daily) AS muscles
    LEFT JOIN daily ON daily.local_day = dates.local_day AND daily.muscle = muscles.muscle
  ), rolled AS (
    SELECT filled.*,
      (sum(direct_count) OVER w)::integer AS rolling_direct,
      (sum(indirect_count) OVER w)::integer AS rolling_indirect
    FROM filled
    WINDOW w AS (PARTITION BY muscle ORDER BY local_day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
  )
  SELECT owner_id, rolled.local_day, rolled.muscle,
         rolled.direct_count, rolled.indirect_count,
         rolled.direct_count + rolled.indirect_count * 0.5,
         rolled.rolling_direct, rolled.rolling_indirect,
         rolled.rolling_direct + rolled.rolling_indirect * 0.5
  FROM rolled WHERE rolled.local_day >= from_day
  ORDER BY rolled.local_day, rolled.muscle;
END;
$$;
