-- =====================================================================
-- Nutrition domain: foods, meal templates, daily plans, and intake logs.
-- =====================================================================

-- foods follows the existing owner-or-public catalog-table precedent used by
-- exercises/workouts/labels: public rows live in the NULL user namespace,
-- private rows live under auth.users, and UNIQUE NULLS NOT DISTINCT makes
-- the public namespace collide on (NULL, name) instead of allowing duplicate
-- public names. `brand` is intentionally deferred for v1 to avoid ambiguity
-- in the identity contract.
CREATE TABLE public.foods (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  name              text NOT NULL,
  user_id           uuid REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  is_public         boolean NOT NULL DEFAULT false,
  kcal_per_100g     numeric(8,2) NOT NULL CHECK (kcal_per_100g >= 0),
  fat_per_100g      numeric(8,2) NOT NULL CHECK (fat_per_100g >= 0),
  carbs_per_100g    numeric(8,2) NOT NULL CHECK (carbs_per_100g >= 0),
  protein_per_100g  numeric(8,2) NOT NULL CHECK (protein_per_100g >= 0),
  fiber_per_100g    numeric(8,2) NOT NULL CHECK (fiber_per_100g >= 0),
  sugar_per_100g    numeric(8,2) NOT NULL CHECK (sugar_per_100g >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT foods_name_format_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT foods_visibility_check CHECK (
    (is_public = true AND user_id IS NULL) OR
    (is_public = false AND user_id IS NOT NULL)
  ),
  CONSTRAINT foods_user_name_uq UNIQUE NULLS NOT DISTINCT (user_id, name)
);

COMMENT ON TABLE public.foods IS
  'Owner-or-public nutrition catalog. Nutrients are canonical per 100 grams. v1 intentionally has no brand column; name uniqueness follows the exercises/workouts/labels UNIQUE NULLS NOT DISTINCT catalog precedent.';

CREATE INDEX foods_user_id_idx ON public.foods(user_id);
CREATE INDEX foods_public_name_idx ON public.foods(name) WHERE is_public = true;
CREATE INDEX foods_user_name_idx ON public.foods(user_id, name);

CREATE TRIGGER set_public_foods_updated_at
BEFORE UPDATE ON public.foods
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_foods_updated_at ON public.foods
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE TABLE public.meals (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meals_name_format_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT meals_user_name_uq UNIQUE (user_id, name)
);
CREATE INDEX meals_user_id_idx ON public.meals(user_id);
CREATE INDEX meals_user_name_idx ON public.meals(user_id, name);

CREATE TRIGGER set_public_meals_updated_at
BEFORE UPDATE ON public.meals
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_meals_updated_at ON public.meals
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE TABLE public.meal_ingredients (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  meal_id     uuid NOT NULL REFERENCES public.meals(id) ON UPDATE CASCADE ON DELETE CASCADE,
  food_id     uuid NOT NULL REFERENCES public.foods(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  grams       numeric(8,2) NOT NULL CHECK (grams > 0),
  position    integer NOT NULL CHECK (position >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meal_ingredients_meal_id_idx ON public.meal_ingredients(meal_id);
CREATE INDEX meal_ingredients_food_id_idx ON public.meal_ingredients(food_id);
CREATE INDEX meal_ingredients_meal_order_idx ON public.meal_ingredients(meal_id, position, id);

CREATE TRIGGER set_public_meal_ingredients_updated_at
BEFORE UPDATE ON public.meal_ingredients
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_meal_ingredients_updated_at ON public.meal_ingredients
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE TABLE public.nutrition_plans (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_plans_name_format_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT nutrition_plans_user_name_uq UNIQUE (user_id, name)
);
CREATE INDEX nutrition_plans_user_id_idx ON public.nutrition_plans(user_id);
CREATE INDEX nutrition_plans_user_name_idx ON public.nutrition_plans(user_id, name);

CREATE TRIGGER set_public_nutrition_plans_updated_at
BEFORE UPDATE ON public.nutrition_plans
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_nutrition_plans_updated_at ON public.nutrition_plans
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE TABLE public.nutrition_plan_meals (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  nutrition_plan_id  uuid NOT NULL REFERENCES public.nutrition_plans(id) ON UPDATE CASCADE ON DELETE CASCADE,
  meal_id            uuid NOT NULL REFERENCES public.meals(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  slot_time          time NOT NULL,
  label              text,
  position           integer NOT NULL CHECK (position >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_plan_meals_label_format_check CHECK (label IS NULL OR length(btrim(label)) BETWEEN 1 AND 160)
);
CREATE INDEX nutrition_plan_meals_plan_id_idx ON public.nutrition_plan_meals(nutrition_plan_id);
CREATE INDEX nutrition_plan_meals_meal_id_idx ON public.nutrition_plan_meals(meal_id);
CREATE INDEX nutrition_plan_meals_plan_order_idx ON public.nutrition_plan_meals(nutrition_plan_id, slot_time, position, id);

CREATE TRIGGER set_public_nutrition_plan_meals_updated_at
BEFORE UPDATE ON public.nutrition_plan_meals
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_nutrition_plan_meals_updated_at ON public.nutrition_plan_meals
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE TABLE public.nutrition_days (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  log_date           date NOT NULL,
  nutrition_plan_id  uuid REFERENCES public.nutrition_plans(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_days_user_date_uq UNIQUE (user_id, log_date)
);
CREATE INDEX nutrition_days_user_id_idx ON public.nutrition_days(user_id);
CREATE INDEX nutrition_days_plan_id_idx ON public.nutrition_days(nutrition_plan_id);
CREATE INDEX nutrition_days_user_date_idx ON public.nutrition_days(user_id, log_date DESC);

CREATE TRIGGER set_public_nutrition_days_updated_at
BEFORE UPDATE ON public.nutrition_days
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_nutrition_days_updated_at ON public.nutrition_days
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE TABLE public.nutrition_log_meals (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  nutrition_day_id         uuid NOT NULL REFERENCES public.nutrition_days(id) ON UPDATE CASCADE ON DELETE CASCADE,
  meal_id                  uuid REFERENCES public.meals(id) ON UPDATE CASCADE ON DELETE SET NULL,
  nutrition_plan_meal_id   uuid REFERENCES public.nutrition_plan_meals(id) ON UPDATE CASCADE ON DELETE SET NULL,
  name                     text NOT NULL,
  slot_time                time,
  position                 integer NOT NULL CHECK (position >= 0),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_log_meals_name_format_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT nutrition_log_meals_id_day_uq UNIQUE (id, nutrition_day_id)
);
CREATE INDEX nutrition_log_meals_day_id_idx ON public.nutrition_log_meals(nutrition_day_id);
CREATE INDEX nutrition_log_meals_meal_id_idx ON public.nutrition_log_meals(meal_id);
CREATE INDEX nutrition_log_meals_plan_meal_id_idx ON public.nutrition_log_meals(nutrition_plan_meal_id);
CREATE INDEX nutrition_log_meals_day_order_idx ON public.nutrition_log_meals(nutrition_day_id, slot_time, position, id);
COMMENT ON COLUMN public.nutrition_log_meals.slot_time IS
  'Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time.';

CREATE TRIGGER set_public_nutrition_log_meals_updated_at
BEFORE UPDATE ON public.nutrition_log_meals
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_nutrition_log_meals_updated_at ON public.nutrition_log_meals
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

CREATE TABLE public.nutrition_log_entries (
  id                         uuid PRIMARY KEY DEFAULT uuidv7(),
  nutrition_day_id           uuid NOT NULL REFERENCES public.nutrition_days(id) ON UPDATE CASCADE ON DELETE CASCADE,
  nutrition_log_meal_id      uuid,
  food_id                    uuid REFERENCES public.foods(id) ON UPDATE CASCADE ON DELETE SET NULL,
  grams                      numeric(8,2) NOT NULL CHECK (grams > 0),
  position                   integer NOT NULL CHECK (position >= 0),
  slot_time                  time,
  snapshot_food_name         text NOT NULL,
  snapshot_kcal_per_100g     numeric(8,2) NOT NULL CHECK (snapshot_kcal_per_100g >= 0),
  snapshot_fat_per_100g      numeric(8,2) NOT NULL CHECK (snapshot_fat_per_100g >= 0),
  snapshot_carbs_per_100g    numeric(8,2) NOT NULL CHECK (snapshot_carbs_per_100g >= 0),
  snapshot_protein_per_100g  numeric(8,2) NOT NULL CHECK (snapshot_protein_per_100g >= 0),
  snapshot_fiber_per_100g    numeric(8,2) NOT NULL CHECK (snapshot_fiber_per_100g >= 0),
  snapshot_sugar_per_100g    numeric(8,2) NOT NULL CHECK (snapshot_sugar_per_100g >= 0),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_log_entries_group_day_fk
    FOREIGN KEY (nutrition_log_meal_id, nutrition_day_id)
    REFERENCES public.nutrition_log_meals(id, nutrition_day_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);
COMMENT ON TABLE public.nutrition_log_entries IS
  'Historical food log rows. The trusted snapshot_* columns are populated by an insert-only trigger from foods and stay stable after source food edits/deletes; users can edit grams/position/slot_time only.';
COMMENT ON COLUMN public.nutrition_log_entries.slot_time IS
  'Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time.';
CREATE INDEX nutrition_log_entries_day_id_idx ON public.nutrition_log_entries(nutrition_day_id);
CREATE INDEX nutrition_log_entries_group_id_idx ON public.nutrition_log_entries(nutrition_log_meal_id);
CREATE INDEX nutrition_log_entries_food_id_idx ON public.nutrition_log_entries(food_id);
CREATE INDEX nutrition_log_entries_day_order_idx ON public.nutrition_log_entries(nutrition_day_id, slot_time, position, id);

CREATE OR REPLACE FUNCTION public.populate_nutrition_log_entry_food_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_food public.foods%ROWTYPE;
BEGIN
  IF NEW.food_id IS NULL THEN
    RAISE EXCEPTION 'nutrition_log_entries.food_id is required on insert so food snapshots can be populated'
      USING ERRCODE = '23502',
            HINT = 'Historical rows may later keep food_id NULL after source food deletion, but inserts must reference a visible food.';
  END IF;

  SELECT * INTO v_food FROM public.foods WHERE id = NEW.food_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'food % does not exist for nutrition log snapshot', NEW.food_id
      USING ERRCODE = '23503';
  END IF;

  NEW.snapshot_food_name := v_food.name;
  NEW.snapshot_kcal_per_100g := v_food.kcal_per_100g;
  NEW.snapshot_fat_per_100g := v_food.fat_per_100g;
  NEW.snapshot_carbs_per_100g := v_food.carbs_per_100g;
  NEW.snapshot_protein_per_100g := v_food.protein_per_100g;
  NEW.snapshot_fiber_per_100g := v_food.fiber_per_100g;
  NEW.snapshot_sugar_per_100g := v_food.sugar_per_100g;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.populate_nutrition_log_entry_food_snapshot() IS
  'Insert-only trusted snapshot trigger for nutrition_log_entries. Copies food name and per-100g nutrients at log time and rejects NULL food_id on insert; it deliberately does not run on update or food delete.';

CREATE TRIGGER populate_public_nutrition_log_entry_food_snapshot
BEFORE INSERT ON public.nutrition_log_entries
FOR EACH ROW EXECUTE FUNCTION public.populate_nutrition_log_entry_food_snapshot();
COMMENT ON TRIGGER populate_public_nutrition_log_entry_food_snapshot ON public.nutrition_log_entries
IS 'insert-only trigger that copies trusted food snapshots into nutrition log entries';

CREATE TRIGGER set_public_nutrition_log_entries_updated_at
BEFORE UPDATE ON public.nutrition_log_entries
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_nutrition_log_entries_updated_at ON public.nutrition_log_entries
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
