-- workout_exercises cascade out of public.workouts; any user sessions
-- started from these templates ALSO cascade out (see sessions.md). The
-- down migration destroys that history.

DELETE FROM public.workouts WHERE id IN (
  -- Strength Foundation
  '57e10000-0000-4000-8000-000000000001',
  '57e10000-0000-4000-8000-000000000002',
  '57e10000-0000-4000-8000-000000000003',
  -- Fat Loss
  'fa710000-0000-4000-8000-000000000001',
  'fa710000-0000-4000-8000-000000000002',
  'fa710000-0000-4000-8000-000000000003',
  -- Functional Fitness
  'f00c0000-0000-4000-8000-000000000001',
  'f00c0000-0000-4000-8000-000000000002',
  'f00c0000-0000-4000-8000-000000000003'
);
