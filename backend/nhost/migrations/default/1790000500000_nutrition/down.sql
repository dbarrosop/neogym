DROP TRIGGER IF EXISTS set_public_nutrition_log_entries_updated_at ON public.nutrition_log_entries;
DROP TRIGGER IF EXISTS populate_public_nutrition_log_entry_food_snapshot ON public.nutrition_log_entries;
DROP FUNCTION IF EXISTS public.populate_nutrition_log_entry_food_snapshot();
DROP TRIGGER IF EXISTS set_public_nutrition_log_meals_updated_at ON public.nutrition_log_meals;
DROP TRIGGER IF EXISTS set_public_nutrition_days_updated_at ON public.nutrition_days;
DROP TRIGGER IF EXISTS set_public_nutrition_plan_meals_updated_at ON public.nutrition_plan_meals;
DROP TRIGGER IF EXISTS set_public_nutrition_plans_updated_at ON public.nutrition_plans;
DROP TRIGGER IF EXISTS set_public_meal_ingredients_updated_at ON public.meal_ingredients;
DROP TRIGGER IF EXISTS set_public_meals_updated_at ON public.meals;
DROP TRIGGER IF EXISTS set_public_foods_updated_at ON public.foods;

DROP TABLE IF EXISTS public.nutrition_log_entries;
DROP TABLE IF EXISTS public.nutrition_log_meals;
DROP TABLE IF EXISTS public.nutrition_days;
DROP TABLE IF EXISTS public.nutrition_plan_meals;
DROP TABLE IF EXISTS public.nutrition_plans;
DROP TABLE IF EXISTS public.meal_ingredients;
DROP TABLE IF EXISTS public.meals;
DROP TABLE IF EXISTS public.foods;
