ALTER TABLE public.progress_photo_labels
  RENAME COLUMN comment TO name;

ALTER TABLE public.progress_photo_labels ADD COLUMN position integer;

-- Restore the seeded display order; the enum schema doesn't retain custom ordering.
WITH ordered_labels AS (
  SELECT value, row_number() OVER (
    ORDER BY CASE value WHEN 'front' THEN 0 WHEN 'back' THEN 1 ELSE 2 END, value
  ) - 1 AS position
  FROM public.progress_photo_labels
)
UPDATE public.progress_photo_labels AS l
SET name = coalesce(l.name, initcap(l.value)), position = o.position
FROM ordered_labels AS o
WHERE l.value = o.value;

ALTER TABLE public.progress_photo_labels
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN position SET NOT NULL,
  ADD CONSTRAINT progress_photo_labels_position_key UNIQUE (position),
  ADD CONSTRAINT progress_photo_labels_position_check CHECK (position >= 0);
