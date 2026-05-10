-- =====================================================================
-- labels
-- Labels live in a per-user namespace plus a small set of public seeds.
-- Identity is a uuid, with `name` carrying the display text. Two users
-- can independently own a private label called "monday" without colliding,
-- because uniqueness is enforced per (user_id, name) for private labels
-- and per (name) for public seeds.
-- =====================================================================
CREATE TABLE public.labels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  is_public   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labels_name_format_check CHECK (length(name) BETWEEN 1 AND 64),
  CONSTRAINT labels_visibility_check CHECK (
    (is_public = true  AND user_id IS NULL) OR
    (is_public = false AND user_id IS NOT NULL)
  )
);
CREATE INDEX labels_user_id_idx ON public.labels(user_id);
CREATE UNIQUE INDEX labels_user_name_key
  ON public.labels(user_id, name) WHERE is_public = false;
CREATE UNIQUE INDEX labels_public_name_key
  ON public.labels(name) WHERE is_public = true;

CREATE TRIGGER set_public_labels_updated_at
BEFORE UPDATE ON public.labels
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_labels_updated_at ON public.labels
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

INSERT INTO public.labels (name, is_public) VALUES
  ('push',       true),
  ('pull',       true),
  ('legs',       true),
  ('upper body', true),
  ('lower body', true),
  ('full body',  true);

-- =====================================================================
-- workout_labels (workout ↔ label association)
-- No user_id column needed — visibility is enforced through the workout
-- relationship in Hasura permissions, and the label FK is a single column.
-- =====================================================================
CREATE TABLE public.workout_labels (
  workout_id  uuid NOT NULL REFERENCES public.workouts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label_id    uuid NOT NULL REFERENCES public.labels(id)   ON UPDATE CASCADE ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workout_id, label_id)
);
CREATE INDEX workout_labels_label_idx ON public.workout_labels(label_id);
