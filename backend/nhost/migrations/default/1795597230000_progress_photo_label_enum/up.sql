-- Preserve the keys referenced by existing photos; only change catalog metadata.
ALTER TABLE public.progress_photo_labels
  RENAME COLUMN name TO comment;

ALTER TABLE public.progress_photo_labels
  ALTER COLUMN comment DROP NOT NULL,
  DROP COLUMN position;
