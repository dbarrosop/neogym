DROP TRIGGER IF EXISTS check_public_nutrition_log_entry_plan_food_provenance ON public.nutrition_log_entries;
DROP FUNCTION IF EXISTS public.check_nutrition_log_entry_plan_food_provenance();
DROP INDEX IF EXISTS public.nutrition_log_entries_plan_food_id_idx;
ALTER TABLE public.nutrition_log_entries
  DROP COLUMN IF EXISTS nutrition_plan_food_id;

DROP TRIGGER IF EXISTS set_public_nutrition_plan_foods_updated_at ON public.nutrition_plan_foods;
DROP TABLE IF EXISTS public.nutrition_plan_foods;
