-- ============================================================
-- FINAGE OS PLATFORM — SEED PLATFORM SUPERUSER
-- Run this ONCE after platform_schema.sql is applied.
-- Registers an Auth user as the platform-level superuser.
-- Create the user first in Supabase Dashboard > Authentication > Users.
--
-- Replace the email and name below with the Auth user's details.
-- ============================================================

DO $$
DECLARE
  v_auth_uid UUID;
  v_superuser_email TEXT := 'superuser@finage.io';   -- ← change this
  v_superuser_name  TEXT := 'Platform Superuser';     -- ← change this
BEGIN

  SELECT id INTO v_auth_uid
  FROM auth.users
  WHERE lower(email) = lower(v_superuser_email)
  LIMIT 1;

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION
      'Auth user % not found. Create and confirm it in Supabase Dashboard > Authentication > Users first.',
      v_superuser_email;
  END IF;

  INSERT INTO public.platform_superusers (id, name, email, is_active)
  VALUES (v_auth_uid, v_superuser_name, v_superuser_email, true)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = true,
    email = EXCLUDED.email;

  RAISE NOTICE 'Platform superuser registered: %', v_superuser_email;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- VERIFICATION
-- ──────────────────────────────────────────────────────────
SELECT
  ps.email,
  ps.name,
  ps.is_active,
  au.email_confirmed_at IS NOT NULL AS auth_confirmed
FROM public.platform_superusers ps
JOIN auth.users au ON au.id = ps.id;
