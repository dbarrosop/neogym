-- =====================================================================
-- updated_at trigger function (Hasura console convention)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_current_timestamp_updated_at()
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- =====================================================================
-- Enum tables (Hasura enum tables — static catalogs, no timestamps)
-- Values must match ^[a-zA-Z_][a-zA-Z0-9_]*$
-- =====================================================================
CREATE TABLE public.muscle_groups (
  value    text PRIMARY KEY,
  comment  text,
  CONSTRAINT muscle_groups_value_format_check
    CHECK (value ~ '^[a-zA-Z_][a-zA-Z0-9_]*$')
);

INSERT INTO public.muscle_groups (value) VALUES
  ('abdominals'), ('abductors'), ('adductors'), ('biceps'), ('calves'),
  ('chest'), ('forearms'), ('glutes'), ('hamstrings'), ('lats'),
  ('lower_back'), ('middle_back'), ('neck'), ('quadriceps'),
  ('shoulders'), ('traps'), ('triceps');

CREATE TABLE public.exercise_levels (
  value    text PRIMARY KEY,
  comment  text,
  CONSTRAINT exercise_levels_value_format_check
    CHECK (value ~ '^[a-zA-Z_][a-zA-Z0-9_]*$')
);
INSERT INTO public.exercise_levels (value) VALUES
  ('beginner'), ('intermediate'), ('expert');

CREATE TABLE public.exercise_categories (
  value    text PRIMARY KEY,
  comment  text,
  CONSTRAINT exercise_categories_value_format_check
    CHECK (value ~ '^[a-zA-Z_][a-zA-Z0-9_]*$')
);
INSERT INTO public.exercise_categories (value) VALUES
  ('cardio'), ('olympic_weightlifting'), ('plyometrics'),
  ('powerlifting'), ('strength'), ('stretching'), ('strongman');

CREATE TABLE public.exercise_forces (
  value    text PRIMARY KEY,
  comment  text,
  CONSTRAINT exercise_forces_value_format_check
    CHECK (value ~ '^[a-zA-Z_][a-zA-Z0-9_]*$')
);
INSERT INTO public.exercise_forces (value) VALUES
  ('pull'), ('push'), ('static');

CREATE TABLE public.exercise_mechanics (
  value    text PRIMARY KEY,
  comment  text,
  CONSTRAINT exercise_mechanics_value_format_check
    CHECK (value ~ '^[a-zA-Z_][a-zA-Z0-9_]*$')
);
INSERT INTO public.exercise_mechanics (value) VALUES
  ('compound'), ('isolation');

CREATE TABLE public.exercise_equipments (
  value    text PRIMARY KEY,
  comment  text,
  CONSTRAINT exercise_equipments_value_format_check
    CHECK (value ~ '^[a-zA-Z_][a-zA-Z0-9_]*$')
);
INSERT INTO public.exercise_equipments (value) VALUES
  ('bands'), ('barbell'), ('body_only'), ('cable'), ('dumbbell'),
  ('ez_curl_bar'), ('exercise_ball'), ('foam_roll'), ('kettlebells'),
  ('machine'), ('medicine_ball'), ('other');

-- =====================================================================
-- Catalog: exercises
-- Public catalog rows: is_public = true, user_id IS NULL.
-- User-created rows:   is_public = false, user_id = X-Hasura-User-Id.
-- =====================================================================
CREATE TABLE public.exercises (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  slug                  text UNIQUE,
  name                  text NOT NULL,
  primary_muscle_group  text NOT NULL REFERENCES public.muscle_groups(value)     ON UPDATE CASCADE ON DELETE RESTRICT,
  double_weight         boolean NOT NULL DEFAULT false,
  instructions          text[] NOT NULL DEFAULT '{}',
  level                 text REFERENCES public.exercise_levels(value)            ON UPDATE CASCADE ON DELETE RESTRICT,
  category              text REFERENCES public.exercise_categories(value)        ON UPDATE CASCADE ON DELETE RESTRICT,
  force                 text REFERENCES public.exercise_forces(value)            ON UPDATE CASCADE ON DELETE RESTRICT,
  mechanic              text REFERENCES public.exercise_mechanics(value)         ON UPDATE CASCADE ON DELETE RESTRICT,
  equipment             text REFERENCES public.exercise_equipments(value)        ON UPDATE CASCADE ON DELETE RESTRICT,
  image_1_file_id       uuid REFERENCES storage.files(id)                        ON UPDATE CASCADE ON DELETE SET NULL,
  image_2_file_id       uuid REFERENCES storage.files(id)                        ON UPDATE CASCADE ON DELETE SET NULL,
  user_id               uuid REFERENCES auth.users(id)                           ON UPDATE CASCADE ON DELETE CASCADE,
  is_public             boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercises_visibility_check CHECK (
    (is_public = true  AND user_id IS NULL) OR
    (is_public = false AND user_id IS NOT NULL)
  ),
  -- Real UNIQUE constraint (not a partial index) so Hasura's `on_conflict`
  -- accepts it. NULLS NOT DISTINCT makes (NULL, name) rows collide, which is
  -- what we want for public catalog rows (user_id IS NULL).
  CONSTRAINT exercises_user_name_uq UNIQUE NULLS NOT DISTINCT (user_id, name)
);
CREATE INDEX exercises_primary_muscle_group_idx ON public.exercises(primary_muscle_group);
CREATE INDEX exercises_user_id_idx              ON public.exercises(user_id);
CREATE INDEX exercises_level_idx                ON public.exercises(level);
CREATE INDEX exercises_category_idx             ON public.exercises(category);
CREATE INDEX exercises_force_idx                ON public.exercises(force);
CREATE INDEX exercises_mechanic_idx             ON public.exercises(mechanic);
CREATE INDEX exercises_equipment_idx            ON public.exercises(equipment);

