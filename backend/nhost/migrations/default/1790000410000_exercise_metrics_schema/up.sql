ALTER TABLE public.exercises ADD COLUMN metrics_schema jsonb NULL;

-- Backfill seeded cardio exercises with their template schemas before adding
-- the CHECK constraint. The CHECK requires that any cardio row has a
-- non-null, valid JSON Schema, so backfill must complete first.

-- Template "running": distance + duration + calories + heart rate.
UPDATE public.exercises SET metrics_schema = $$
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
UPDATE public.exercises SET metrics_schema = $$
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
WHERE slug IN (
  'Stairmaster',
  'Step_Mill'
);

-- Template "interval": duration + rounds + calories.
UPDATE public.exercises SET metrics_schema = $$
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "duration_s":    { "type": "integer", "minimum": 0, "maximum": 3600,
                       "x-label": "Duration", "x-unit": "",     "x-format": "duration_seconds", "x-order": 1 },
    "rounds":        { "type": "integer", "minimum": 0, "maximum": 100,
                       "x-label": "Rounds",   "x-unit": "",     "x-format": "integer",          "x-order": 2 },
    "calories_kcal": { "type": "integer", "minimum": 0, "maximum": 10000,
                       "x-label": "Calories", "x-unit": "kcal", "x-format": "integer",          "x-order": 3 }
  },
  "required": ["duration_s"]
}
$$::jsonb
WHERE slug IN (
  'Rope_Jumping',
  'Prowler_Sprint'
);

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_metrics_schema_check CHECK (
    CASE
      WHEN category = 'cardio'
        THEN metrics_schema IS NOT NULL
             AND jsonschema_is_valid(metrics_schema::json)
      ELSE metrics_schema IS NULL
    END
  );

COMMENT ON COLUMN public.exercises.metrics_schema IS
  'JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session.';
