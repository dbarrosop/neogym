-- Opt-in, local-only gallery fixture. See seed.ts for the Docker ownership guard.
BEGIN;
SELECT set_config('neogym_gallery.user_id', :'user_id', true),
       set_config('neogym_gallery.email', :'email', true),
       set_config('neogym_gallery.marker', :'marker', true);

-- Fail closed if the reserved ID or email belongs to an unmarked account.
DO $$
DECLARE
  target uuid := current_setting('neogym_gallery.user_id')::uuid;
  address text := current_setting('neogym_gallery.email');
  marker text := current_setting('neogym_gallery.marker');
BEGIN
  IF EXISTS (
    SELECT FROM auth.users
    WHERE (id = target OR lower(email) = lower(address))
      AND NOT (id = target AND email IS NOT DISTINCT FROM address
               AND metadata->>'fixture' IS NOT DISTINCT FROM marker)
  ) THEN
    RAISE EXCEPTION 'Refusing to reset an unmarked gallery account';
  END IF;
END $$;

-- Delete dependent private rows in FK order before the owner cascade.
DELETE FROM public.nutrition_days WHERE user_id = :'user_id';
DELETE FROM public.nutrition_plans WHERE user_id = :'user_id';
DELETE FROM public.meals WHERE user_id = :'user_id';
DELETE FROM public.workout_sessions WHERE user_id = :'user_id';
DELETE FROM public.workouts WHERE user_id = :'user_id';
DELETE FROM auth.users
WHERE id = :'user_id' AND email = :'email' AND metadata->>'fixture' = :'marker';

INSERT INTO auth.users (
  id, email, display_name, created_at, updated_at, email_verified,
  default_role, locale, disabled, is_anonymous, metadata
) VALUES (
  :'user_id', :'email', :'display_name', :'created_at', :'created_at', true,
  'user', 'en', false, false, jsonb_build_object('fixture', :'marker')
);
INSERT INTO auth.user_roles (user_id, role) VALUES (:'user_id', 'user');

-- Today displays the server's row update time. Seed it explicitly instead of
-- overriding the API response or disabling the real update trigger.
INSERT INTO public.daily_energy (user_id, energy_on, active_kcal, resting_kcal, notes, created_at, updated_at)
SELECT :'user_id'::uuid, :'today'::date - n,
       CASE WHEN n = 0 THEN 240 ELSE 450 + (n % 5) * 85 END,
       CASE WHEN n = 0 THEN 780 ELSE 1750 + (n % 3) * 25 END,
       'Imported from Apple Health',
       (:'today'::date - n) + :'energy_time'::timetz,
       (:'today'::date - n) + :'energy_time'::timetz
FROM generate_series(0, 95) AS n;
COMMIT;
