-- =====================================================================
-- daily_energy
-- One row per (user, date) capturing active and/or resting energy (kcal).
-- Both metrics are nullable so a user can log either independently, but
-- a CHECK enforces that at least one is provided.
-- =====================================================================
CREATE TABLE public.daily_energy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  energy_on     date NOT NULL,
  active_kcal   numeric(7,2) NULL,
  resting_kcal  numeric(7,2) NULL,
  notes         text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_energy_user_date_key UNIQUE (user_id, energy_on),
  CONSTRAINT daily_energy_at_least_one_value_check
    CHECK (active_kcal IS NOT NULL OR resting_kcal IS NOT NULL),
  CONSTRAINT daily_energy_active_kcal_range_check
    CHECK (active_kcal IS NULL OR (active_kcal >= 0 AND active_kcal < 30000)),
  CONSTRAINT daily_energy_resting_kcal_range_check
    CHECK (resting_kcal IS NULL OR (resting_kcal >= 0 AND resting_kcal < 30000))
);
CREATE INDEX daily_energy_user_date_idx
  ON public.daily_energy(user_id, energy_on DESC);

CREATE TRIGGER set_public_daily_energy_updated_at
BEFORE UPDATE ON public.daily_energy
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_daily_energy_updated_at ON public.daily_energy
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
