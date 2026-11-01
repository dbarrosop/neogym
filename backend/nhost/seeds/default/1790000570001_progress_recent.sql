-- Local development Progress workload for the existing test user. Every other UTC
-- day over the last 180 days: 91 sessions, five strength exercises, four working
-- sets each plus one zero-rep bench set (1,911 rows). Noon UTC avoids US
-- midnight/DST boundaries; the day series rolls forward on a fresh seed apply.
-- IDs are deterministic within an apply so the three insert phases stay linked.
-- This is seed data only, never a production migration.
INSERT INTO public.workouts (id, name, description, user_id, is_public)
VALUES ('c1d50000-0000-4000-8000-000000000001', 'Progress sample',
        'Recent strength training history for local Progress checks',
        'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', false);

INSERT INTO public.workout_sessions (id, workout_id, user_id, started_at)
SELECT md5('neogym-progress-session:' || day::date::text)::uuid,
       'c1d50000-0000-4000-8000-000000000001',
       'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c',
       day + interval '12 hours'
FROM generate_series((now() AT TIME ZONE 'UTC')::date - 180,
                     (now() AT TIME ZONE 'UTC')::date, interval '2 days') AS days(day);

INSERT INTO public.workout_session_exercises
  (id, workout_session_id, exercise_id, "position")
SELECT md5('neogym-progress-exercise:' || days.day::date::text || ':' || movements.position)::uuid,
       md5('neogym-progress-session:' || days.day::date::text)::uuid,
       movements.exercise_id, movements.position
FROM generate_series((now() AT TIME ZONE 'UTC')::date - 180,
                     (now() AT TIME ZONE 'UTC')::date, interval '2 days') AS days(day)
CROSS JOIN (VALUES
  (0, '019e0675-aa1e-7e06-9389-ec8c1ac04f74'::uuid), -- Side_Lateral_Raise: side delts
  (1, '019e0675-a26c-7b80-9fda-9075c6c51b8b'::uuid), -- Barbell_Bench_Press_-_Medium_Grip: chest, front delts
  (2, '019e0675-a2e0-7405-a6ef-9c2822bef44d'::uuid), -- Bent_Over_Barbell_Row: middle back, rear delts
  (3, '019e0675-a27f-7bf2-800f-9c474fe452af'::uuid), -- Barbell_Full_Squat: quadriceps, glutes
  (4, '019e0675-a73d-7ecf-9e91-c845c8e79731'::uuid)  -- Machine_Shoulder_Military_Press: front delts
) AS movements(position, exercise_id);

INSERT INTO public.workout_session_strength_sets
  (id, workout_session_exercise_id, set_number, reps, weight)
SELECT md5('neogym-progress-set:' || days.day::date::text || ':' || positions.position || ':' || numbers.n)::uuid,
       md5('neogym-progress-exercise:' || days.day::date::text || ':' || positions.position)::uuid,
       numbers.n,
       CASE WHEN numbers.n = 5 THEN 0 ELSE 7 + numbers.n END,
       CASE positions.position WHEN 0 THEN 0 ELSE 20 + positions.position * 10 END
FROM generate_series((now() AT TIME ZONE 'UTC')::date - 180,
                     (now() AT TIME ZONE 'UTC')::date, interval '2 days') AS days(day)
CROSS JOIN generate_series(0, 4) AS positions(position)
CROSS JOIN generate_series(1, 5) AS numbers(n)
WHERE numbers.n <= 4 OR positions.position = 1;
