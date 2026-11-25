-- First close uploads, keep cleanup running, and verify object removal through
-- the Storage backend. An empty metadata table alone does not prove that.
LOCK TABLE storage.files IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.files WHERE bucket_id = 'progress_photos') THEN
    RAISE EXCEPTION 'Purge progress photo files through Storage before rolling back';
  END IF;
END $$;

DROP TABLE public.progress_photos;
DROP FUNCTION public.check_progress_photo_file();
DROP TABLE public.progress_photo_labels;
DELETE FROM storage.buckets WHERE id = 'progress_photos';
