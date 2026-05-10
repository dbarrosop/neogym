SET transaction_timeout = 0;
SET check_function_bodies = false;

-- Map each seeded workout to one of the public labels created in migration
-- 1778716800000_labels: aN1 = push, aN2 = legs, aN3 = pull.
INSERT INTO public.workout_labels (workout_id, label_id)
SELECT
  w.id,
  l.id
FROM public.workouts w
JOIN public.labels l
  ON l.is_public = true
 AND l.name = CASE right(w.name, 1)
   WHEN '1' THEN 'push'
   WHEN '2' THEN 'legs'
   WHEN '3' THEN 'pull'
 END
WHERE w.user_id = 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c'
  AND w.name ~ '^a[0-9]+[123]$'
ON CONFLICT DO NOTHING;
