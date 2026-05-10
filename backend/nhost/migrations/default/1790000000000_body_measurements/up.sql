-- =====================================================================
-- body_measurements
-- One row per (user, date) capturing weight (kg) and/or body-fat (%).
-- Both metrics are nullable so a user can log either independently, but
-- a CHECK enforces that at least one is provided.
-- =====================================================================
CREATE TABLE public.body_measurements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  measured_on   date NOT NULL,
  weight_kg     numeric(5,2) NULL,
  body_fat_pct  numeric(4,2) NULL,
  notes         text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT body_measurements_user_date_key UNIQUE (user_id, measured_on),
  CONSTRAINT body_measurements_at_least_one_value_check
    CHECK (weight_kg IS NOT NULL OR body_fat_pct IS NOT NULL),
  CONSTRAINT body_measurements_weight_kg_range_check
    CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 500)),
  CONSTRAINT body_measurements_body_fat_pct_range_check
    CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 0 AND body_fat_pct <= 100))
);
CREATE INDEX body_measurements_user_date_idx
  ON public.body_measurements(user_id, measured_on DESC);

CREATE TRIGGER set_public_body_measurements_updated_at
BEFORE UPDATE ON public.body_measurements
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_body_measurements_updated_at ON public.body_measurements
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
