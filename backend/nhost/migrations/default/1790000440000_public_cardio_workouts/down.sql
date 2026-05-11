-- workout_exercises rows are removed by the FK ON DELETE CASCADE from
-- public.workouts. workout_sessions started from these templates will
-- ALSO cascade-delete (FK on workout_sessions.workout_id is ON DELETE
-- CASCADE), which is a known sharp edge — see docs/developers/sessions.md.
-- If users have logged sessions against these templates, that history
-- is destroyed by this down migration.

DELETE FROM public.workouts WHERE id IN (
  'c0d10000-0000-4000-8000-000000000001',
  'c0d10000-0000-4000-8000-000000000002',
  'c0d10000-0000-4000-8000-000000000003',
  'c0d10000-0000-4000-8000-000000000004'
);
