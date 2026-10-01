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

-- Tenant users may discover only organizations where their Auth UID is linked
-- to an active tenant operator. Platform superusers continue to use the full
-- organizations registry query.
CREATE OR REPLACE FUNCTION public.my_tenant_organizations()
RETURNS SETOF public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_org public.organizations%ROWTYPE;
    v_is_member BOOLEAN;
BEGIN
    IF v_auth_uid IS NULL OR public.is_platform_superuser() THEN
        RETURN;
    END IF;

    FOR v_org IN
        SELECT * FROM public.organizations
        WHERE status = 'active'
          AND schema_name ~ '^org_[a-z0-9_]+$'
    LOOP
        EXECUTE format(
            'SELECT EXISTS (SELECT 1 FROM %I.users WHERE auth_uid = $1 AND status = ''Active'')',
            v_org.schema_name
        ) USING v_auth_uid INTO v_is_member;
        IF v_is_member THEN
            RETURN NEXT v_org;
        END IF;
    END LOOP;
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.my_tenant_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_tenant_organizations() TO authenticated;

-- ============================================================
-- RLS on platform tables
-- Only platform superusers can read/write organizations.
-- ============================================================
ALTER TABLE public.organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_superusers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs: superuser can read all" ON public.organizations;
DROP POLICY IF EXISTS "orgs: superuser can insert" ON public.organizations;
DROP POLICY IF EXISTS "orgs: superuser can update" ON public.organizations;
DROP POLICY IF EXISTS "platform_superusers: superuser can read" ON public.platform_superusers;

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
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
    PERFORM public.apply_org_security(v_schema);

    RAISE NOTICE 'Schema % provisioned for org %', v_schema, p_org_id;
END;
$$;

