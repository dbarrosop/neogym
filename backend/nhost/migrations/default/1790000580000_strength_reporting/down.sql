DROP FUNCTION public.exercise_strength_history(public.exercises, timestamptz, timestamptz, json);
DROP FUNCTION public.workout_strength_history(public.workouts, timestamptz, timestamptz, json);
DROP TABLE public.exercise_strength_history_rows;
DROP TABLE public.workout_strength_history_rows;
DROP VIEW public.strength_set_report_facts;
