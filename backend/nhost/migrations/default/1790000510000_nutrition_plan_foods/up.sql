-- Add direct food entries to nutrition plans and standalone log provenance.

CREATE TABLE public.nutrition_plan_foods (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  nutrition_plan_id  uuid NOT NULL REFERENCES public.nutrition_plans(id) ON UPDATE CASCADE ON DELETE CASCADE,
  food_id            uuid NOT NULL REFERENCES public.foods(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  grams              numeric(8,2) NOT NULL CHECK (grams > 0),
  slot_time          time NOT NULL,
  label              text,
  position           integer NOT NULL CHECK (position >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_plan_foods_label_format_check CHECK (label IS NULL OR length(btrim(label)) BETWEEN 1 AND 160)
);
COMMENT ON TABLE public.nutrition_plan_foods IS
  'Direct food entries in reusable nutrition plan templates. Mixed meal/food plan ordering is client-managed with slot_time plus a global per-slot position across nutrition_plan_meals and nutrition_plan_foods.';
COMMENT ON COLUMN public.nutrition_plan_foods.slot_time IS
  'Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion.';

CREATE INDEX nutrition_plan_foods_plan_id_idx ON public.nutrition_plan_foods(nutrition_plan_id);
CREATE INDEX nutrition_plan_foods_food_id_idx ON public.nutrition_plan_foods(food_id);
CREATE INDEX nutrition_plan_foods_plan_order_idx ON public.nutrition_plan_foods(nutrition_plan_id, slot_time, position, id);

CREATE TRIGGER set_public_nutrition_plan_foods_updated_at
BEFORE UPDATE ON public.nutrition_plan_foods
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_nutrition_plan_foods_updated_at ON public.nutrition_plan_foods
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

ALTER TABLE public.nutrition_log_entries
  ADD COLUMN nutrition_plan_food_id uuid REFERENCES public.nutrition_plan_foods(id) ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON COLUMN public.nutrition_log_entries.nutrition_plan_food_id IS
  'Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain.';

CREATE INDEX nutrition_log_entries_plan_food_id_idx ON public.nutrition_log_entries(nutrition_plan_food_id);

CREATE OR REPLACE FUNCTION public.check_nutrition_log_entry_plan_food_provenance()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_food public.nutrition_plan_foods%ROWTYPE;
BEGIN
  IF NEW.nutrition_plan_food_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.nutrition_log_meal_id IS NOT NULL THEN
    RAISE EXCEPTION 'nutrition_log_entries.nutrition_plan_food_id is only valid for standalone log entries'
      USING ERRCODE = '23514',
            HINT = 'Plan-food provenance cannot be combined with nutrition_log_meal_id; plan meals use nutrition_log_meals.nutrition_plan_meal_id.';
  END IF;

  SELECT * INTO v_plan_food
  FROM public.nutrition_plan_foods
  WHERE id = NEW.nutrition_plan_food_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nutrition_plan_food % does not exist for nutrition log provenance', NEW.nutrition_plan_food_id
      USING ERRCODE = '23503';
  END IF;

  IF NEW.food_id IS DISTINCT FROM v_plan_food.food_id THEN
    RAISE EXCEPTION 'nutrition_log_entries.food_id must match nutrition_plan_foods.food_id for plan-food provenance'
      USING ERRCODE = '23514',
            HINT = 'Log entries copied from direct plan foods keep nutrition_plan_food_id as provenance but must snapshot the same food.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION public.check_nutrition_log_entry_plan_food_provenance() IS
  'Ensures direct plan-food provenance is used only on standalone log entries and references the same source food that is being snapshotted.';

CREATE TRIGGER check_public_nutrition_log_entry_plan_food_provenance
BEFORE INSERT OR UPDATE OF nutrition_plan_food_id, nutrition_log_meal_id, food_id
ON public.nutrition_log_entries
FOR EACH ROW EXECUTE FUNCTION public.check_nutrition_log_entry_plan_food_provenance();
COMMENT ON TRIGGER check_public_nutrition_log_entry_plan_food_provenance ON public.nutrition_log_entries
IS 'validates standalone/direct-food provenance for nutrition log entries';
