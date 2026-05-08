DELETE FROM storage.buckets WHERE id = 'exercise_images';

DROP TABLE IF EXISTS public.workout_session_sets       CASCADE;
DROP TABLE IF EXISTS public.workout_session_exercises  CASCADE;
DROP TABLE IF EXISTS public.workout_sessions           CASCADE;
DROP TABLE IF EXISTS public.workout_exercises          CASCADE;
DROP TABLE IF EXISTS public.workouts                   CASCADE;
DROP TABLE IF EXISTS public.exercise_secondary_muscle_groups CASCADE;
DROP TABLE IF EXISTS public.exercises                  CASCADE;
DROP TABLE IF EXISTS public.exercise_equipments        CASCADE;
DROP TABLE IF EXISTS public.exercise_mechanics         CASCADE;
DROP TABLE IF EXISTS public.exercise_forces            CASCADE;
DROP TABLE IF EXISTS public.exercise_categories        CASCADE;
DROP TABLE IF EXISTS public.exercise_levels            CASCADE;
DROP TABLE IF EXISTS public.muscle_groups              CASCADE;

DROP FUNCTION IF EXISTS public.set_current_timestamp_updated_at();
