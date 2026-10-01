-- ============================================================
-- FINAGE OS PLATFORM — SEED PLATFORM SUPERUSER
-- Run this ONCE after platform_schema.sql is applied.
-- Creates the platform-level superuser who can onboard orgs.
--
-- Replace the values below with your actual superuser details.
-- ============================================================

DO $$
DECLARE
  v_auth_uid UUID;
  v_superuser_email TEXT := 'superuser@finage.io';   -- ← change this
  v_superuser_name  TEXT := 'Platform Superuser';     -- ← change this
  v_password        TEXT := 'super@admin2026';        -- ← change then rotate
BEGIN

  -- ──────────────────────────────────────────────────────────
  -- 1. Create auth.users entry (if not already present)
  -- ──────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_superuser_email) THEN
    v_auth_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_auth_uid,
      'authenticated',
      'authenticated',
      v_superuser_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      ('{"name":"' || v_superuser_name || '"}')::jsonb,
      NOW(), NOW(), '', ''
    );
    RAISE NOTICE 'Created auth user: % (%)', v_superuser_email, v_auth_uid;
  ELSE
    SELECT id INTO v_auth_uid FROM auth.users WHERE email = v_superuser_email;
    RAISE NOTICE 'Auth user already exists: % (%)', v_superuser_email, v_auth_uid;
  END IF;

  -- ──────────────────────────────────────────────────────────
  -- 2. Register as platform superuser
  -- ──────────────────────────────────────────────────────────
  INSERT INTO public.platform_superusers (id, name, email, is_active)
  VALUES (v_auth_uid, v_superuser_name, v_superuser_email, true)
  ON CONFLICT (id) DO UPDATE SET
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
