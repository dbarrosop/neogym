LOCK TABLE storage.files IN SHARE ROW EXCLUSIVE MODE;

-- Do not stop cleanup while progress file metadata still exists. Check queued
-- and live object bytes separately before running the down migrations.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.files WHERE bucket_id = 'progress_photos') THEN
    RAISE EXCEPTION 'Purge progress photo files through Storage before stopping cleanup';
  END IF;
END $$;

-- Unschedule only this feature's jobs; keep the shared extension installed.
SET LOCAL ROLE postgres;
SELECT cron.unschedule('neogym-progress-photo-expiry');
SELECT cron.unschedule('neogym-progress-photo-deleted-owners');
DROP TRIGGER attach_progress_photo_upload ON storage.files;
DROP TRIGGER keep_progress_photo_file_identity ON storage.files;
RESET ROLE;
DROP FUNCTION public.delete_expired_progress_photo_reservations();
DROP FUNCTION public.delete_progress_photos_without_uploader();
DROP FUNCTION public.attach_progress_photo_upload();
DROP FUNCTION public.keep_progress_photo_file_identity();