CREATE TRIGGER set_public_exercises_updated_at
BEFORE UPDATE ON public.exercises
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_exercises_updated_at ON public.exercises
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- =====================================================================
-- Pure association: exercise_secondary_muscle_groups (no timestamps)
-- =====================================================================
CREATE TABLE public.exercise_secondary_muscle_groups (
  exercise_id   uuid NOT NULL REFERENCES public.exercises(id)        ON UPDATE CASCADE ON DELETE CASCADE,
  muscle_group  text NOT NULL REFERENCES public.muscle_groups(value) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, muscle_group)
);
CREATE INDEX exercise_secondary_muscle_groups_muscle_group_idx
  ON public.exercise_secondary_muscle_groups(muscle_group);

-- =====================================================================
-- workouts (per-user OR public)
-- =====================================================================
CREATE TABLE public.workouts (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  name         text NOT NULL,
  description  text,
  user_id      uuid REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  is_public    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workouts_visibility_check CHECK (
    (is_public = true  AND user_id IS NULL) OR
    (is_public = false AND user_id IS NOT NULL)
  ),
  -- See exercises_user_name_uq above for the NULLS NOT DISTINCT rationale.
  CONSTRAINT workouts_user_name_uq UNIQUE NULLS NOT DISTINCT (user_id, name)
);
CREATE INDEX workouts_user_id_idx ON public.workouts(user_id);

CREATE TRIGGER set_public_workouts_updated_at
BEFORE UPDATE ON public.workouts
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_workouts_updated_at ON public.workouts
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- =====================================================================
-- workout_exercises (ordered list of exercises in a workout)
-- =====================================================================
CREATE TABLE public.workout_exercises (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  workout_id   uuid NOT NULL REFERENCES public.workouts(id)  ON UPDATE CASCADE ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  position     integer NOT NULL CHECK (position >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX workout_exercises_exercise_id_idx ON public.workout_exercises(exercise_id);

CREATE TRIGGER set_public_workout_exercises_updated_at
BEFORE UPDATE ON public.workout_exercises
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_workout_exercises_updated_at ON public.workout_exercises
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- =====================================================================
-- workout_sessions (per-user)
-- =====================================================================
CREATE TABLE public.workout_sessions (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  workout_id  uuid NOT NULL REFERENCES public.workouts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id)      ON UPDATE CASCADE ON DELETE CASCADE,
  started_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_sessions_user_id_idx              ON public.workout_sessions(user_id);
CREATE INDEX workout_sessions_workout_id_idx           ON public.workout_sessions(workout_id);
CREATE INDEX workout_sessions_user_id_started_at_idx   ON public.workout_sessions(user_id, started_at DESC);

CREATE TRIGGER set_public_workout_sessions_updated_at
BEFORE UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_workout_sessions_updated_at ON public.workout_sessions
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- =====================================================================
-- workout_session_exercises
-- =====================================================================
CREATE TABLE public.workout_session_exercises (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  workout_session_id  uuid NOT NULL REFERENCES public.workout_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  exercise_id         uuid NOT NULL REFERENCES public.exercises(id)        ON UPDATE CASCADE ON DELETE RESTRICT,
  position            integer NOT NULL CHECK (position >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_session_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX workout_session_exercises_exercise_id_idx ON public.workout_session_exercises(exercise_id);

CREATE TRIGGER set_public_workout_session_exercises_updated_at
BEFORE UPDATE ON public.workout_session_exercises
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_workout_session_exercises_updated_at ON public.workout_session_exercises
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- =====================================================================
-- workout_session_sets
-- =====================================================================
CREATE TABLE public.workout_session_sets (
  id                            uuid PRIMARY KEY DEFAULT uuidv7(),
  workout_session_exercise_id   uuid NOT NULL REFERENCES public.workout_session_exercises(id) ON UPDATE CASCADE ON DELETE CASCADE,
  set_number                    integer NOT NULL CHECK (set_number >= 1),
  reps                          integer NOT NULL CHECK (reps >= 0),
  weight                        numeric(6,2) NOT NULL CHECK (weight >= 0),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_session_exercise_id, set_number)
);

CREATE TRIGGER set_public_workout_session_sets_updated_at
BEFORE UPDATE ON public.workout_session_sets
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_workout_session_sets_updated_at ON public.workout_session_sets
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- =====================================================================
-- Storage bucket: exercise_images (publicly readable, served via Hasura perms on storage.files)
-- =====================================================================
INSERT INTO storage.buckets (id, cache_control, download_expiration, max_upload_file_size, min_upload_file_size, presigned_urls_enabled)
VALUES ('exercise_images', 'public, max-age=31536000', 30, 5242880, 1, true)
ON CONFLICT (id) DO NOTHING;
