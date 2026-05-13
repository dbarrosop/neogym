ALTER TABLE public.workout_sessions ALTER COLUMN workout_id DROP NOT NULL;

COMMENT ON COLUMN public.workout_sessions.workout_id IS
  'NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session''s exercises don''t have to match the workout''s, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000).';
