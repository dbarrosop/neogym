INSERT INTO public.progress_photo_labels (value, comment)
VALUES
  ('front_a', 'Front A'),
  ('front_b', 'Front B'),
  ('back_a', 'Back A'),
  ('back_b', 'Back B');

-- Move existing photo reservations, including pending uploads, before removing
-- their old labels. File IDs, owners and dates are unchanged.
UPDATE public.progress_photos
SET label_value = label_value || '_a'
WHERE label_value IN ('front', 'back');

DELETE FROM public.progress_photo_labels WHERE value IN ('front', 'back');
