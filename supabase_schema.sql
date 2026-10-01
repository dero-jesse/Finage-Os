-- ============================================================
-- FINAGE OS — SUPABASE POSTGRESQL SCHEMA
-- Production-Ready: RLS Enabled with Per-Role Policies
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE DEFINITIONS
-- ============================================================

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    permissions JSONB DEFAULT '[]'::JSONB
);

-- 2. Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    "tellerCount" INTEGER,
    "vaultLimit" NUMERIC DEFAULT 0.00,
    "cashInVault" NUMERIC DEFAULT 0.00,
    "tellerCashLimit" NUMERIC DEFAULT 0.00,
    "tillBalances" JSONB DEFAULT '[]'::JSONB,
    "lastReconciledAt" TEXT,
    "reconciliationDiscrepancy" NUMERIC DEFAULT 0.00,
    status TEXT DEFAULT 'Active'
);

-- 3. System Operators Table (staff only — customers go in members)
-- NOTE: The id column should eventually be a FK to auth.users.id (uuid).
--       For now we use TEXT to allow the legacy ID format (USR-XXX) during migration.
--       Run the migration below when switching to Supabase Auth UUIDs.
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    roles JSONB DEFAULT '[]'::JSONB,
    "branchId" TEXT,
    "branchName" TEXT,
    "singleApprovalLimit" NUMERIC DEFAULT 0.00,
    "dailyApprovalLimit" NUMERIC DEFAULT 0.00,
    status TEXT DEFAULT 'Active',
    "mfaEnabled" BOOLEAN DEFAULT true,
    "lastLogin" TEXT,
    -- auth_uid links to auth.users.id once you migrate to UUID PKs
    auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. Members Table (SACCO Customers / Borrowers)
CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "nationalId" TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    "joinDate" TEXT NOT NULL,
    "branchId" TEXT,
    "branchName" TEXT,
    "kycStatus" TEXT NOT NULL,
    occupation TEXT,
    employer TEXT,
    "riskSegment" TEXT,
    "relationshipScore" INTEGER DEFAULT 0,
    "savingsBalance" NUMERIC DEFAULT 0.00,
    "fixedDepositBalance" NUMERIC DEFAULT 0.00,
    "shareCapital" NUMERIC DEFAULT 0.00,
    "activeLoans" JSONB DEFAULT '[]'::JSONB,
    "guarantorCommitments" JSONB DEFAULT '[]'::JSONB
);

-- 5. General Ledger Table
CREATE TABLE IF NOT EXISTS public.general_ledger (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT,
    normal TEXT NOT NULL,
    balance NUMERIC DEFAULT 0.00,
    "isContra" BOOLEAN DEFAULT false
);

-- 6. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    date TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    channel TEXT NOT NULL,
    "memberId" TEXT,
    "memberName" TEXT,
    amount NUMERIC NOT NULL,
    details TEXT,
    approver TEXT,
    "approverRole" TEXT,
    "glDebit" TEXT,
    "glCredit" TEXT,
    "batchId" TEXT,
    "postedBy" TEXT,          -- userId of the teller/operator who posted
    "branchId" TEXT           -- branch context for the transaction
);

-- 7. Audit Trail Table
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    "userId" TEXT,
    "userName" TEXT,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    "entityId" TEXT,
    description TEXT,
    "ipAddress" TEXT,
    "glImpact" TEXT
);

-- ============================================================
-- REALTIME (for live multi-user UI updates)
-- ============================================================
-- Safely add tables to realtime publication (idempotent — skips if already a member)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'transactions', 'general_ledger', 'users', 'audit_trail', 'branches'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime publication', t;
    ELSE
      RAISE NOTICE 'Table % already in supabase_realtime, skipping', t;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- COLUMN MIGRATIONS (safe to run on existing tables)
-- ADD COLUMN IF NOT EXISTS is idempotent — skips if already present.
-- ============================================================

-- Add auth_uid link to auth.users (the key that enables RLS to work)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add postedBy / branchId context columns to transactions (used in RLS policies)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS "postedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- Add tellerCashLimit to branches if missing from the existing table
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS "tellerCashLimit" NUMERIC DEFAULT 0.00;

-- Add isContra and type to general_ledger if missing
ALTER TABLE public.general_ledger
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS "isContra" BOOLEAN DEFAULT false;

