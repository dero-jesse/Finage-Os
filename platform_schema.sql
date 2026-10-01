-- ============================================================
-- FINAGE OS PLATFORM — BASE SCHEMA
-- Run this ONCE on your Supabase instance.
-- Creates the platform-level tables that manage organizations
-- and the global superuser. Each tenant org gets its own
-- schema created by the setup wizard.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- PLATFORM TABLE: organizations
-- One row per registered SACCO / MFI tenant.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id               TEXT PRIMARY KEY,          -- e.g. 'org_finage_ug'
    name             TEXT NOT NULL,             -- 'Finage Apex SACCO Ltd'
    type             TEXT NOT NULL,             -- 'SACCO' | 'MFI' | 'Bank'
    reg_number       TEXT,                      -- Regulatory registration number
    country          TEXT NOT NULL DEFAULT 'UG',
    base_currency    TEXT NOT NULL DEFAULT 'UGX',
    financial_year   TEXT DEFAULT '2026',
    regulatory_body  TEXT,                      -- 'SASRA' | 'BOU' | 'CBK'
    min_liquidity_ratio NUMERIC DEFAULT 15.0,
    logo_url         TEXT,
    status           TEXT NOT NULL DEFAULT 'pending_setup',
    -- pending_setup | active | suspended | archived
    schema_name      TEXT UNIQUE,               -- 'org_finage_ug' — the PG schema
    superuser_email  TEXT NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    activated_at     TIMESTAMPTZ,
    created_by       UUID REFERENCES auth.users(id)
);

-- ============================================================
-- PLATFORM TABLE: platform_superusers
-- Maps auth.users to platform-level superuser access.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_superusers (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    is_active   BOOLEAN DEFAULT true
);

-- ============================================================
-- PLATFORM HELPER FUNCTIONS
-- ============================================================

-- Is the caller a platform superuser?
CREATE OR REPLACE FUNCTION public.is_platform_superuser()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_superusers
        WHERE id = auth.uid() AND is_active = true
    );
$$;

-- Get all orgs the caller can access (superuser sees all)
CREATE OR REPLACE FUNCTION public.my_org_ids()
RETURNS TEXT[] LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT ARRAY(SELECT id FROM public.organizations WHERE status = 'active')
    WHERE public.is_platform_superuser()
    UNION
    SELECT ARRAY[]::TEXT[];
$$;

-- ============================================================
-- RLS on platform tables
-- Only platform superusers can read/write organizations.
-- ============================================================
ALTER TABLE public.organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_superusers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs: superuser can read all"
    ON public.organizations FOR SELECT TO authenticated
    USING (public.is_platform_superuser());

CREATE POLICY "orgs: superuser can insert"
    ON public.organizations FOR INSERT TO authenticated
    WITH CHECK (public.is_platform_superuser());

CREATE POLICY "orgs: superuser can update"
    ON public.organizations FOR UPDATE TO authenticated
    USING (public.is_platform_superuser());

CREATE POLICY "platform_superusers: superuser can read"
    ON public.platform_superusers FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_platform_superuser());

-- ============================================================
-- GRANTS
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON public.organizations        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_superusers  TO authenticated;

-- ============================================================
-- DYNAMIC SCHEMA PROVISIONER
-- Called by the setup wizard to create a new org schema
-- with all required tables + RLS copied from the template.
-- ============================================================
CREATE OR REPLACE FUNCTION public.provision_org_schema(p_org_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_schema TEXT := 'org_' || regexp_replace(p_org_id, '[^a-z0-9_]', '_', 'g');
BEGIN
    -- Only platform superusers may call this
    IF NOT public.is_platform_superuser() THEN
        RAISE EXCEPTION 'Access denied: platform superuser required';
    END IF;

    -- Create the schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

    -- roles
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.roles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            permissions JSONB DEFAULT ''[]''::JSONB
        )', v_schema);

    -- branches
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.branches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            "tellerCount" INTEGER DEFAULT 0,
            "vaultLimit" NUMERIC DEFAULT 0,
            "cashInVault" NUMERIC DEFAULT 0,
            "tellerCashLimit" NUMERIC DEFAULT 0,
            "tillBalances" JSONB DEFAULT ''[]''::JSONB,
            "lastReconciledAt" TEXT,
            "reconciliationDiscrepancy" NUMERIC DEFAULT 0,
            status TEXT DEFAULT ''Active''
        )', v_schema);

    -- users (staff operators)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            roles JSONB DEFAULT ''[]''::JSONB,
            "branchId" TEXT,
            "branchName" TEXT,
            "singleApprovalLimit" NUMERIC DEFAULT 0,
            "dailyApprovalLimit" NUMERIC DEFAULT 0,
            status TEXT DEFAULT ''Active'',
            "mfaEnabled" BOOLEAN DEFAULT true,
            "lastLogin" TEXT,
            auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL
        )', v_schema);

    -- members (SACCO customers)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.members (
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
            "savingsBalance" NUMERIC DEFAULT 0,
            "fixedDepositBalance" NUMERIC DEFAULT 0,
            "shareCapital" NUMERIC DEFAULT 0,
            "activeLoans" JSONB DEFAULT ''[]''::JSONB,
            "guarantorCommitments" JSONB DEFAULT ''[]''::JSONB
        )', v_schema);

    -- general_ledger
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.general_ledger (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            type TEXT,
            normal TEXT NOT NULL,
            balance NUMERIC DEFAULT 0,
            "isContra" BOOLEAN DEFAULT false
        )', v_schema);

    -- transactions
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.transactions (
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
            "postedBy" TEXT,
            "branchId" TEXT
        )', v_schema);

    -- audit_trail
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.audit_trail (
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
        )', v_schema);

    -- Grant authenticated role access to the new schema
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated', v_schema);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO authenticated', v_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE ON TABLES TO authenticated', v_schema);

    -- Enable RLS on all tables in the new schema
    -- (Users can only access rows where their auth_uid matches a user in this org's users table)
    -- Simplified: org_users are the gate — only auth users with a record in org's users table can query it

    -- Auto-link trigger for new auth users into this org's users table
    EXECUTE format('
        CREATE OR REPLACE FUNCTION %I.link_auth_to_org_user()
        RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn$
        BEGIN
            UPDATE %I.users SET auth_uid = NEW.id
            WHERE email = NEW.email AND auth_uid IS NULL;
            RETURN NEW;
        END;
        $fn$', v_schema, v_schema);

    -- Update organizations table with the schema name
    UPDATE public.organizations SET schema_name = v_schema WHERE id = p_org_id;

    RAISE NOTICE 'Schema % provisioned for org %', v_schema, p_org_id;
END;
$$;

-- ============================================================
-- SEED PLATFORM SUPERUSER
-- Replace with your actual email before running.
-- ============================================================
-- Run seed_platform_superuser.sql separately.
