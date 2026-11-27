-- Store the photo reservation before its file exists in the private bucket.
INSERT INTO storage.buckets (
  id, cache_control, min_upload_file_size, max_upload_file_size, presigned_urls_enabled
) VALUES ('progress_photos', 'private, no-store', 1, 5242880, false);

-- Hasura enum tables allow only a text key and an optional text description.
CREATE TABLE public.progress_photo_labels (
  value text PRIMARY KEY CHECK (value ~ '^[a-z][a-z0-9_]*$'),
  comment text CHECK (btrim(comment) <> '')
);
INSERT INTO public.progress_photo_labels (value, comment)
VALUES ('front', 'Front'), ('back', 'Back');

CREATE TABLE public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Missing owners lose access immediately; the cleanup job removes their files.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label_value text NOT NULL REFERENCES public.progress_photo_labels(value) ON DELETE RESTRICT,
  taken_on date NOT NULL CHECK (taken_on BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Storage initialization attaches the file using the reservation UUID.
  file_id uuid UNIQUE REFERENCES storage.files(id) ON DELETE CASCADE,
  CONSTRAINT progress_photos_file_matches_reservation CHECK (file_id = id)
);
CREATE INDEX progress_photos_owner_history_idx
  ON public.progress_photos (user_id, taken_on DESC, created_at DESC, id DESC);
CREATE INDEX progress_photos_owner_label_history_idx
  ON public.progress_photos (user_id, label_value, taken_on DESC, created_at DESC, id DESC);
CREATE INDEX progress_photos_label_idx ON public.progress_photos (label_value);

CREATE TRIGGER set_public_progress_photos_updated_at
BEFORE UPDATE ON public.progress_photos
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
