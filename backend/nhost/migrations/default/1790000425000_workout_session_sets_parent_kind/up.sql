-- Mirror the cardio-entries trick on the strength-sets table: pin the
-- discriminator to 'strength' and composite-FK to workout_session_exercises
-- (id, kind). The end result is that the strength/cardio split is enforced
-- symmetrically at the FK level — strength sets can only attach to strength
-- session-exercises, cardio entries can only attach to cardio ones. Closes
-- the previous integrity asymmetry where only cardio had a guard.

ALTER TABLE public.workout_session_sets
  ADD COLUMN parent_kind text NOT NULL DEFAULT 'strength'
    CHECK (parent_kind = 'strength');

ALTER TABLE public.workout_session_sets
  DROP CONSTRAINT workout_session_sets_workout_session_exercise_id_fkey,
  ADD CONSTRAINT workout_session_sets_workout_session_exercise_id_kind_fk
    FOREIGN KEY (workout_session_exercise_id, parent_kind)
    REFERENCES public.workout_session_exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE;
