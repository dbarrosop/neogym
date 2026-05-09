-- =====================================================================
-- labels
-- The id column IS the label text and is the primary key — global
-- namespace shared between public seeds and per-user labels. Visibility
-- mirrors workouts/exercises: is_public=true ↔ user_id IS NULL.
-- A user attempting to create a label that already exists (public or
-- their own) just reuses it via ON CONFLICT DO NOTHING from the client.
-- =====================================================================
CREATE TABLE public.labels (
  id          text PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  is_public   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labels_id_format_check CHECK (length(id) BETWEEN 1 AND 64),
  CONSTRAINT labels_visibility_check CHECK (
    (is_public = true  AND user_id IS NULL) OR
    (is_public = false AND user_id IS NOT NULL)
  )
);
CREATE INDEX labels_user_id_idx ON public.labels(user_id);

CREATE TRIGGER set_public_labels_updated_at
BEFORE UPDATE ON public.labels
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_labels_updated_at ON public.labels
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

INSERT INTO public.labels (id, is_public) VALUES
  ('push',       true),
  ('pull',       true),
  ('legs',       true),
  ('upper_body', true),
  ('lower_body', true),
  ('full_body',  true);

-- =====================================================================
-- workout_labels (workout ↔ label association)
-- No user_id column needed — visibility is enforced through the workout
-- relationship in Hasura permissions, and the label FK is a single column.
-- =====================================================================
CREATE TABLE public.workout_labels (
  workout_id  uuid NOT NULL REFERENCES public.workouts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label_id    text NOT NULL REFERENCES public.labels(id)   ON UPDATE CASCADE ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workout_id, label_id)
);
CREATE INDEX workout_labels_label_idx ON public.workout_labels(label_id);
