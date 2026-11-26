-- Private progress photos use Storage's file ID as the submission ID.
INSERT INTO storage.buckets (
  id, cache_control, min_upload_file_size, max_upload_file_size, presigned_urls_enabled
) VALUES ('progress_photos', 'private, no-store', 1, 5242880, false);

CREATE TABLE public.progress_photo_labels (
  value text PRIMARY KEY CHECK (value ~ '^[a-z][a-z0-9_]*$'),
  comment text CHECK (btrim(comment) <> '')
);
INSERT INTO public.progress_photo_labels (value, comment)
VALUES ('front', 'Front'), ('back', 'Back');

CREATE TABLE public.progress_photos (
  id uuid PRIMARY KEY REFERENCES storage.files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL REFERENCES public.progress_photo_labels(value) ON DELETE RESTRICT,
  taken_on date NOT NULL CHECK (taken_on BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX progress_photos_owner_history_idx
  ON public.progress_photos (user_id, taken_on DESC, created_at DESC, id DESC);
CREATE INDEX progress_photos_owner_label_history_idx
  ON public.progress_photos (user_id, label, taken_on DESC, created_at DESC, id DESC);
CREATE INDEX progress_photos_label_idx ON public.progress_photos (label);

CREATE TRIGGER set_public_progress_photos_updated_at
BEFORE UPDATE ON public.progress_photos
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

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
