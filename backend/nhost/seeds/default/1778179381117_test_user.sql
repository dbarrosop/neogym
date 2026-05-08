SET transaction_timeout = 0;
SET check_function_bodies = false;

INSERT INTO auth.users (id, created_at, updated_at, last_seen, disabled, display_name, avatar_url, locale, email, phone_number, password_hash, email_verified, phone_number_verified, new_email, otp_method_last_used, otp_hash, otp_hash_expires_at, default_role, is_anonymous, totp_secret, active_mfa_type, ticket, ticket_expires_at, metadata, webauthn_current_challenge) VALUES ('f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', '2026-05-07 18:35:07.806506+00', '2026-05-07 18:35:14.414995+00', '2026-05-07 18:35:14.414995+00', false, 'Dutch', 'https://www.gravatar.com/avatar/40bb50b52f0b0a7e5e85370d5daacfac?d=blank&r=g', 'en', 'dutch@choppa.com', NULL, NULL, true, false, NULL, NULL, '$2a$06$C7LFVnXurMNxldxNf4hfmeqF3EfPovG6KJR21z86cy15VN5q.KFt.', '2026-05-07 18:35:07.806506+00', 'user', false, NULL, NULL, NULL, '2026-05-07 18:35:14.403068+00', 'null', NULL);

INSERT INTO auth.user_roles (id, created_at, user_id, role) VALUES ('c15df1d1-11c5-40a1-8219-3b511d64ed58', '2026-05-07 18:35:07.806506+00', 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', 'user');

INSERT INTO auth.user_roles (id, created_at, user_id, role) VALUES ('d9416642-5009-4ac9-bf89-4ccdf6937cf3', '2026-05-07 18:35:07.806506+00', 'f26ac88d-4dcd-48e8-a0ae-b4248918bc1c', 'me');
