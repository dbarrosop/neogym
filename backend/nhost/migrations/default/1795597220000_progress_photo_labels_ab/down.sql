INSERT INTO public.progress_photo_labels (value, comment)
VALUES ('front', 'Front'), ('back', 'Back');

-- Both variants collapse to the original label without deleting any photos.
UPDATE public.progress_photos
SET label_value = CASE
  WHEN label_value IN ('front_a', 'front_b') THEN 'front'
  ELSE 'back'
END
WHERE label_value IN ('front_a', 'front_b', 'back_a', 'back_b');

DELETE FROM public.progress_photo_labels
WHERE value IN ('front_a', 'front_b', 'back_a', 'back_b');
