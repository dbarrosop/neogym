-- Revert to ON DELETE CASCADE. Note: with SET NULL in effect, any sessions
-- whose workout was deleted now have workout_id = NULL — reverting the FK
-- action doesn't reattach them; they remain ad-hoc.
ALTER TABLE public.workout_sessions
  DROP CONSTRAINT workout_sessions_workout_id_fkey,
  ADD CONSTRAINT workout_sessions_workout_id_fkey
    FOREIGN KEY (workout_id) REFERENCES public.workouts(id)
    ON UPDATE CASCADE ON DELETE CASCADE;
