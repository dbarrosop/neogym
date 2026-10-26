-- Restore the previous seeded associations for the same public exercise IDs.
-- User-owned exercises and primary targets remain unchanged on rollback too.
DELETE FROM public.exercise_secondary_muscle_groups AS sm
USING (VALUES
  ('019e0675-a2a1-77d0-9cee-39cfad6a62e9'::uuid, 'side_delts'),
  ('019e0675-a9b4-771c-b3c8-a6219f99df89'::uuid, 'side_delts'),
  ('019e0675-a597-7724-bd17-40c101d5773f'::uuid, 'forearms'),
  ('019e0675-a2e0-7405-a6ef-9c2822bef44d'::uuid, 'lower_back'),
  ('019e0675-a26c-7db4-8037-cfdc635707a7'::uuid, 'lats')
) AS mapping(id, target), public.exercises AS e
WHERE e.id = mapping.id AND e.is_public
  AND sm.exercise_id = e.id AND sm.muscle_group = mapping.target;

WITH reviewed_rear_delts AS (
  DELETE FROM public.exercise_secondary_muscle_groups AS sm
  USING public.exercises AS e
  WHERE e.id = sm.exercise_id AND e.is_public
    AND e.id = '019e0675-ac8f-76d4-b224-5fba7c7a8b69'::uuid
    AND sm.muscle_group = 'rear_delts'
  RETURNING sm.exercise_id
)
INSERT INTO public.exercise_secondary_muscle_groups (exercise_id, muscle_group)
SELECT exercise_id, 'shoulders' FROM reviewed_rear_delts
ON CONFLICT (exercise_id, muscle_group) DO NOTHING;

INSERT INTO public.exercise_secondary_muscle_groups (exercise_id, muscle_group)
SELECT e.id, 'calves'
FROM public.exercises AS e
WHERE e.is_public AND e.id IN (
  '019e0675-a934-7a87-8e7b-7c3f41c7af5b'::uuid,
  '019e0675-a552-72ed-9b8e-bb9f36750092'::uuid,
  '019e0675-a2b6-7a74-b5c9-709e056b5c36'::uuid
)
ON CONFLICT (exercise_id, muscle_group) DO NOTHING;