-- ============================================================
-- HELPER FUNCTION: Get the calling operator's system record
-- Returns the row from public.users that matches auth.uid()
-- Used inside RLS policies below.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_system_user()
RETURNS public.users
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT * FROM public.users WHERE auth_uid = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- HELPER FUNCTION: Check if the caller has a given permission
-- Usage: has_permission('POST_COUNTER_TX')
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.roles r ON r.id = ANY(ARRAY(SELECT jsonb_array_elements_text(u.roles)))
    WHERE u.auth_uid = auth.uid()
      AND u.status = 'Active'
      AND (
        r.permissions @> to_jsonb(perm)
        OR r.permissions @> '["READ_ALL_MODULES"]'::jsonb
      )
  );
$$;

-- ============================================================
-- HELPER FUNCTION: Get the caller's branch
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_branch_id()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT "branchId" FROM public.users WHERE auth_uid = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- ROW LEVEL SECURITY — Enable on all tables
-- ============================================================
ALTER TABLE public.roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: roles
-- All authenticated operators can read roles.
-- Only System Administrators (MANAGE_USERS permission) can modify.
-- ============================================================
CREATE POLICY "roles: authenticated can read"
    ON public.roles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "roles: admin can insert"
    ON public.roles FOR INSERT
    TO authenticated
    WITH CHECK (public.has_permission('MANAGE_USERS'));

CREATE POLICY "roles: admin can update"
    ON public.roles FOR UPDATE
    TO authenticated
    USING (public.has_permission('MANAGE_USERS'));

-- ============================================================
-- POLICIES: branches
-- All authenticated staff can read their own branch.
-- READ_ALL_MODULES (Admin/Auditor) can read all branches.
-- VAULT_RECONCILE (Branch Manager) can update their own branch.
-- ============================================================
CREATE POLICY "branches: read own branch"
    ON public.branches FOR SELECT
    TO authenticated
    USING (
        id = public.my_branch_id()
        OR public.has_permission('READ_ALL_MODULES')
        OR public.has_permission('REPORTS_ACCESS')
    );

CREATE POLICY "branches: branch mgr can update own branch"
    ON public.branches FOR UPDATE
    TO authenticated
    USING (
        id = public.my_branch_id()
        AND public.has_permission('VAULT_RECONCILE')
    );

CREATE POLICY "branches: admin can insert"
    ON public.branches FOR INSERT
    TO authenticated
    WITH CHECK (public.has_permission('MANAGE_USERS'));

-- ============================================================
-- POLICIES: users (system operators directory)
-- Operators can read their own record.
-- MANAGE_USERS (Admin) can read/write all records.
-- AUDIT_TELLER_ACTIVITY (Branch Manager) can read their branch's users.
-- ============================================================
CREATE POLICY "users: read own record"
    ON public.users FOR SELECT
    TO authenticated
    USING (
        auth_uid = auth.uid()
        OR public.has_permission('MANAGE_USERS')
        OR (
            public.has_permission('AUDIT_TELLER_ACTIVITY')
            AND "branchId" = public.my_branch_id()
        )
    );

CREATE POLICY "users: admin can insert"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (public.has_permission('MANAGE_USERS'));

CREATE POLICY "users: admin can update"
    ON public.users FOR UPDATE
    TO authenticated
    USING (public.has_permission('MANAGE_USERS'));

CREATE POLICY "users: operator can update own lastLogin"
    ON public.users FOR UPDATE
    TO authenticated
    USING (auth_uid = auth.uid());

-- ============================================================
-- POLICIES: members (SACCO customer register)
-- Tellers & FOSA can read members in their own branch.
-- Credit officers can read all members (for loan origination).
-- Admin/Auditor can read all.
-- Only FOSA / Admin can insert new members.
-- ============================================================
CREATE POLICY "members: read own branch"
    ON public.members FOR SELECT
    TO authenticated
    USING (
        public.has_permission('READ_ALL_MODULES')
        OR public.has_permission('REPORTS_ACCESS')
        OR public.has_permission('ORIGINATE_LOAN_APP')  -- Credit Maker
        OR public.has_permission('KYC_RISK_SCORING')     -- Credit Maker
        OR (
            (
                public.has_permission('VIEW_MEMBER_BALANCE')
                OR public.has_permission('POST_COUNTER_TX')
                OR public.has_permission('AUDIT_TELLER_ACTIVITY')
            )
            AND "branchId" = public.my_branch_id()
        )
    );

CREATE POLICY "members: fosa/admin can insert"
    ON public.members FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_permission('MANAGE_USERS')
        OR public.has_permission('TELLER_LIMIT_OVERRIDE')
        OR public.has_permission('APPROVE_BRANCH_LOAN_TIER1')
    );

