-- Mirror the cardio-entries trick on the strength-sets table: pin the
-- discriminator to 'strength' and composite-FK to workout_session_exercises
-- (id, kind). The end result is that the strength/cardio split is enforced
-- symmetrically at the FK level — strength sets can only attach to strength
-- session-exercises, cardio entries can only attach to cardio ones. Closes
-- the previous integrity asymmetry where only cardio had a guard.

ALTER TABLE public.workout_session_sets
  ADD COLUMN parent_kind text NOT NULL DEFAULT 'strength'
    CONSTRAINT workout_session_sets_parent_kind_check CHECK (parent_kind = 'strength');

ALTER TABLE public.workout_session_sets
  DROP CONSTRAINT workout_session_sets_workout_session_exercise_id_fkey,
  ADD CONSTRAINT workout_session_sets_workout_session_exercise_id_kind_fk
    FOREIGN KEY (workout_session_exercise_id, parent_kind)
    REFERENCES public.workout_session_exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE;

COMMENT ON COLUMN public.workout_session_sets.parent_kind IS
  'Pinned to ''strength'' via DEFAULT + CHECK. Forms a composite FK with workout_session_exercise_id targeting workout_session_exercises(id, kind), so this row can only attach to a strength session-exercise — closes the integrity asymmetry where only cardio had a guard.';

COMMENT ON CONSTRAINT workout_session_sets_parent_kind_check ON public.workout_session_sets IS
  'Pins parent_kind to ''strength''. Combined with the composite FK to workout_session_exercises(id, kind), this makes the strength/cardio split structural — cardio session-exercises cannot accept strength sets. Renamed to workout_session_strength_sets_parent_kind_check in migration 1790000450000.';

COMMENT ON CONSTRAINT workout_session_sets_workout_session_exercise_id_kind_fk ON public.workout_session_sets IS
  'Composite FK to workout_session_exercises(id, kind). Only matches when parent kind = ''strength''. Symmetric with workout_session_cardio_entries_wse_id_parent_kind_fk. Renamed to workout_session_strength_sets_wse_id_kind_fk in migration 1790000450000.';