-- ============================================================
-- TENANT SECURITY + API EXPOSURE
-- Access is restricted to linked active users and role permissions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_org_security(p_schema TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT := p_schema;
    v_existing_schemas TEXT[];
    v_exposed_schemas TEXT;
    v_setting TEXT;
    v_table TEXT;
BEGIN
    IF v_schema IS NULL OR v_schema !~ '^org_[a-z0-9_]+$' THEN
        RAISE EXCEPTION 'Invalid tenant schema name.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE schema_name = v_schema) THEN
        RAISE EXCEPTION 'Tenant schema % is not registered to an organization.', v_schema;
    END IF;

    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC, anon', v_schema);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated, service_role', v_schema);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC, anon', v_schema);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO authenticated', v_schema);
    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role', v_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC, anon', v_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT SELECT, INSERT, UPDATE ON TABLES TO authenticated', v_schema);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT ALL ON TABLES TO service_role', v_schema);

    EXECUTE format($ddl$
        CREATE OR REPLACE FUNCTION %1$I.org_is_member()
        RETURNS BOOLEAN
        LANGUAGE SQL
        SECURITY DEFINER
        STABLE
        SET search_path = %1$I, pg_temp
        AS $fn$
            SELECT EXISTS (
                SELECT 1 FROM %1$I.users
                WHERE auth_uid = auth.uid() AND status = 'Active'
            );
        $fn$
    $ddl$, v_schema);

    EXECUTE format($ddl$
        CREATE OR REPLACE FUNCTION %1$I.org_has_permission(p_permission TEXT)
        RETURNS BOOLEAN
        LANGUAGE SQL
        SECURITY DEFINER
        STABLE
        SET search_path = %1$I, pg_temp
        AS $fn$
            SELECT EXISTS (
                SELECT 1
                FROM %1$I.users AS u
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(u.roles, '[]'::JSONB)) AS assigned(role_id)
                JOIN %1$I.roles AS r ON r.id = assigned.role_id
                WHERE u.auth_uid = auth.uid()
                  AND u.status = 'Active'
                  AND r.permissions @> jsonb_build_array(p_permission)
            );
        $fn$
    $ddl$, v_schema);

    EXECUTE format($ddl$
        CREATE OR REPLACE FUNCTION %1$I.org_can_access_branch(p_branch_id TEXT)
        RETURNS BOOLEAN
        LANGUAGE SQL
        SECURITY DEFINER
        STABLE
        SET search_path = %1$I, pg_temp
        AS $fn$
            SELECT %1$I.org_is_member() AND (
                %1$I.org_has_permission('READ_ALL_MODULES')
                OR EXISTS (
                    SELECT 1 FROM %1$I.users
                    WHERE auth_uid = auth.uid()
                      AND status = 'Active'
                      AND "branchId" = p_branch_id
                )
            );
        $fn$
    $ddl$, v_schema);

    EXECUTE format($ddl$
        CREATE OR REPLACE FUNCTION %1$I.org_current_user_id()
        RETURNS TEXT
        LANGUAGE SQL
        SECURITY DEFINER
        STABLE
        SET search_path = %1$I, pg_temp
        AS $fn$
            SELECT id FROM %1$I.users
            WHERE auth_uid = auth.uid() AND status = 'Active'
            LIMIT 1;
        $fn$
    $ddl$, v_schema);

    EXECUTE format('REVOKE ALL ON FUNCTION %I.org_is_member() FROM PUBLIC, anon', v_schema);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.org_has_permission(TEXT) FROM PUBLIC, anon', v_schema);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.org_can_access_branch(TEXT) FROM PUBLIC, anon', v_schema);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.org_current_user_id() FROM PUBLIC, anon', v_schema);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.org_is_member() TO authenticated, service_role', v_schema);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.org_has_permission(TEXT) TO authenticated, service_role', v_schema);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.org_can_access_branch(TEXT) TO authenticated, service_role', v_schema);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.org_current_user_id() TO authenticated, service_role', v_schema);

    FOREACH v_table IN ARRAY ARRAY['roles', 'users', 'branches', 'members', 'general_ledger', 'transactions', 'audit_trail'] LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_schema, v_table);
    END LOOP;

    EXECUTE format('DROP POLICY IF EXISTS tenant_roles_select ON %I.roles', v_schema);
    EXECUTE format('CREATE POLICY tenant_roles_select ON %I.roles FOR SELECT TO authenticated USING (%I.org_is_member())', v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_roles_manage ON %I.roles', v_schema);
    EXECUTE format('CREATE POLICY tenant_roles_manage ON %I.roles FOR ALL TO authenticated USING (%I.org_has_permission(''MANAGE_USERS'')) WITH CHECK (%I.org_has_permission(''MANAGE_USERS''))', v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS tenant_users_select ON %I.users', v_schema);
    EXECUTE format('CREATE POLICY tenant_users_select ON %I.users FOR SELECT TO authenticated USING (auth_uid = auth.uid() OR %I.org_has_permission(''MANAGE_USERS''))', v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_users_insert ON %I.users', v_schema);
    EXECUTE format('CREATE POLICY tenant_users_insert ON %I.users FOR INSERT TO authenticated WITH CHECK (%I.org_has_permission(''MANAGE_USERS''))', v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_users_update ON %I.users', v_schema);
    EXECUTE format('CREATE POLICY tenant_users_update ON %I.users FOR UPDATE TO authenticated USING (%I.org_has_permission(''MANAGE_USERS'')) WITH CHECK (%I.org_has_permission(''MANAGE_USERS''))', v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS tenant_branches_select ON %I.branches', v_schema);
    EXECUTE format('CREATE POLICY tenant_branches_select ON %I.branches FOR SELECT TO authenticated USING (%I.org_can_access_branch(id))', v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_branches_insert ON %I.branches', v_schema);
    EXECUTE format('CREATE POLICY tenant_branches_insert ON %I.branches FOR INSERT TO authenticated WITH CHECK (%I.org_has_permission(''MANAGE_USERS''))', v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_branches_update ON %I.branches', v_schema);
    EXECUTE format('CREATE POLICY tenant_branches_update ON %I.branches FOR UPDATE TO authenticated USING (%I.org_has_permission(''MANAGE_USERS'') OR (%I.org_can_access_branch(id) AND %I.org_has_permission(''VAULT_RECONCILE''))) WITH CHECK (%I.org_has_permission(''MANAGE_USERS'') OR (%I.org_can_access_branch(id) AND %I.org_has_permission(''VAULT_RECONCILE'')))', v_schema, v_schema, v_schema, v_schema, v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS tenant_members_select ON %I.members', v_schema);
    EXECUTE format('CREATE POLICY tenant_members_select ON %I.members FOR SELECT TO authenticated USING (%I.org_can_access_branch("branchId"))', v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_members_insert ON %I.members', v_schema);
    EXECUTE format('CREATE POLICY tenant_members_insert ON %I.members FOR INSERT TO authenticated WITH CHECK (%I.org_can_access_branch("branchId") AND (%I.org_has_permission(''MANAGE_USERS'') OR %I.org_has_permission(''APPROVE_BRANCH_LOAN_TIER1'')))', v_schema, v_schema, v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_members_update ON %I.members', v_schema);
    EXECUTE format('CREATE POLICY tenant_members_update ON %I.members FOR UPDATE TO authenticated USING (%I.org_can_access_branch("branchId") AND (%I.org_has_permission(''MANAGE_USERS'') OR %I.org_has_permission(''APPROVE_BRANCH_LOAN_TIER1''))) WITH CHECK (%I.org_can_access_branch("branchId") AND (%I.org_has_permission(''MANAGE_USERS'') OR %I.org_has_permission(''APPROVE_BRANCH_LOAN_TIER1'')))', v_schema, v_schema, v_schema, v_schema, v_schema, v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS tenant_gl_select ON %I.general_ledger', v_schema);
    EXECUTE format('CREATE POLICY tenant_gl_select ON %I.general_ledger FOR SELECT TO authenticated USING (%I.org_has_permission(''READ_ALL_MODULES'') OR %I.org_has_permission(''MODIFY_GL_JOURNAL'') OR %I.org_has_permission(''REPORTS_ACCESS''))', v_schema, v_schema, v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_gl_insert ON %I.general_ledger', v_schema);
    EXECUTE format('CREATE POLICY tenant_gl_insert ON %I.general_ledger FOR INSERT TO authenticated WITH CHECK (%I.org_has_permission(''MODIFY_GL_JOURNAL''))', v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_gl_update ON %I.general_ledger', v_schema);
    EXECUTE format('CREATE POLICY tenant_gl_update ON %I.general_ledger FOR UPDATE TO authenticated USING (%I.org_has_permission(''MODIFY_GL_JOURNAL'')) WITH CHECK (%I.org_has_permission(''MODIFY_GL_JOURNAL''))', v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS tenant_transactions_select ON %I.transactions', v_schema);
    EXECUTE format('CREATE POLICY tenant_transactions_select ON %I.transactions FOR SELECT TO authenticated USING (%I.org_can_access_branch("branchId"))', v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_transactions_insert ON %I.transactions', v_schema);
    EXECUTE format('CREATE POLICY tenant_transactions_insert ON %I.transactions FOR INSERT TO authenticated WITH CHECK (%I.org_can_access_branch("branchId") AND (%I.org_has_permission(''POST_COUNTER_TX'') OR %I.org_has_permission(''ORIGINATE_LOAN_APP'') OR %I.org_has_permission(''MODIFY_GL_JOURNAL'')))', v_schema, v_schema, v_schema, v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_transactions_update ON %I.transactions', v_schema);
    EXECUTE format('CREATE POLICY tenant_transactions_update ON %I.transactions FOR UPDATE TO authenticated USING (%I.org_can_access_branch("branchId") AND (%I.org_has_permission(''APPROVE_CREDIT_FACILITY'') OR %I.org_has_permission(''APPROVE_BRANCH_LOAN_TIER1'') OR %I.org_has_permission(''MODIFY_GL_JOURNAL''))) WITH CHECK (%I.org_can_access_branch("branchId") AND (%I.org_has_permission(''APPROVE_CREDIT_FACILITY'') OR %I.org_has_permission(''APPROVE_BRANCH_LOAN_TIER1'') OR %I.org_has_permission(''MODIFY_GL_JOURNAL'')))', v_schema, v_schema, v_schema, v_schema, v_schema, v_schema, v_schema, v_schema, v_schema);

    EXECUTE format('DROP POLICY IF EXISTS tenant_audit_select ON %I.audit_trail', v_schema);
    EXECUTE format('CREATE POLICY tenant_audit_select ON %I.audit_trail FOR SELECT TO authenticated USING (%I.org_has_permission(''VIEW_AUDIT_LOGS'') OR %I.org_has_permission(''READ_ALL_MODULES''))', v_schema, v_schema, v_schema);
    EXECUTE format('DROP POLICY IF EXISTS tenant_audit_insert ON %I.audit_trail', v_schema);
    EXECUTE format('CREATE POLICY tenant_audit_insert ON %I.audit_trail FOR INSERT TO authenticated WITH CHECK ("userId" = %I.org_current_user_id())', v_schema, v_schema);

    SELECT COALESCE(array_agg(DISTINCT btrim(split_part(setting, '=', 2))), ARRAY[]::TEXT[])
    INTO v_existing_schemas
    FROM pg_db_role_setting AS s
    CROSS JOIN LATERAL unnest(s.setconfig) AS config(setting)
    WHERE s.setrole = (SELECT oid FROM pg_roles WHERE rolname = 'authenticator')
      AND s.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
      AND setting LIKE 'pgrst.db_schemas=%';

    SELECT string_agg(schema_name, ', ' ORDER BY schema_name)
    INTO v_exposed_schemas
    FROM (
        SELECT DISTINCT schema_name
        FROM unnest(v_existing_schemas || ARRAY['public', 'graphql_public', v_schema]) AS configured(schema_name)
        WHERE schema_name ~ '^[a-z_][a-z0-9_]*$'
    ) AS schemas;

    EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', v_exposed_schemas);
    NOTIFY pgrst, 'reload config';
    NOTIFY pgrst, 'reload schema';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_org_security(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_org_security(TEXT) TO service_role;

-- Add RLS to already provisioned tenant schemas as well as future ones.
DO $$
DECLARE
    v_existing_schema TEXT;
BEGIN
    FOR v_existing_schema IN
        SELECT schema_name FROM public.organizations WHERE schema_name IS NOT NULL
    LOOP
        PERFORM public.apply_org_security(v_existing_schema);
    END LOOP;
END;
$$;

-- ============================================================
-- ATOMIC ORGANISATION PROVISIONER
-- Creates the registry row, schema, and initial tenant config in one RPC.
-- ============================================================
CREATE OR REPLACE FUNCTION public.provision_org(
    p_org_id TEXT,
    p_org_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT := 'org_' || regexp_replace(lower(p_org_id), '[^a-z0-9_]', '_', 'g');
    v_actor UUID := auth.uid();
BEGIN
    IF NOT public.is_platform_superuser() THEN
        RAISE EXCEPTION 'Access denied: platform superuser required';
    END IF;
    IF p_org_id IS NULL OR p_org_id !~ '^[a-z0-9_]+$' OR length(p_org_id) > 50 THEN
        RAISE EXCEPTION 'Organization ID must contain only lowercase letters, numbers, and underscores (max 50 characters).';
    END IF;
    IF COALESCE(p_org_data->>'name', '') = '' OR COALESCE(p_org_data->>'superuserEmail', '') = '' THEN
        RAISE EXCEPTION 'Organization legal name and superuser email are required.';
    END IF;
    IF jsonb_array_length(COALESCE(p_org_data->'branches', '[]'::JSONB)) = 0 THEN
        RAISE EXCEPTION 'At least one branch is required to provision an organization.';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(COALESCE(p_org_data->'staffUsers', '[]'::JSONB)) AS staff(email TEXT)
        WHERE lower(staff.email) = lower(p_org_data->>'superuserEmail')
    ) OR EXISTS (
        SELECT lower(staff.email)
        FROM jsonb_to_recordset(COALESCE(p_org_data->'staffUsers', '[]'::JSONB)) AS staff(email TEXT)
        GROUP BY lower(staff.email)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Owner and staff invitation emails must be unique.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
        RAISE EXCEPTION 'Organization ID % already exists.', p_org_id;
    END IF;

    INSERT INTO public.organizations (
        id, name, type, reg_number, country, base_currency, financial_year,
        regulatory_body, min_liquidity_ratio, superuser_email, status, created_by
    ) VALUES (
        p_org_id,
        p_org_data->>'name',
        COALESCE(p_org_data->>'type', 'SACCO'),
        p_org_data->>'regNumber',
        COALESCE(p_org_data->>'country', 'UG'),
        COALESCE(p_org_data->>'baseCurrency', 'UGX'),
        COALESCE(p_org_data->>'financialYear', '2026'),
        COALESCE(p_org_data->>'regulatoryBody', ''),
        COALESCE((p_org_data->>'minLiquidityRatio')::NUMERIC, 15.0),
        p_org_data->>'superuserEmail',
        'pending_setup',
        v_actor
    );

    PERFORM public.provision_org_schema(p_org_id);

    EXECUTE format($sql$
        INSERT INTO %I.roles (id, name, category, permissions)
        SELECT item.id, item.name, item.category, COALESCE(item.permissions, '[]'::JSONB)
        FROM jsonb_to_recordset($1) AS item(
            id TEXT, name TEXT, category TEXT, permissions JSONB
        )
    $sql$, v_schema)
    USING COALESCE(p_org_data->'roles', '[]'::JSONB);

    EXECUTE format($sql$
        INSERT INTO %I.branches (
            id, name, code, "tellerCount", "vaultLimit", "tellerCashLimit", status
        )
        SELECT item.id, item.name, item.code,
               COALESCE(item."tellerCount", 0), COALESCE(item."vaultLimit", 0),
               COALESCE(item."tellerCashLimit", 0), COALESCE(item.status, 'Active')
        FROM jsonb_to_recordset($1) AS item(
            id TEXT, name TEXT, code TEXT, "tellerCount" INTEGER,
            "vaultLimit" NUMERIC, "tellerCashLimit" NUMERIC, status TEXT
        )
    $sql$, v_schema)
    USING COALESCE(p_org_data->'branches', '[]'::JSONB);

    EXECUTE format($sql$
        INSERT INTO %I.general_ledger (code, name, category, type, normal, balance, "isContra")
        SELECT item.code, item.name, item.category, item.type, item.normal,
               0, COALESCE(item."isContra", false)
        FROM jsonb_to_recordset($1) AS item(
            code TEXT, name TEXT, category TEXT, type TEXT, normal TEXT, "isContra" BOOLEAN
        )
    $sql$, v_schema)
    USING COALESCE(p_org_data->'glAccounts', '[]'::JSONB);

    EXECUTE format($sql$
        INSERT INTO %I.users (
            id, name, email, roles, "branchId", "branchName",
            "singleApprovalLimit", "dailyApprovalLimit", status, "mfaEnabled"
        )
        SELECT item.id, item.name, item.email, COALESCE(item.roles, '[]'::JSONB),
               item."branchId", item."branchName",
               COALESCE(item."singleApprovalLimit", 0),
               COALESCE(item."dailyApprovalLimit", 0), 'Active', true
        FROM jsonb_to_recordset($1) AS item(
            id TEXT, name TEXT, email TEXT, roles JSONB, "branchId" TEXT,
            "branchName" TEXT, "singleApprovalLimit" NUMERIC,
            "dailyApprovalLimit" NUMERIC
        )
    $sql$, v_schema)
    USING COALESCE(p_org_data->'staffUsers', '[]'::JSONB);

    EXECUTE format($sql$
        INSERT INTO %I.users (
            id, name, email, roles, "branchId", "branchName",
            "singleApprovalLimit", "dailyApprovalLimit", status, "mfaEnabled"
        ) VALUES (
            'USR-000', $1, $2, '["ROLE-ADMIN"]'::JSONB,
            $3, $4, 0, 0, 'Active', true
        )
    $sql$, v_schema)
    USING COALESCE(p_org_data->>'ownerName', p_org_data->>'name' || ' Administrator'),
          p_org_data->>'superuserEmail',
          p_org_data->'branches'->0->>'id',
          p_org_data->'branches'->0->>'name';

    UPDATE public.organizations
    SET status = 'active', activated_at = NOW()
    WHERE id = p_org_id;

    RETURN jsonb_build_object('org_id', p_org_id, 'schema_name', v_schema, 'status', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.provision_org(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_org(TEXT, JSONB) TO authenticated;

-- Link an invited Auth user to its pre-seeded tenant operator row.
CREATE OR REPLACE FUNCTION public.link_org_user_auth(
    p_org_id TEXT,
    p_email TEXT,
    p_auth_uid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT;
    v_updated INTEGER;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Service role required.';
    END IF;

    SELECT schema_name INTO v_schema
    FROM public.organizations
    WHERE id = p_org_id;
    IF v_schema IS NULL THEN
        RAISE EXCEPTION 'Organization % not found.', p_org_id;
    END IF;

    EXECUTE format(
        'UPDATE %I.users SET auth_uid = $1 WHERE lower(email) = lower($2)',
        v_schema
    ) USING p_auth_uid, p_email;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.link_org_user_auth(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_org_user_auth(TEXT, TEXT, UUID) TO service_role;

-- Correct an already-provisioned tenant owner's email after the new Auth
-- account has been invited or found. Service-role callers only.
CREATE OR REPLACE FUNCTION public.update_org_owner_email(
    p_org_id TEXT,
    p_expected_email TEXT,
    p_new_email TEXT,
    p_auth_uid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT;
    v_updated INTEGER;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Service role required.';
    END IF;
    IF p_new_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
        RAISE EXCEPTION 'A valid new owner email is required.';
    END IF;

    SELECT schema_name INTO v_schema
    FROM public.organizations
    WHERE id = p_org_id AND status = 'active'
      AND lower(superuser_email) = lower(p_expected_email)
    FOR UPDATE;
    IF v_schema IS NULL THEN
        RAISE EXCEPTION 'Organization not found, inactive, or owner email changed; refresh and retry.';
    END IF;

    EXECUTE format(
        'UPDATE %I.users SET email = $1, auth_uid = $2 WHERE id = ''USR-000'' AND lower(email) = lower($3) AND status = ''Active''',
        v_schema
    ) USING lower(p_new_email), p_auth_uid, p_expected_email;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
        RAISE EXCEPTION 'Active tenant owner row was not found for the expected email.';
    END IF;

    UPDATE public.organizations
    SET superuser_email = lower(p_new_email)
    WHERE id = p_org_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_org_owner_email(TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_org_owner_email(TEXT, TEXT, TEXT, UUID) TO service_role;

-- ============================================================
-- SEED PLATFORM SUPERUSER
-- Replace with your actual email before running.
-- ============================================================
-- Run seed_platform_superuser.sql separately.