CREATE POLICY "members: credit/fosa can update"
    ON public.members FOR UPDATE
    TO authenticated
    USING (
        public.has_permission('MANAGE_USERS')
        OR public.has_permission('KYC_RISK_SCORING')
        OR public.has_permission('TELLER_LIMIT_OVERRIDE')
    );

-- ============================================================
-- POLICIES: general_ledger
-- All authenticated can read (needed for ticker & reports).
-- Only Treasury (MODIFY_GL_JOURNAL) and Admin can write.
-- ============================================================
CREATE POLICY "gl: authenticated can read"
    ON public.general_ledger FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "gl: treasury/admin can update"
    ON public.general_ledger FOR UPDATE
    TO authenticated
    USING (
        public.has_permission('MODIFY_GL_JOURNAL')
        OR public.has_permission('MANAGE_USERS')
    );

CREATE POLICY "gl: admin can insert"
    ON public.general_ledger FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_permission('MODIFY_GL_JOURNAL')
        OR public.has_permission('MANAGE_USERS')
    );

-- ============================================================
-- POLICIES: transactions
-- Tellers can insert and read their own branch transactions.
-- FOSA can read all transactions in their branch.
-- Treasury/Admin/Auditor can read all.
-- No one can UPDATE or DELETE transactions (immutable ledger).
-- ============================================================
CREATE POLICY "transactions: teller can insert own branch"
    ON public.transactions FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            public.has_permission('POST_COUNTER_TX')
            AND "branchId" = public.my_branch_id()
        )
        OR public.has_permission('MANAGE_USERS')
        OR public.has_permission('MODIFY_GL_JOURNAL')
    );

CREATE POLICY "transactions: read own branch or all for oversight"
    ON public.transactions FOR SELECT
    TO authenticated
    USING (
        public.has_permission('READ_ALL_MODULES')
        OR public.has_permission('REPORTS_ACCESS')
        OR public.has_permission('MODIFY_GL_JOURNAL')
        OR (
            (
                public.has_permission('POST_COUNTER_TX')
                OR public.has_permission('AUDIT_TELLER_ACTIVITY')
                OR public.has_permission('VIEW_MEMBER_BALANCE')
            )
            AND "branchId" = public.my_branch_id()
        )
    );

-- Transactions are immutable — no UPDATE or DELETE allowed (audit integrity)
-- (No UPDATE/DELETE policies = denied by default when RLS is enabled)

-- ============================================================
-- POLICIES: audit_trail
-- Auditors and Admins can read all entries.
-- FOSA can read their branch entries.
-- Any authenticated operator can insert (system writes audit on actions).
-- Audit records are immutable (no update/delete).
-- ============================================================
CREATE POLICY "audit: insert (any authenticated operator)"
    ON public.audit_trail FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "audit: read own branch or all for oversight"
    ON public.audit_trail FOR SELECT
    TO authenticated
    USING (
        public.has_permission('READ_ALL_MODULES')
        OR public.has_permission('REPORTS_ACCESS')
        OR public.has_permission('VIEW_AUDIT_LOGS')
        OR (
            public.has_permission('AUDIT_TELLER_ACTIVITY')
            -- Note: audit_trail doesn't have branchId; filter by userId's branch in app
            AND "userId" IN (
                SELECT id FROM public.users WHERE "branchId" = public.my_branch_id()
            )
        )
    );

-- ============================================================
-- GRANTS: Allow the authenticated role to use these tables
-- (anon is intentionally NOT granted access in production)
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.roles        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.branches     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.members      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.general_ledger TO authenticated;
GRANT SELECT, INSERT         ON public.transactions TO authenticated;
GRANT SELECT, INSERT         ON public.audit_trail  TO authenticated;

-- ============================================================
-- MIGRATION NOTE:
-- When you are ready to tie auth_uid to public.users:
-- 1. Add all existing staff to Supabase Auth (via Dashboard > Auth > Users)
-- 2. Run: UPDATE public.users SET auth_uid = <auth.users.id> WHERE email = '<email>';
-- 3. Or use the trigger below to auto-link on new signups:
-- ============================================================

-- Auto-link trigger: when a new Auth user signs up, if their email
-- already exists in public.users, set auth_uid automatically.
CREATE OR REPLACE FUNCTION public.link_auth_user_to_system()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET auth_uid = NEW.id
  WHERE email = NEW.email AND auth_uid IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_auth_user_to_system();

-- ============================================================
-- VERIFICATION QUERIES (run after setup to confirm)
-- ============================================================
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT * FROM pg_policies WHERE schemaname = 'public';
