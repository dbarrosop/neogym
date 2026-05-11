-- Public cardio workout templates. All four are owned by no user
-- (user_id IS NULL, is_public = true) so every user sees them in their
-- workout picker and can start a session from them.
--
-- The workout_exercises rows are inserted via a JOIN on `exercises.slug`,
-- so if the public catalog hasn't been seeded yet on a fresh DB, the
-- workouts get created but their exercise lists stay empty rather than
-- failing the FK. They populate the next time the catalog seed runs.

INSERT INTO public.workouts (id, name, description, user_id, is_public, created_at, updated_at) VALUES
  (
    'c0d10000-0000-4000-8000-000000000001',
    'Indoor Triathlon',
    'A cardio triathlon for the gym: row, bike, run. Rowing stands in for the swim. Treat it as one event — no rest between exercises. Suggested distances: 500m row, 20km bike, 5km run.',
    NULL, true, now(), now()
  ),
  (
    'c0d10000-0000-4000-8000-000000000002',
    'Duathlon',
    'Run – bike – run, a real triathlon variant. Suggested distances: 5km treadmill run, 20km stationary bike, 5km treadmill run.',
    NULL, true, now(), now()
  ),
  (
    'c0d10000-0000-4000-8000-000000000003',
    'Cardio Pentathlon',
    'Five cardio modalities back to back: rowing, cycling, stair climbing, running, rope jumping. A sampler workout that hits every cardio template the app supports.',
    NULL, true, now(), now()
  ),
  (
    'c0d10000-0000-4000-8000-000000000004',
    'Brick Workout',
    'Cycle hard, then immediately run — the legs feel like bricks for the first kilometre. The cornerstone of triathlon training. Suggested: 30 min bike, 20 min run.',
    NULL, true, now(), now()
  );

INSERT INTO public.workout_exercises (workout_id, exercise_id, position)
SELECT v.workout_id::uuid, e.id, v.pos
FROM (VALUES
  -- Indoor Triathlon: row → bike → run.
  ('c0d10000-0000-4000-8000-000000000001', 'Rowing_Stationary',    0),
  ('c0d10000-0000-4000-8000-000000000001', 'Bicycling_Stationary', 1),
  ('c0d10000-0000-4000-8000-000000000001', 'Running_Treadmill',    2),

  -- Duathlon: run → bike → run. Running_Treadmill appears twice with
  -- different positions; workout_exercises.UNIQUE is (workout_id, position),
  -- so duplicate exercise_ids are fine.
  ('c0d10000-0000-4000-8000-000000000002', 'Running_Treadmill',    0),
  ('c0d10000-0000-4000-8000-000000000002', 'Bicycling_Stationary', 1),
  ('c0d10000-0000-4000-8000-000000000002', 'Running_Treadmill',    2),

  -- Cardio Pentathlon: one of each template (running, stairs, interval).
  ('c0d10000-0000-4000-8000-000000000003', 'Rowing_Stationary',    0),
  ('c0d10000-0000-4000-8000-000000000003', 'Bicycling_Stationary', 1),
  ('c0d10000-0000-4000-8000-000000000003', 'Stairmaster',          2),
  ('c0d10000-0000-4000-8000-000000000003', 'Running_Treadmill',    3),
  ('c0d10000-0000-4000-8000-000000000003', 'Rope_Jumping',         4),

  -- Brick Workout: bike → run.
  ('c0d10000-0000-4000-8000-000000000004', 'Bicycling_Stationary', 0),
  ('c0d10000-0000-4000-8000-000000000004', 'Running_Treadmill',    1)
) AS v(workout_id, slug, pos)
JOIN public.exercises e ON e.slug = v.slug AND e.is_public = true;
