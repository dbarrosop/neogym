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

-- Public workout templates organised as three 3-day programs:
--
--   Strength Foundation  — classic push/pull/legs split, barbell-based.
--   Fat Loss             — full-body lifting + conditioning + cardio finishers.
--   Functional Fitness   — compound movements, loaded carries, athletic work.
--
-- Same conventions as the cardio workouts above: user_id IS NULL,
-- is_public = true, fixed UUIDs, and workout_exercises inserted via a JOIN
-- on exercises.slug so missing catalog rows don't FK-fail (the workout is
-- created empty and populates the next time the catalog seed runs).
--
-- UUID conventions:
--   57e1XXXX-… → Strength
--   fa71XXXX-… → Fat Loss
--   f00cXXXX-… → Functional

INSERT INTO public.workouts (id, name, description, user_id, is_public, created_at, updated_at) VALUES
  -- Strength Foundation (push/pull/legs)
  (
    '57e10000-0000-4000-8000-000000000001',
    'Strength Foundation — Push Day',
    'Day 1 of a 3-day push/pull/legs split. Chest, shoulders, and triceps. Bench-press first while fresh, then standing press, then dumbbell volume work. Finish with pushups to empty the tank. 4 sets of 6–10 reps on the compound lifts.',
    NULL, true, now(), now()
  ),
  (
    '57e10000-0000-4000-8000-000000000002',
    'Strength Foundation — Pull Day',
    'Day 2 of the push/pull/legs split. Back and biceps. Deadlift first, then bent-over row, then pull-ups for back width, then curls. 4 sets of 5 on the deadlift, 8–12 on the rest.',
    NULL, true, now(), now()
  ),
  (
    '57e10000-0000-4000-8000-000000000003',
    'Strength Foundation — Leg Day',
    'Day 3 of the push/pull/legs split. Quads, hamstrings, glutes, calves. Squat is the main lift; the Romanian deadlift hits the posterior chain. Leg press and extensions are pure quad volume.',
    NULL, true, now(), now()
  ),

  -- Fat Loss (3-day full-body program with cardio finishers)
  (
    'fa710000-0000-4000-8000-000000000001',
    'Fat Loss — Full Body A',
    'Day 1 of a 3-day full-body fat-loss program. Compound lifts at moderate reps (8–12), short ab/conditioning block, treadmill finisher. Keep rest under 90 seconds.',
    NULL, true, now(), now()
  ),
  (
    'fa710000-0000-4000-8000-000000000002',
    'Fat Loss — Full Body B',
    'Day 2 of the fat-loss program. Hinge, press, and pull pattern with a rope-jumping finisher. Pair with Day A across the week.',
    NULL, true, now(), now()
  ),
  (
    'fa710000-0000-4000-8000-000000000003',
    'Fat Loss — Conditioning',
    'Day 3 — conditioning focus. Mostly bodyweight, fast pace. End with treadmill + rope-jumping intervals for the cardio finisher.',
    NULL, true, now(), now()
  ),

  -- Functional Fitness (3-day program)
  (
    'f00c0000-0000-4000-8000-000000000001',
    'Functional Fitness — Strength',
    'Day 1 of a 3-day functional program. Squat and pull patterns plus a loaded carry. Builds raw strength that transfers outside the gym.',
    NULL, true, now(), now()
  ),
  (
    'f00c0000-0000-4000-8000-000000000002',
    'Functional Fitness — Power',
    'Day 2 — hinge and press patterns plus box jumps for explosive power. Deadlift heavy, then move fast.',
    NULL, true, now(), now()
  ),
  (
    'f00c0000-0000-4000-8000-000000000003',
    'Functional Fitness — Conditioning',
    'Day 3 — mixed conditioning. Single-leg work for balance, sled drags for the posterior chain, battle ropes for grip and lungs.',
    NULL, true, now(), now()
  );

