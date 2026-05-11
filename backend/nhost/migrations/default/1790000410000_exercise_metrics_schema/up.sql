-- Cardio metrics live in a sidecar table (`exercises_cardio`) rather than on
-- `exercises`. This is class-table inheritance: `exercises.category` is the
-- discriminator, and category='cardio' exercises carry their per-exercise
-- JSON Schema in `exercises_cardio.metrics_schema`. Sessions then enforce the
-- strength/cardio split structurally via composite FKs (see migrations
-- 1790000415000 and 1790000425000). Validation of the metrics jsonb shape is
-- done by a trigger on `workout_session_cardio_entries` (migration
-- 1790000420000), which looks the schema up via this sidecar.

CREATE TABLE public.exercises_cardio (
  exercise_id     uuid PRIMARY KEY REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE CASCADE,
  metrics_schema  jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercises_cardio_schema_valid CHECK (jsonschema_is_valid(metrics_schema::json))
);

CREATE TRIGGER set_public_exercises_cardio_updated_at
BEFORE UPDATE ON public.exercises_cardio
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_exercises_cardio_updated_at ON public.exercises_cardio
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

COMMENT ON COLUMN public.exercises_cardio.metrics_schema IS
  'JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session.';

-- Backfill schemas for the 14 seeded cardio exercises.
-- Template "running": distance + duration + calories + heart rate.
INSERT INTO public.exercises_cardio (exercise_id, metrics_schema)
SELECT id, $$
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "distance_km":   { "type": "number",  "minimum": 0, "exclusiveMaximum": 1000,
                       "x-label": "Distance", "x-unit": "km",   "x-format": "decimal",          "x-order": 1 },
    "duration_s":    { "type": "integer", "minimum": 0, "maximum": 86400,
                       "x-label": "Duration", "x-unit": "",     "x-format": "duration_seconds", "x-order": 2 },
    "calories_kcal": { "type": "integer", "minimum": 0, "maximum": 10000,
                       "x-label": "Calories", "x-unit": "kcal", "x-format": "integer",          "x-order": 3 },
    "avg_hr_bpm":    { "type": "integer", "minimum": 0, "maximum": 300,
                       "x-label": "Avg HR",   "x-unit": "bpm",  "x-format": "average",          "x-order": 4 }
  },
  "required": ["duration_s"]
}
$$::jsonb
FROM public.exercises
WHERE slug IN (
  'Bicycling',
  'Bicycling_Stationary',
  'Elliptical_Trainer',
  'Jogging_Treadmill',
  'Recumbent_Bike',
  'Rowing_Stationary',
  'Running_Treadmill',
  'Trail_Running_Walking',
  'Walking_Treadmill',
  'Skating'
);

-- Template "stairs": duration + floors + steps + calories.
INSERT INTO public.exercises_cardio (exercise_id, metrics_schema)
SELECT id, $$
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "duration_s":    { "type": "integer", "minimum": 0, "maximum": 86400,
                       "x-label": "Duration", "x-unit": "",     "x-format": "duration_seconds", "x-order": 1 },
    "floors":        { "type": "integer", "minimum": 0, "maximum": 10000,
                       "x-label": "Floors",   "x-unit": "",     "x-format": "integer",          "x-order": 2 },
    "steps":         { "type": "integer", "minimum": 0, "maximum": 1000000,
                       "x-label": "Steps",    "x-unit": "",     "x-format": "integer",          "x-order": 3 },
    "calories_kcal": { "type": "integer", "minimum": 0, "maximum": 10000,
                       "x-label": "Calories", "x-unit": "kcal", "x-format": "integer",          "x-order": 4 }
  },
  "required": ["duration_s"]
}
$$::jsonb
FROM public.exercises
WHERE slug IN (
  'Stairmaster',
  'Step_Mill'
);

-- Template "interval": duration + rounds + calories.
INSERT INTO public.exercises_cardio (exercise_id, metrics_schema)
SELECT id, $$
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "duration_s":    { "type": "integer", "minimum": 0,
                       "x-label": "Duration", "x-unit": "",     "x-format": "duration_seconds", "x-order": 1 },
    "rounds":        { "type": "integer", "minimum": 0, "maximum": 100,
                       "x-label": "Rounds",   "x-unit": "",     "x-format": "integer",          "x-order": 2 },
    "calories_kcal": { "type": "integer", "minimum": 0, "maximum": 10000,
                       "x-label": "Calories", "x-unit": "kcal", "x-format": "integer",          "x-order": 3 }
  },
  "required": ["duration_s"]
}
$$::jsonb
FROM public.exercises
WHERE slug IN (
  'Rope_Jumping',
  'Prowler_Sprint'
);
