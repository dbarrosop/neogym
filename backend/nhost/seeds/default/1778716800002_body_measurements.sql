SET transaction_timeout = 0;
SET check_function_bodies = false;

-- Roughly weekly weigh-ins for the seeded test user across the same window
-- as the seeded workout sessions (2025-09 through 2026-05). Tells a "cut →
-- lean bulk" arc: starts heavier, drops to mid-15% bf by Feb, then slow
-- recomp through spring. A few entries are weight-only so the chart shows
-- gaps in the body-fat line.
INSERT INTO public.body_measurements (id, user_id, measured_on, weight_kg, body_fat_pct, notes) VALUES
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-09-04', 83.2, 22.0, 'First weigh-in. Starting the cut.'),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-09-11', 82.7, 21.6, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-09-18', 82.1, NULL, 'Forgot the calipers.'),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-09-25', 81.6, 21.0, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-10-02', 80.8, 20.4, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-10-09', 80.2, 20.0, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-10-16', 79.6, 19.6, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-10-23', 79.1, 19.2, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-10-30', 78.8, 18.9, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-11-06', 78.3, 18.6, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-11-13', 77.9, 18.2, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-11-20', 77.6, 17.9, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-11-27', 77.4, 17.8, 'Thanksgiving — water retention likely.'),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-12-04', 77.1, 17.5, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-12-11', 76.8, 17.2, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-12-18', 76.5, 16.9, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2025-12-25', 76.9, NULL, 'Christmas — skipped the calipers.'),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-01-02', 77.4, 17.4, 'Holiday bump. Back to plan.'),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-01-09', 76.7, 16.8, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-01-16', 76.3, 16.4, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-01-23', 75.9, 16.0, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-01-30', 75.6, 15.8, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-02-06', 75.3, 15.5, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-02-13', 75.5, 15.4, 'Starting lean bulk.'),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-02-20', 75.8, 15.4, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-02-27', 76.2, 15.2, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-03-06', 76.6, 15.1, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-03-13', 77.0, 15.0, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-03-20', 77.3, 14.9, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-03-27', 77.5, 14.7, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-04-03', 77.8, NULL, 'Calipers at the office, no reading.'),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-04-10', 78.0, 14.5, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-04-17', 78.2, 14.4, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-04-24', 78.4, 14.3, 'Travel week — sodium high.'),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-05-01', 78.5, 14.2, NULL),
  (gen_random_uuid(), 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-05-08', 78.4, 14.1, NULL)
ON CONFLICT (user_id, measured_on) DO NOTHING;
