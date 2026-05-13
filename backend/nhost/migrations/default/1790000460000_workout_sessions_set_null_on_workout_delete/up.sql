-- Switch workout_sessions.workout_id from ON DELETE CASCADE to ON DELETE SET
-- NULL. Sessions detach to ad-hoc when their parent workout is deleted instead
-- of being wiped along with it.
--
-- Rationale: workout_id became nullable in migration 1790000430000
-- (ad-hoc sessions). With CASCADE the column was both "optional going forward"
-- and "load-bearing for history" — deleting a workout silently destroyed every
-- session ever logged with it. That contradicts the product framing in
-- docs/developers/sessions.md ("the workout link is a template, not a contract")
-- and the user-facing copy on the workout delete dialog
-- (frontend/src/routes/_authed/workouts/$workoutId_.edit.tsx) which already
-- promises "Past sessions you've logged with it stay intact." SET NULL aligns
-- DB, docs, and UI.
--
-- Existing sessions keep their workout_id; only future workout deletions
-- behave differently. ON UPDATE CASCADE is preserved.
ALTER TABLE public.workout_sessions
  DROP CONSTRAINT workout_sessions_workout_id_fkey,
  ADD CONSTRAINT workout_sessions_workout_id_fkey
    FOREIGN KEY (workout_id) REFERENCES public.workouts(id)
    ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON CONSTRAINT workout_sessions_workout_id_fkey ON public.workout_sessions IS
  'ON DELETE SET NULL: deleting a workout detaches its sessions to ad-hoc rather than wiping them. The workout link is a template, not a contract — historical sessions stand on their own. ON UPDATE CASCADE keeps the link intact across id changes. Replaces an earlier ON DELETE CASCADE that contradicted both docs/developers/sessions.md and the user-facing workout-delete dialog copy.';
