-- ============================================================
-- FINAGE OS — SEED ADMIN USER
-- Run this in the Supabase SQL Editor (separate from the main schema)
-- Creates: admin@finage.co.ug / admin123
-- ============================================================

-- Ensure pgcrypto is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_auth_uid  UUID;
  v_user_id   TEXT := 'USR-001';  -- existing System Admin slot in public.users
BEGIN

  -- ──────────────────────────────────────────────────────────
  -- STEP 1: Create the Supabase Auth account
  -- Skip if this email already exists in auth.users
  -- ──────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@finage.co.ug'
  ) THEN

    v_auth_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,     -- pre-confirm so no email link needed
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_auth_uid,
      'authenticated',
      'authenticated',
      'admin@finage.co.ug',
      crypt('admin123', gen_salt('bf')),  -- bcrypt hash
      NOW(),                              -- pre-confirmed
      '{"provider":"email","providers":["email"]}',
      '{}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    RAISE NOTICE 'Auth account created: admin@finage.co.ug (uid: %)', v_auth_uid;

  ELSE
    -- Already exists — grab the existing UUID
    SELECT id INTO v_auth_uid FROM auth.users WHERE email = 'admin@finage.co.ug';
    RAISE NOTICE 'Auth account already exists for admin@finage.co.ug (uid: %)', v_auth_uid;
  END IF;

  -- ──────────────────────────────────────────────────────────
  -- STEP 2: Upsert the system user record in public.users
  -- Updates the existing USR-001 slot OR inserts if missing
  -- ──────────────────────────────────────────────────────────
  INSERT INTO public.users (
    id,
    name,
    email,
    roles,
    "branchId",
    "branchName",
    "singleApprovalLimit",
    "dailyApprovalLimit",
    status,
    "mfaEnabled",
    "lastLogin",
    auth_uid
  ) VALUES (
    v_user_id,
    'System Administrator',
    'admin@finage.co.ug',
    '["ROLE-ADMIN"]'::jsonb,
    'br-01',
    'Head Office',
    10000000,
    50000000,
    'Active',
    true,
    NOW()::TEXT,
    v_auth_uid
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    auth_uid  = EXCLUDED.auth_uid,
    status    = 'Active',
    "lastLogin" = NOW()::TEXT;

  RAISE NOTICE 'public.users record upserted for USR-001 → admin@finage.co.ug';

  -- ──────────────────────────────────────────────────────────
  -- STEP 3: Also upsert the ROLE-ADMIN in public.roles
  -- (in case roles table is empty on a clean DB)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO public.roles (id, name, category, permissions)
  VALUES (
    'ROLE-ADMIN',
    'System Administrator',
    'board',
    '["READ_ALL_MODULES","MANAGE_USERS","REPORTS_ACCESS","POLICY_THRESHOLD_CONFIG","BOARD_ESCALATION_APPROVE","GOVERNANCE_OVERVIEW"]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'ROLE-ADMIN confirmed in public.roles';

END $$;

-- ──────────────────────────────────────────────────────────
-- VERIFY: Run these to confirm everything is wired correctly
-- ──────────────────────────────────────────────────────────
SELECT
  u.id,
  u.name,
  u.email,
  u.status,
  u.auth_uid,
  a.email AS auth_email,
  a.email_confirmed_at IS NOT NULL AS confirmed
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.auth_uid
WHERE u.email = 'admin@finage.co.ug';
