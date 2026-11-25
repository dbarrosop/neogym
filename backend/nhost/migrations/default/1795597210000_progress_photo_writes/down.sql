-- Do not discard reservations while progress objects or queue work may remain.
-- First close uploads, drain/purge with Storage, and verify bytes independently.
LOCK TABLE storage.files IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.files WHERE bucket_id = 'progress_photos')
     OR EXISTS (SELECT 1 FROM storage.files_to_delete JOIN public.progress_photo_file_ids USING (id)) THEN
    RAISE EXCEPTION 'Purge progress files and drain their cleanup queue before dropping reservations';
  END IF;
END $$;

DROP FUNCTION public.claim_progress_photo_sweep();
DROP TRIGGER check_progress_photo_file_retirement ON public.progress_photos;
DROP FUNCTION public.check_progress_photo_file_retirement();
DROP TRIGGER keep_progress_photo_file_identity ON storage.files;
DROP FUNCTION public.keep_progress_photo_file_identity();
DROP TRIGGER reserve_progress_photo_file_id ON storage.files;
DROP FUNCTION public.reserve_progress_photo_file_id();
DROP TABLE public.progress_photo_file_ids;