INSERT INTO public.workout_exercises (workout_id, exercise_id, position)
SELECT v.workout_id::uuid, e.id, v.pos
FROM (VALUES
  -- Strength Foundation — Push Day
  ('57e10000-0000-4000-8000-000000000001', 'Barbell_Bench_Press_-_Medium_Grip', 0),
  ('57e10000-0000-4000-8000-000000000001', 'Standing_Military_Press',          1),
  ('57e10000-0000-4000-8000-000000000001', 'Dumbbell_Bench_Press',             2),
  ('57e10000-0000-4000-8000-000000000001', 'Triceps_Pushdown',                 3),
  ('57e10000-0000-4000-8000-000000000001', 'Pushups',                          4),

  -- Strength Foundation — Pull Day
  ('57e10000-0000-4000-8000-000000000002', 'Barbell_Deadlift',                 0),
  ('57e10000-0000-4000-8000-000000000002', 'Bent_Over_Barbell_Row',            1),
  ('57e10000-0000-4000-8000-000000000002', 'Pullups',                          2),
  ('57e10000-0000-4000-8000-000000000002', 'Barbell_Curl',                     3),

  -- Strength Foundation — Leg Day
  ('57e10000-0000-4000-8000-000000000003', 'Barbell_Squat',                    0),
  ('57e10000-0000-4000-8000-000000000003', 'Romanian_Deadlift',                1),
  ('57e10000-0000-4000-8000-000000000003', 'Leg_Press',                        2),
  ('57e10000-0000-4000-8000-000000000003', 'Leg_Extensions',                   3),
  ('57e10000-0000-4000-8000-000000000003', 'Standing_Calf_Raises',             4),

  -- Fat Loss — Full Body A
  ('fa710000-0000-4000-8000-000000000001', 'Goblet_Squat',                     0),
  ('fa710000-0000-4000-8000-000000000001', 'Dumbbell_Bench_Press',             1),
  ('fa710000-0000-4000-8000-000000000001', 'Bent_Over_Barbell_Row',            2),
  ('fa710000-0000-4000-8000-000000000001', 'Mountain_Climbers',                3),
  ('fa710000-0000-4000-8000-000000000001', 'Running_Treadmill',                4),

  -- Fat Loss — Full Body B
  ('fa710000-0000-4000-8000-000000000002', 'Romanian_Deadlift',                0),
  ('fa710000-0000-4000-8000-000000000002', 'Standing_Military_Press',          1),
  ('fa710000-0000-4000-8000-000000000002', 'Pullups',                          2),
  ('fa710000-0000-4000-8000-000000000002', 'Plank',                            3),
  ('fa710000-0000-4000-8000-000000000002', 'Rope_Jumping',                     4),

  -- Fat Loss — Conditioning
  ('fa710000-0000-4000-8000-000000000003', 'Bodyweight_Squat',                 0),
  ('fa710000-0000-4000-8000-000000000003', 'Pushups',                          1),
  ('fa710000-0000-4000-8000-000000000003', 'Mountain_Climbers',                2),
  ('fa710000-0000-4000-8000-000000000003', 'Plank',                            3),
  ('fa710000-0000-4000-8000-000000000003', 'Running_Treadmill',                4),
  ('fa710000-0000-4000-8000-000000000003', 'Rope_Jumping',                     5),

  -- Functional Fitness — Strength
  ('f00c0000-0000-4000-8000-000000000001', 'Barbell_Squat',                    0),
  ('f00c0000-0000-4000-8000-000000000001', 'Pullups',                          1),
  ('f00c0000-0000-4000-8000-000000000001', 'Pushups',                          2),
  ('f00c0000-0000-4000-8000-000000000001', 'Plank',                            3),
  ('f00c0000-0000-4000-8000-000000000001', 'Farmers_Walk',                     4),

  -- Functional Fitness — Power
  ('f00c0000-0000-4000-8000-000000000002', 'Barbell_Deadlift',                 0),
  ('f00c0000-0000-4000-8000-000000000002', 'Standing_Military_Press',          1),
  ('f00c0000-0000-4000-8000-000000000002', 'Bent_Over_Barbell_Row',            2),
  ('f00c0000-0000-4000-8000-000000000002', 'Box_Jump_Multiple_Response',       3),
  ('f00c0000-0000-4000-8000-000000000002', 'Mountain_Climbers',                4),

  -- Functional Fitness — Conditioning
  ('f00c0000-0000-4000-8000-000000000003', 'Goblet_Squat',                     0),
  ('f00c0000-0000-4000-8000-000000000003', 'Dumbbell_Bench_Press',             1),
  ('f00c0000-0000-4000-8000-000000000003', 'Single_Leg_Glute_Bridge',          2),
  ('f00c0000-0000-4000-8000-000000000003', 'Bear_Crawl_Sled_Drags',            3),
  ('f00c0000-0000-4000-8000-000000000003', 'Battling_Ropes',                   4)
) AS v(workout_id, slug, pos)
JOIN public.exercises e ON e.slug = v.slug AND e.is_public = true;
