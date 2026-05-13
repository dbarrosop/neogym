SET transaction_timeout = 0;
SET check_function_bodies = false;

-- A small cardio demo: one workout, four sessions exercising all three
-- metric templates (running, stairs, interval) plus a multi-entry interval run.

INSERT INTO public.workouts (id, name, description, user_id, is_public, created_at, updated_at) VALUES
  ('c1d10000-0000-4000-8000-000000000001', 'Cardio mix', 'Sample cardio workout: treadmill + stairs + rope', 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', false, '2026-04-28 08:00:00+00', '2026-04-28 08:00:00+00');

INSERT INTO public.workout_exercises (id, workout_id, exercise_id, "position", created_at, updated_at) VALUES
  ('c1d11000-0000-4000-8000-000000000001', 'c1d10000-0000-4000-8000-000000000001', '019e0675-a94d-7663-a002-da133cfe683c', 0, '2026-04-28 08:00:00+00', '2026-04-28 08:00:00+00'), -- Running_Treadmill
  ('c1d11000-0000-4000-8000-000000000002', 'c1d10000-0000-4000-8000-000000000001', '019e0675-ab06-72cb-9d12-2926eec65dc7', 1, '2026-04-28 08:00:00+00', '2026-04-28 08:00:00+00'), -- Stairmaster
  ('c1d11000-0000-4000-8000-000000000003', 'c1d10000-0000-4000-8000-000000000001', '019e0675-a948-797c-897c-1576cecd2c26', 2, '2026-04-28 08:00:00+00', '2026-04-28 08:00:00+00'); -- Rope_Jumping

INSERT INTO public.workout_sessions (id, workout_id, user_id, started_at, created_at, updated_at) VALUES
  ('c1d20000-0000-4000-8000-000000000001', 'c1d10000-0000-4000-8000-000000000001', 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-05-01 07:30:00+00', '2026-05-01 07:30:00+00', '2026-05-01 07:30:00+00'),
  ('c1d20000-0000-4000-8000-000000000002', 'c1d10000-0000-4000-8000-000000000001', 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-05-04 07:15:00+00', '2026-05-04 07:15:00+00', '2026-05-04 07:15:00+00'),
  ('c1d20000-0000-4000-8000-000000000003', 'c1d10000-0000-4000-8000-000000000001', 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-05-07 07:00:00+00', '2026-05-07 07:00:00+00', '2026-05-07 07:00:00+00'),
  ('c1d20000-0000-4000-8000-000000000004', 'c1d10000-0000-4000-8000-000000000001', 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-05-09 18:45:00+00', '2026-05-09 18:45:00+00', '2026-05-09 18:45:00+00');

INSERT INTO public.workout_session_exercises (id, workout_session_id, exercise_id, "position", created_at, updated_at) VALUES
  -- Session 1: easy steady-state run.
  ('c1d30000-0000-4000-8000-000000000001', 'c1d20000-0000-4000-8000-000000000001', '019e0675-a94d-7663-a002-da133cfe683c', 0, '2026-05-01 07:30:00+00', '2026-05-01 07:30:00+00'),
  -- Session 2: run + stairs.
  ('c1d30000-0000-4000-8000-000000000002', 'c1d20000-0000-4000-8000-000000000002', '019e0675-a94d-7663-a002-da133cfe683c', 0, '2026-05-04 07:15:00+00', '2026-05-04 07:15:00+00'),
  ('c1d30000-0000-4000-8000-000000000003', 'c1d20000-0000-4000-8000-000000000002', '019e0675-ab06-72cb-9d12-2926eec65dc7', 1, '2026-05-04 07:15:00+00', '2026-05-04 07:15:00+00'),
  -- Session 3: interval run (4×400m logged as four entries).
  ('c1d30000-0000-4000-8000-000000000004', 'c1d20000-0000-4000-8000-000000000003', '019e0675-a94d-7663-a002-da133cfe683c', 0, '2026-05-07 07:00:00+00', '2026-05-07 07:00:00+00'),
  -- Session 4: rope-jumping intervals.
  ('c1d30000-0000-4000-8000-000000000005', 'c1d20000-0000-4000-8000-000000000004', '019e0675-a948-797c-897c-1576cecd2c26', 0, '2026-05-09 18:45:00+00', '2026-05-09 18:45:00+00');

INSERT INTO public.workout_session_cardio_entries (id, workout_session_exercise_id, entry_number, metrics, created_at, updated_at) VALUES
  -- Session 1: one steady run (running template).
  ('c1d40000-0000-4000-8000-000000000001', 'c1d30000-0000-4000-8000-000000000001', 1, '{"duration_s": 1800, "distance_km": 5.0, "calories_kcal": 280, "avg_hr_bpm": 145}'::jsonb, '2026-05-01 08:00:00+00', '2026-05-01 08:00:00+00'),

  -- Session 2: shorter run, then stairs (stairs template).
  ('c1d40000-0000-4000-8000-000000000002', 'c1d30000-0000-4000-8000-000000000002', 1, '{"duration_s": 1500, "distance_km": 4.2, "calories_kcal": 240, "avg_hr_bpm": 148}'::jsonb, '2026-05-04 07:40:00+00', '2026-05-04 07:40:00+00'),
  ('c1d40000-0000-4000-8000-000000000003', 'c1d30000-0000-4000-8000-000000000003', 1, '{"duration_s": 900, "floors": 30, "steps": 1500, "calories_kcal": 150}'::jsonb, '2026-05-04 07:55:00+00', '2026-05-04 07:55:00+00'),

  -- Session 3: 4×400m intervals on the treadmill (running template, multiple entries).
  ('c1d40000-0000-4000-8000-000000000004', 'c1d30000-0000-4000-8000-000000000004', 1, '{"duration_s": 90,  "distance_km": 0.4, "calories_kcal": 35, "avg_hr_bpm": 160}'::jsonb, '2026-05-07 07:08:00+00', '2026-05-07 07:08:00+00'),
  ('c1d40000-0000-4000-8000-000000000005', 'c1d30000-0000-4000-8000-000000000004', 2, '{"duration_s": 92,  "distance_km": 0.4, "calories_kcal": 38, "avg_hr_bpm": 168}'::jsonb, '2026-05-07 07:12:00+00', '2026-05-07 07:12:00+00'),
  ('c1d40000-0000-4000-8000-000000000006', 'c1d30000-0000-4000-8000-000000000004', 3, '{"duration_s": 91,  "distance_km": 0.4, "calories_kcal": 37, "avg_hr_bpm": 170}'::jsonb, '2026-05-07 07:16:00+00', '2026-05-07 07:16:00+00'),
  ('c1d40000-0000-4000-8000-000000000007', 'c1d30000-0000-4000-8000-000000000004', 4, '{"duration_s": 95,  "distance_km": 0.4, "calories_kcal": 39, "avg_hr_bpm": 172}'::jsonb, '2026-05-07 07:20:00+00', '2026-05-07 07:20:00+00'),

  -- Session 4: rope-jumping intervals (interval template).
  ('c1d40000-0000-4000-8000-000000000008', 'c1d30000-0000-4000-8000-000000000005', 1, '{"duration_s": 60, "rounds": 3, "calories_kcal": 25}'::jsonb, '2026-05-09 18:46:00+00', '2026-05-09 18:46:00+00'),
  ('c1d40000-0000-4000-8000-000000000009', 'c1d30000-0000-4000-8000-000000000005', 2, '{"duration_s": 60, "rounds": 3, "calories_kcal": 24}'::jsonb, '2026-05-09 18:49:00+00', '2026-05-09 18:49:00+00'),
  ('c1d40000-0000-4000-8000-000000000010', 'c1d30000-0000-4000-8000-000000000005', 3, '{"duration_s": 90, "rounds": 4, "calories_kcal": 35}'::jsonb, '2026-05-09 18:53:00+00', '2026-05-09 18:53:00+00');
