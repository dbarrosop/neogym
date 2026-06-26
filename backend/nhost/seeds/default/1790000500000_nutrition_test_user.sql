INSERT INTO auth.users (id, display_name, email, email_verified, default_role, locale, disabled, is_anonymous, metadata)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Nutrition Other',
  'nutrition-other@example.test',
  true,
  'user',
  'en',
  false,
  false,
  'null'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.user_roles (id, user_id, role)
VALUES ('11111111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'user')
ON CONFLICT DO NOTHING;
