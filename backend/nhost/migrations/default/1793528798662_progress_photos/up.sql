-- Private, immutable image objects. Do not change the exercise_images bucket.
-- No ON CONFLICT: an unexpected existing bucket must be inspected, not adopted.
INSERT INTO storage.buckets (
  id, cache_control, download_expiration, max_upload_file_size,
  min_upload_file_size, presigned_urls_enabled
) VALUES ('progress_photos', 'private, no-store', 30, 5242880, 1, false);

-- A normal catalog, not a Hasura enum: clients read names/order/retirement live.
CREATE TABLE public.progress_photo_labels (
  id          text PRIMARY KEY,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  position    integer NOT NULL CHECK (position >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.progress_photo_labels (id, name, position) VALUES
  ('front_1', 'Front 1', 0), ('front_2', 'Front 2', 1),
  ('back_1', 'Back 1', 2), ('back_2', 'Back 2', 3);

CREATE FUNCTION public.guard_progress_photo_label_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'progress_photo_labels_identity_check';
  END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_public_progress_photo_label_identity
BEFORE UPDATE ON public.progress_photo_labels
FOR EACH ROW EXECUTE FUNCTION public.guard_progress_photo_label_identity();

CREATE TABLE public.progress_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_on    date NOT NULL,
  label_id    text NOT NULL REFERENCES public.progress_photo_labels(id) ON DELETE RESTRICT,
  file_id     uuid NOT NULL REFERENCES storage.files(id) ON DELETE CASCADE,
  revision    integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progress_photos_user_date_label_key UNIQUE (user_id, taken_on, label_id),
  CONSTRAINT progress_photos_file_key UNIQUE (file_id),
  CONSTRAINT progress_photos_taken_on_check
    CHECK (isfinite(taken_on) AND taken_on BETWEEN DATE '0001-01-01' AND DATE '9999-12-31')
);
CREATE INDEX progress_photos_gallery_idx
  ON public.progress_photos (user_id, taken_on DESC, label_id, id);

-- Guards live ONLY on the domain table. The ordinary FK serializes attachment
-- against metadata deletion; no Storage-managed row has a custom trigger/lock.
CREATE FUNCTION public.guard_progress_photo()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  label_active boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'progress_photos_identity_check';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := 1;
  END IF;
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' OR NEW.label_id IS DISTINCT FROM OLD.label_id THEN
    -- Serialize assignment with catalog retirement (not with file deletion).
    SELECT is_active INTO label_active FROM public.progress_photo_labels
      WHERE id = NEW.label_id FOR SHARE;
    IF label_active = false THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'progress_photos_active_label_check';
    END IF;
    -- An unknown label is rejected by the FK, not silently accepted.
  END IF;

  IF TG_OP = 'INSERT' OR NEW.file_id IS DISTINCT FROM OLD.file_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM storage.files f
      WHERE f.id = NEW.file_id AND f.bucket_id = 'progress_photos'
        AND f.uploaded_by_user_id = NEW.user_id AND f.is_uploaded = true
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'progress_photos_file_check';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_public_progress_photo
BEFORE INSERT OR UPDATE ON public.progress_photos
FOR EACH ROW EXECUTE FUNCTION public.guard_progress_photo();

COMMENT ON TABLE public.progress_photos IS
  'Private dated images. Delete through Storage REST; file metadata deletion cascades this row. SQL does not guarantee S3 byte erasure.';
COMMENT ON TABLE public.progress_photo_labels IS
  'Admin-managed, stable IDs. Retire labels instead of deleting/reusing IDs. Retired labels remain readable and retainable.';
