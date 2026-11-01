-- This guard MUST precede all destructive statements. A bucket with metadata
-- cannot safely be dropped: SQL cannot remove its S3 objects. Do not turn this
-- into CASCADE or an implicit cleanup. Untracked bytes may still require
-- separately approved, operator-only maintenance even when this guard passes.
DO $progress_photos_rollback_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.files WHERE bucket_id = 'progress_photos') THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'progress_photos_bucket_not_empty: refusing rollback';
  END IF;
END;
$progress_photos_rollback_guard$;


DROP TABLE public.progress_photos;
DROP FUNCTION public.guard_progress_photo();
DROP TABLE public.progress_photo_labels;
DROP FUNCTION public.guard_progress_photo_label_identity();
DELETE FROM storage.buckets WHERE id = 'progress_photos';
