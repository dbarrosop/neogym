ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_metrics_schema_check;
ALTER TABLE public.exercises DROP COLUMN IF EXISTS metrics_schema;
