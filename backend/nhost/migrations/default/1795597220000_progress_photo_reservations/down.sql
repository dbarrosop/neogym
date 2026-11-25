LOCK TABLE storage.files IN SHARE ROW EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.progress_photos WHERE file_id IS NULL OR user_id IS NULL) THEN
    RAISE EXCEPTION 'Clear upload reservations and deleted-account photos before rollback';
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

ALTER TABLE public.progress_photos
  DROP COLUMN file_id,
  DROP CONSTRAINT progress_photos_user_id_fkey,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN id DROP DEFAULT,
  ADD CONSTRAINT progress_photos_id_fkey FOREIGN KEY (id)
    REFERENCES storage.files(id) ON DELETE CASCADE,
  ADD CONSTRAINT progress_photos_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE FUNCTION public.check_progress_photo_file() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  uploaded_file storage.files%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'A progress photo cannot change its file or owner' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Serialize linkage with changes to the file, including Storage deletion.
  SELECT * INTO uploaded_file FROM storage.files WHERE id = NEW.id FOR SHARE;
  IF NOT FOUND
     OR uploaded_file.bucket_id IS DISTINCT FROM 'progress_photos'
     OR uploaded_file.uploaded_by_user_id IS DISTINCT FROM NEW.user_id
     OR uploaded_file.is_uploaded IS DISTINCT FROM true
     OR uploaded_file.name IS DISTINCT FROM 'progress-photo.jpg'
     OR uploaded_file.mime_type IS DISTINCT FROM 'image/jpeg'
     OR uploaded_file.size IS NULL OR uploaded_file.size NOT BETWEEN 1 AND 5242880
     OR (uploaded_file.metadata IS NOT NULL AND uploaded_file.metadata <> '{}'::jsonb)
     OR uploaded_file.created_at <= clock_timestamp() - interval '45 minutes' THEN
    RAISE EXCEPTION 'Progress photo requires a recent, completed JPEG upload by its owner'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_progress_photo_file
BEFORE INSERT OR UPDATE OF id, user_id ON public.progress_photos
FOR EACH ROW EXECUTE FUNCTION public.check_progress_photo_file();

CREATE TABLE public.progress_photo_file_ids (
  id uuid PRIMARY KEY,
  last_sweep_attempt_at timestamptz
);
INSERT INTO public.progress_photo_file_ids (id)
SELECT id FROM storage.files WHERE bucket_id = 'progress_photos'
UNION SELECT id FROM storage.files_to_delete;

CREATE FUNCTION public.reserve_progress_photo_file_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF NEW.bucket_id = 'progress_photos' THEN
    -- AFTER INSERT means a conflicting file row's concurrent deletion has
    -- settled, including its queue insert, before this check runs.
    IF EXISTS (SELECT 1 FROM storage.files_to_delete WHERE id = NEW.id) THEN
      RAISE EXCEPTION 'Storage file ID is pending cleanup' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.progress_photo_file_ids (id) VALUES (NEW.id);
  ELSIF EXISTS (SELECT 1 FROM public.progress_photo_file_ids WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Storage file ID is reserved' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER reserve_progress_photo_file_id
AFTER INSERT ON storage.files
FOR EACH ROW EXECUTE FUNCTION public.reserve_progress_photo_file_id();

CREATE FUNCTION public.keep_progress_photo_file_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF OLD.bucket_id = 'progress_photos' OR NEW.bucket_id = 'progress_photos' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.bucket_id IS DISTINCT FROM OLD.bucket_id
       OR NEW.uploaded_by_user_id IS DISTINCT FROM OLD.uploaded_by_user_id THEN
      RAISE EXCEPTION 'A progress file cannot change its ID, bucket, or uploader' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.id IS DISTINCT FROM OLD.id
      AND EXISTS (SELECT 1 FROM public.progress_photo_file_ids WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Storage file ID is reserved' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER keep_progress_photo_file_identity
BEFORE UPDATE OF id, bucket_id, uploaded_by_user_id ON storage.files
FOR EACH ROW EXECUTE FUNCTION public.keep_progress_photo_file_identity();

CREATE FUNCTION public.check_progress_photo_file_retirement() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  -- The existing link trigger takes a file lock first. Take it explicitly here
  -- too, so this check does not depend on trigger ordering for correctness.
  PERFORM 1 FROM storage.files WHERE id = NEW.id FOR SHARE;
  IF NOT EXISTS (
    SELECT 1 FROM public.progress_photo_file_ids
    WHERE id = NEW.id AND last_sweep_attempt_at IS NULL
  ) OR EXISTS (SELECT 1 FROM storage.files_to_delete WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Progress file is retired, missing its reservation, or pending cleanup'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER check_progress_photo_file_retirement
BEFORE INSERT ON public.progress_photos
FOR EACH ROW EXECUTE FUNCTION public.check_progress_photo_file_retirement();

CREATE FUNCTION public.claim_progress_photo_sweep() RETURNS SETOF public.progress_photo_file_ids
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  sweep_started_at timestamptz := clock_timestamp();
  cutoff timestamptz := sweep_started_at - interval '60 minutes';
  retry_before timestamptz := sweep_started_at - interval '10 minutes';
  candidate uuid;
BEGIN
  FOR candidate IN
    SELECT f.id
    FROM public.progress_photo_file_ids AS r
    JOIN storage.files AS f USING (id)
    WHERE f.bucket_id = 'progress_photos' AND f.created_at < cutoff
      AND (r.last_sweep_attempt_at IS NULL OR r.last_sweep_attempt_at < retry_before)
      AND NOT EXISTS (SELECT 1 FROM public.progress_photos AS p WHERE p.id = f.id)
    ORDER BY r.last_sweep_attempt_at ASC NULLS FIRST, f.created_at, f.id
    LIMIT 20
    FOR UPDATE OF f SKIP LOCKED
  LOOP
    -- A separate statement takes a fresh READ COMMITTED snapshot after the
    -- file lock. An attachment that committed while selection was in flight
    -- must not be handed out for deletion. Future attachments see the claim.
    RETURN QUERY
      UPDATE public.progress_photo_file_ids AS r
      SET last_sweep_attempt_at = clock_timestamp()
      WHERE r.id = candidate
        AND NOT EXISTS (SELECT 1 FROM public.progress_photos AS p WHERE p.id = r.id)
        AND (r.last_sweep_attempt_at IS NULL OR r.last_sweep_attempt_at < retry_before)
      RETURNING r.*;
  END LOOP;
END;
$$;
