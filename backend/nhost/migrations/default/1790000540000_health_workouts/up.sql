-- Private, loss-minimizing snapshots of HealthKit workout records. This is a
-- separate import stream, not a NeoGym workout template or logged session.
CREATE TABLE public.health_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  healthkit_uuid uuid NOT NULL,
  raw jsonb NOT NULL CHECK (jsonb_typeof(raw) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_workouts_user_healthkit_uuid_key UNIQUE (user_id, healthkit_uuid)
);
CREATE INDEX health_workouts_user_idx ON public.health_workouts(user_id);

CREATE TRIGGER set_public_health_workouts_updated_at
BEFORE UPDATE ON public.health_workouts
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_health_workouts_updated_at ON public.health_workouts
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
