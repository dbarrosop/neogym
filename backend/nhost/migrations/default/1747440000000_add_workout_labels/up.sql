-- =====================================================================
-- workout_labels: user-owned text labels, composite PK (user_id, id)
-- =====================================================================
CREATE TABLE public.workout_labels (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  id          text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  CONSTRAINT workout_labels_id_length_check
    CHECK (char_length(id) BETWEEN 1 AND 60)
);

CREATE INDEX workout_labels_user_id_idx ON public.workout_labels(user_id);

-- =====================================================================
-- workout_workout_labels: junction linking workouts ↔ labels
-- =====================================================================
CREATE TABLE public.workout_workout_labels (
  workout_id    uuid NOT NULL REFERENCES public.workouts(id)  ON UPDATE CASCADE ON DELETE CASCADE,
  label_id      text NOT NULL,
  label_user_id uuid NOT NULL,
  PRIMARY KEY (workout_id, label_id),
  CONSTRAINT workout_workout_labels_label_fk
    FOREIGN KEY (label_user_id, label_id)
    REFERENCES public.workout_labels(user_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX workout_workout_labels_label_idx
  ON public.workout_workout_labels(label_user_id, label_id);
CREATE INDEX workout_workout_labels_workout_id_idx
  ON public.workout_workout_labels(workout_id);
