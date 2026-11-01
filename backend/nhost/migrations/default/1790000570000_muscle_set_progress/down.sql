DROP FUNCTION public.muscle_set_progress(date, date, text, json);
DROP TABLE public.muscle_set_progress_rows;

-- Collapse all three heads back to the legacy group. The PK prevents duplicate
-- shoulder links when a catalog exercise has multiple delt-head associations.
INSERT INTO public.exercise_secondary_muscle_groups (exercise_id, muscle_group)
SELECT exercise_id, 'shoulders'
FROM public.exercise_secondary_muscle_groups
WHERE muscle_group IN ('front_delts', 'side_delts', 'rear_delts')
ON CONFLICT DO NOTHING;
DELETE FROM public.exercise_secondary_muscle_groups
WHERE muscle_group IN ('front_delts', 'side_delts', 'rear_delts');
UPDATE public.exercises SET primary_muscle_group = 'shoulders'
WHERE primary_muscle_group IN ('front_delts', 'side_delts', 'rear_delts');
DELETE FROM public.muscle_groups WHERE value IN ('front_delts', 'side_delts', 'rear_delts');
