LOCK TABLE storage.files IN SHARE ROW EXCLUSIVE MODE;

DROP FUNCTION public.claim_progress_photo_sweep();
DROP TRIGGER check_progress_photo_file_retirement ON public.progress_photos;
DROP FUNCTION public.check_progress_photo_file_retirement();
DROP TRIGGER check_progress_photo_file ON public.progress_photos;
DROP FUNCTION public.check_progress_photo_file();
SET LOCAL ROLE postgres;
DROP TRIGGER reserve_progress_photo_file_id ON storage.files;
DROP TRIGGER keep_progress_photo_file_identity ON storage.files;
RESET ROLE;
DROP FUNCTION public.reserve_progress_photo_file_id();
DROP TABLE public.progress_photo_file_ids;

-- The photo row is the reservation. A file is optional until Storage initializes
-- it; a normal Storage delete still cascades to the photo. Keep missing-owner
-- rows for the account cleanup job rather than losing their file reference.
ALTER TABLE public.progress_photos
  DROP CONSTRAINT progress_photos_id_fkey,
  DROP CONSTRAINT progress_photos_user_id_fkey,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN user_id DROP NOT NULL,
  ADD CONSTRAINT progress_photos_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN file_id uuid UNIQUE REFERENCES storage.files(id) ON DELETE CASCADE,
  ADD CONSTRAINT progress_photos_file_matches_reservation CHECK (file_id = id);
UPDATE public.progress_photos SET file_id = id;

CREATE FUNCTION public.attach_progress_photo_upload() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.files_to_delete WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Progress photo ID is pending Storage cleanup' USING ERRCODE = '23514';
  END IF;
  -- This update serializes initialization against expiry and account deletion.
  -- If the reservation disappeared, was used, or has expired, roll back the
  -- Storage metadata insert before the service can write any bytes.
  UPDATE public.progress_photos AS p SET file_id = NEW.id
  WHERE p.id = NEW.id AND p.user_id = NEW.uploaded_by_user_id
    AND p.file_id IS NULL AND p.created_at > clock_timestamp() - interval '1 hour';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Progress photo upload requires a current unused reservation owned by the uploader'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER attach_progress_photo_upload
AFTER INSERT ON storage.files FOR EACH ROW WHEN (NEW.bucket_id = 'progress_photos')
EXECUTE FUNCTION public.attach_progress_photo_upload();

CREATE OR REPLACE FUNCTION public.keep_progress_photo_file_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.bucket_id IS DISTINCT FROM OLD.bucket_id
      OR NEW.uploaded_by_user_id IS DISTINCT FROM OLD.uploaded_by_user_id THEN
    RAISE EXCEPTION 'A progress file cannot change its ID, bucket, or uploader' USING ERRCODE = '23514';
  END IF;
  IF NEW.metadata IS NOT NULL AND NEW.metadata <> '{}'::jsonb THEN
    RAISE EXCEPTION 'A progress file cannot have custom Storage metadata' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER keep_progress_photo_file_identity
BEFORE UPDATE OF id, bucket_id, uploaded_by_user_id, metadata ON storage.files FOR EACH ROW
WHEN (OLD.bucket_id = 'progress_photos' OR NEW.bucket_id = 'progress_photos')
EXECUTE FUNCTION public.keep_progress_photo_file_identity();

CREATE FUNCTION public.delete_expired_progress_photo_reservations() RETURNS void
LANGUAGE sql SET search_path = pg_catalog, pg_temp AS $$
  -- Includes expired incomplete uploads and unlinked files from the old API.
  -- Storage's own DELETE trigger enqueues removal of the object bytes.
  DELETE FROM storage.files AS f
  WHERE f.bucket_id = 'progress_photos' AND f.created_at <= now() - interval '1 hour'
    AND (f.is_uploaded IS DISTINCT FROM true OR NOT EXISTS (
      SELECT 1 FROM public.progress_photos AS p WHERE p.file_id = f.id
    ));
  DELETE FROM public.progress_photos
  WHERE file_id IS NULL AND created_at <= now() - interval '1 hour';
$$;

CREATE FUNCTION public.delete_progress_photos_without_uploader() RETURNS void
LANGUAGE sql SET search_path = pg_catalog, pg_temp AS $$
  DELETE FROM storage.files AS f
  WHERE f.bucket_id = 'progress_photos' AND NOT EXISTS (
    SELECT 1 FROM auth.users AS u WHERE u.id = f.uploaded_by_user_id
  );
  DELETE FROM public.progress_photos WHERE user_id IS NULL AND file_id IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_expired_progress_photo_reservations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_progress_photos_without_uploader() FROM PUBLIC;

-- Nhost preloads pg_cron; use its documented extension installation role.
SET LOCAL ROLE postgres;
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('neogym-progress-photo-expiry', '*/15 * * * *',
  'SELECT public.delete_expired_progress_photo_reservations()');
SELECT cron.schedule('neogym-progress-photo-deleted-owners', '5,20,35,50 * * * *',
  'SELECT public.delete_progress_photos_without_uploader()');
RESET ROLE;
