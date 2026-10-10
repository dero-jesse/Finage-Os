-- Additive tenant-authorized online operations beyond counter posting.
-- Apply after platform_schema.sql, online_data_migration.sql, and
-- online_financial_writes.sql. No browser-provided tenant snapshot is accepted.

DO $$
DECLARE
    tenant RECORD;
    table_name TEXT;
BEGIN
    FOR tenant IN
        SELECT schema_name
        FROM public.organizations
        WHERE status = 'active' AND schema_name ~ '^org_[a-z0-9_]+$'
    LOOP
        EXECUTE format($ddl$
            CREATE TABLE IF NOT EXISTS %1$I.loan_products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                annual_interest_rate NUMERIC NOT NULL CHECK (annual_interest_rate >= 0),
                repayment_method TEXT NOT NULL CHECK (repayment_method IN ('flat', 'reducing')),
                penalty_grace_days INTEGER NOT NULL DEFAULT 0 CHECK (penalty_grace_days >= 0),
                penalty_fixed_fee NUMERIC NOT NULL DEFAULT 0 CHECK (penalty_fixed_fee >= 0),
                penalty_daily_rate NUMERIC NOT NULL DEFAULT 0 CHECK (penalty_daily_rate >= 0),
                policy_version INTEGER NOT NULL DEFAULT 1,
                created_by TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS %1$I.loan_applications (
                id TEXT PRIMARY KEY,
                member_id TEXT NOT NULL,
                product_id TEXT NOT NULL REFERENCES %1$I.loan_products(id),
                amount NUMERIC NOT NULL CHECK (amount > 0),
                purpose TEXT NOT NULL,
                term_months INTEGER NOT NULL CHECK (term_months > 0),
                guarantor_member_id TEXT,
                urgency TEXT NOT NULL DEFAULT 'Medium',
                status TEXT NOT NULL DEFAULT 'Application Submitted',
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                maker_user_id TEXT NOT NULL,
                branch_id TEXT NOT NULL,
                annual_interest_rate NUMERIC NOT NULL,
                repayment_method TEXT NOT NULL,
                penalty_policy JSONB NOT NULL DEFAULT '{}'::JSONB,
                workflow_task_id TEXT NOT NULL,
                staggered_batch TEXT,
                disbursed_at TIMESTAMPTZ
            );
            CREATE TABLE IF NOT EXISTS %1$I.workflow_tasks (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                title TEXT NOT NULL,
                amount NUMERIC NOT NULL DEFAULT 0,
                maker_user_id TEXT NOT NULL,
                approver_role TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'Medium',
                history JSONB NOT NULL DEFAULT '[]'::JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS %1$I.external_facilities (
                id TEXT PRIMARY KEY,
                lender TEXT NOT NULL,
                facility_type TEXT NOT NULL,
                total_commitment NUMERIC NOT NULL CHECK (total_commitment > 0),
                drawn_amount NUMERIC NOT NULL DEFAULT 0 CHECK (drawn_amount >= 0),
                interest_rate NUMERIC NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
                first_repayment_date DATE,
                repayment_amount NUMERIC NOT NULL DEFAULT 0 CHECK (repayment_amount >= 0),
                expected_drawdown_date DATE,
                expected_drawdown_amount NUMERIC NOT NULL DEFAULT 0 CHECK (expected_drawdown_amount >= 0),
                created_by TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS %1$I.operating_expenses (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                monthly_amount NUMERIC NOT NULL CHECK (monthly_amount > 0),
                due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
                created_by TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS %1$I.branch_reconciliations (
                id TEXT PRIMARY KEY,
                branch_id TEXT NOT NULL,
                operator_id TEXT NOT NULL,
                recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                cash_in_vault NUMERIC NOT NULL CHECK (cash_in_vault >= 0),
                prior_cash_in_vault NUMERIC NOT NULL CHECK (prior_cash_in_vault >= 0),
                notes TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS %1$I.investment_positions (
                id TEXT PRIMARY KEY,
                institution TEXT NOT NULL,
                product TEXT NOT NULL,
                principal NUMERIC NOT NULL CHECK (principal > 0),
                annual_yield NUMERIC NOT NULL DEFAULT 0 CHECK (annual_yield >= 0),
                placed_at DATE NOT NULL DEFAULT CURRENT_DATE,
                maturity_date DATE NOT NULL,
                status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Matured', 'Redeemed')),
                created_by TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS %1$I.domain_action_idempotency (
                idempotency_key TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                actor_user_id TEXT NOT NULL,
                payload JSONB NOT NULL,
                result JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS loan_applications_branch_idx ON %1$I.loan_applications(branch_id, applied_at DESC);
            CREATE INDEX IF NOT EXISTS workflow_tasks_pending_idx ON %1$I.workflow_tasks(status, created_at DESC);
        $ddl$, tenant.schema_name);
        EXECUTE format('ALTER TABLE %I.loan_applications ADD COLUMN IF NOT EXISTS approved_by TEXT', tenant.schema_name);
        EXECUTE format('ALTER TABLE %I.loan_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ', tenant.schema_name);
        EXECUTE format('ALTER TABLE %I.loan_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT', tenant.schema_name);

        FOREACH table_name IN ARRAY ARRAY[
            'loan_products', 'loan_applications', 'workflow_tasks',
            'external_facilities', 'operating_expenses', 'branch_reconciliations',
            'investment_positions', 'domain_action_idempotency'
        ] LOOP
            EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', tenant.schema_name, table_name);
            EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON %I.%I FROM authenticated', tenant.schema_name, table_name);
        END LOOP;
        EXECUTE format('GRANT SELECT ON %I.loan_products, %I.loan_applications, %I.workflow_tasks, %I.external_facilities, %I.operating_expenses, %I.branch_reconciliations, %I.investment_positions TO authenticated',
            tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name,
            tenant.schema_name, tenant.schema_name, tenant.schema_name);
        EXECUTE format('REVOKE ALL ON %I.domain_action_idempotency FROM authenticated',tenant.schema_name);

        EXECUTE format('DROP POLICY IF EXISTS online_loan_products_read ON %I.loan_products', tenant.schema_name);
        EXECUTE format('CREATE POLICY online_loan_products_read ON %I.loan_products FOR SELECT TO authenticated USING (%I.org_has_permission(''ORIGINATE_LOAN_APP'') OR %I.org_has_permission(''APPROVE_CREDIT_FACILITY'') OR %I.org_has_permission(''READ_ALL_MODULES''))',
            tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name);
        EXECUTE format('DROP POLICY IF EXISTS online_loan_applications_read ON %I.loan_applications', tenant.schema_name);
        EXECUTE format('CREATE POLICY online_loan_applications_read ON %I.loan_applications FOR SELECT TO authenticated USING (%I.org_can_access_branch(branch_id) AND (%I.org_has_permission(''ORIGINATE_LOAN_APP'') OR %I.org_has_permission(''APPROVE_CREDIT_FACILITY'') OR maker_user_id = %I.org_current_user_id()))',
            tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name);
        EXECUTE format('DROP POLICY IF EXISTS online_workflow_tasks_read ON %I.workflow_tasks', tenant.schema_name);
        EXECUTE format('CREATE POLICY online_workflow_tasks_read ON %I.workflow_tasks FOR SELECT TO authenticated USING (%I.org_has_permission(''APPROVE_CREDIT_FACILITY'') OR %I.org_has_permission(''READ_ALL_MODULES'') OR maker_user_id = %I.org_current_user_id())',
            tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name);
        EXECUTE format('DROP POLICY IF EXISTS online_external_facilities_read ON %I.external_facilities', tenant.schema_name);
        EXECUTE format('CREATE POLICY online_external_facilities_read ON %I.external_facilities FOR SELECT TO authenticated USING (%I.org_has_permission(''EXECUTE_DFI_DRAWDOWN'') OR %I.org_has_permission(''REPORTS_ACCESS'') OR %I.org_has_permission(''READ_ALL_MODULES''))',
            tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name);
        EXECUTE format('DROP POLICY IF EXISTS online_operating_expenses_read ON %I.operating_expenses', tenant.schema_name);
        EXECUTE format('CREATE POLICY online_operating_expenses_read ON %I.operating_expenses FOR SELECT TO authenticated USING (%I.org_has_permission(''MODIFY_GL_JOURNAL'') OR %I.org_has_permission(''REPORTS_ACCESS'') OR %I.org_has_permission(''READ_ALL_MODULES''))',
            tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name);
        EXECUTE format('DROP POLICY IF EXISTS online_branch_reconciliations_read ON %I.branch_reconciliations', tenant.schema_name);
        EXECUTE format('CREATE POLICY online_branch_reconciliations_read ON %I.branch_reconciliations FOR SELECT TO authenticated USING (%I.org_can_access_branch(branch_id) AND (%I.org_has_permission(''VAULT_RECONCILE'') OR %I.org_has_permission(''READ_ALL_MODULES'')))',
            tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name);
        EXECUTE format('DROP POLICY IF EXISTS online_investment_positions_read ON %I.investment_positions', tenant.schema_name);
        EXECUTE format('CREATE POLICY online_investment_positions_read ON %I.investment_positions FOR SELECT TO authenticated USING (%I.org_has_permission(''PLACE_TBILLS'') OR %I.org_has_permission(''REPORTS_ACCESS'') OR %I.org_has_permission(''READ_ALL_MODULES''))',
            tenant.schema_name, tenant.schema_name, tenant.schema_name, tenant.schema_name);
        EXECUTE format($seed$
            INSERT INTO %1$I.general_ledger(code,name,category,type,normal,balance,"isContra")
            VALUES ('1300','Treasury Investments','Assets','Asset','Debit',0,false)
            ON CONFLICT (code) DO NOTHING
        $seed$, tenant.schema_name);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.online_write_capabilities(p_org_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT;
    v_user_id TEXT;
    v_result JSONB;
    v_extended_ready BOOLEAN;
BEGIN
    SELECT schema_name INTO v_schema
    FROM public.organizations
    WHERE id = p_org_id AND status = 'active'
      AND schema_name ~ '^org_[a-z0-9_]+$';
    IF v_schema IS NULL THEN RAISE EXCEPTION 'Active organization not found.'; END IF;
    EXECUTE format('SELECT %I.org_current_user_id()', v_schema) INTO v_user_id;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'An active organization user is required.'; END IF;
    v_extended_ready :=
        to_regclass(format('%I.loan_products',v_schema)) IS NOT NULL
        AND to_regclass(format('%I.loan_applications',v_schema)) IS NOT NULL
        AND to_regclass(format('%I.workflow_tasks',v_schema)) IS NOT NULL
        AND to_regclass(format('%I.external_facilities',v_schema)) IS NOT NULL
        AND to_regclass(format('%I.operating_expenses',v_schema)) IS NOT NULL
        AND to_regclass(format('%I.branch_reconciliations',v_schema)) IS NOT NULL
        AND to_regclass(format('%I.investment_positions',v_schema)) IS NOT NULL
        AND to_regclass(format('%I.domain_action_idempotency',v_schema)) IS NOT NULL;
    EXECUTE format($sql$
        SELECT jsonb_build_object(
            'member_create', %1$I.org_has_permission('MANAGE_USERS') OR %1$I.org_has_permission('APPROVE_BRANCH_LOAN_TIER1'),
            'counter_post', %1$I.org_has_permission('POST_COUNTER_TX'),
            'manual_journal', %1$I.org_has_permission('MODIFY_GL_JOURNAL'),
            'credit_application', %1$I.org_has_permission('ORIGINATE_LOAN_APP'),
            'credit_admin', %1$I.org_has_permission('APPROVE_CREDIT_FACILITY'),
            'credit_release', %1$I.org_has_permission('PACING_RELEASE_AUTHORIZE'),
            'treasury_drawdown', %1$I.org_has_permission('EXECUTE_DFI_DRAWDOWN'),
            'treasury_invest', %1$I.org_has_permission('PLACE_TBILLS'),
            'opex_manage', %1$I.org_has_permission('MODIFY_GL_JOURNAL'),
            'branch_reconcile', %1$I.org_has_permission('VAULT_RECONCILE'),
            'till_reconcile', %1$I.org_has_permission('MANAGE_ASSIGNED_TILL') OR %1$I.org_has_permission('VAULT_RECONCILE'),
            'portfolio_provision', %1$I.org_has_permission('APPROVE_CREDIT_FACILITY') OR %1$I.org_has_permission('MODIFY_GL_JOURNAL'),
            'user_manage', %1$I.org_has_permission('MANAGE_USERS')
        )
    $sql$, v_schema) INTO v_result;
    IF NOT v_extended_ready THEN
        v_result := v_result || jsonb_build_object(
            'credit_application',false,'credit_admin',false,'credit_release',false,
            'treasury_drawdown',false,'treasury_invest',false,'opex_manage',false,
            'branch_reconcile',false,'till_reconcile',false,'portfolio_provision',false,
            'user_manage',false
        );
    END IF;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_tenant_financial_action(
    p_org_id TEXT,
    p_action TEXT,
    p_amount NUMERIC,
    p_description TEXT,
    p_idempotency_key TEXT,
    p_member_id TEXT DEFAULT NULL,
    p_loan_id TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT;
    v_user_id TEXT;
    v_user_name TEXT;
    v_branch_id TEXT;
    v_can_credit BOOLEAN;
    v_can_release BOOLEAN;
    v_can_treasury BOOLEAN;
    v_can_invest BOOLEAN;
    v_can_journal BOOLEAN;
    v_tx_type TEXT;
    v_debit_code TEXT;
    v_credit_code TEXT;
    v_existing_reference TEXT;
    v_debit JSONB;
    v_credit JSONB;
    v_delta NUMERIC;
    v_tx JSONB;
    v_audit_id TEXT;
    v_key TEXT := NULLIF(BTRIM(p_idempotency_key), '');
BEGIN
    SELECT schema_name INTO v_schema FROM public.organizations
    WHERE id = p_org_id AND status = 'active' AND schema_name ~ '^org_[a-z0-9_]+$'
    FOR SHARE;
    IF v_schema IS NULL THEN RAISE EXCEPTION 'Active organization not found.'; END IF;
    EXECUTE format(
        'SELECT id, name, "branchId",
            %1$I.org_has_permission(''APPROVE_CREDIT_FACILITY''),
            %1$I.org_has_permission(''PACING_RELEASE_AUTHORIZE''),
            %1$I.org_has_permission(''EXECUTE_DFI_DRAWDOWN''),
            %1$I.org_has_permission(''PLACE_TBILLS''),
            %1$I.org_has_permission(''MODIFY_GL_JOURNAL'')
         FROM %1$I.users WHERE auth_uid = auth.uid() AND status = ''Active''',
        v_schema
    ) INTO v_user_id, v_user_name, v_branch_id, v_can_credit, v_can_release, v_can_treasury, v_can_invest, v_can_journal;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'An active organization user is required.'; END IF;
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 999999999999 THEN
        RAISE EXCEPTION 'A positive amount within the supported limit is required.';
    END IF;
    IF v_key IS NULL OR v_key !~ '^[A-Za-z0-9:_-]{8,100}$' THEN
        RAISE EXCEPTION 'A valid idempotency key is required.';
    END IF;

    CASE p_action
        WHEN 'loan_disbursement' THEN
            IF NOT (COALESCE(v_can_credit, false) OR COALESCE(v_can_release, false)) THEN
                RAISE EXCEPTION 'Credit disbursement permission is required.';
            END IF;
            v_tx_type := 'Loan Disbursement'; v_debit_code := '1200'; v_credit_code := '1020';
        WHEN 'dfi_drawdown' THEN
            IF NOT COALESCE(v_can_treasury, false) THEN RAISE EXCEPTION 'DFI drawdown permission is required.'; END IF;
            v_tx_type := 'DFI Facility Drawdown'; v_debit_code := '1020'; v_credit_code := '2200';
        WHEN 'loan_loss_provision' THEN
            IF NOT (COALESCE(v_can_credit, false) OR COALESCE(v_can_journal, false)) THEN
                RAISE EXCEPTION 'Portfolio provisioning permission is required.';
            END IF;
            v_tx_type := 'Loan Loss Provision'; v_debit_code := '5030'; v_credit_code := '1250';
        WHEN 'investment_placement' THEN
            IF NOT COALESCE(v_can_invest, false) THEN RAISE EXCEPTION 'Treasury investment permission is required.'; END IF;
            v_tx_type := 'Treasury Investment Placement'; v_debit_code := '1300'; v_credit_code := '1020';
        WHEN 'investment_redemption' THEN
            IF NOT COALESCE(v_can_invest, false) THEN RAISE EXCEPTION 'Treasury investment permission is required.'; END IF;
            v_tx_type := 'Treasury Investment Redemption'; v_debit_code := '1020'; v_credit_code := '1300';
        ELSE RAISE EXCEPTION 'This financial action is not enabled.';
    END CASE;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id || ':' || v_key, 0));
    EXECUTE format('SELECT to_jsonb(tx) FROM %I.transactions tx WHERE tx.id = $1', v_schema)
        INTO v_tx USING 'TX-' || v_key;
    IF v_tx IS NOT NULL THEN
        BEGIN
            v_existing_reference := (v_tx->>'details')::JSONB->>'referenceId';
        EXCEPTION WHEN OTHERS THEN
            v_existing_reference := '';
        END;
        IF v_tx->>'postedBy' IS DISTINCT FROM v_user_id
           OR v_tx->>'type' IS DISTINCT FROM v_tx_type
           OR (v_tx->>'amount')::NUMERIC IS DISTINCT FROM p_amount
           OR COALESCE(v_tx->>'memberId', '') IS DISTINCT FROM COALESCE(p_member_id, '')
           OR COALESCE(v_tx->>'loanId', '') IS DISTINCT FROM COALESCE(p_loan_id, '')
           OR COALESCE(v_tx->>'batchId', '') IS DISTINCT FROM v_key
           OR COALESCE(v_existing_reference,'') IS DISTINCT FROM COALESCE(p_reference_id, '') THEN
            RAISE EXCEPTION 'Idempotency key was already used for a different financial action.';
        END IF;
        RETURN v_tx;
    END IF;

    EXECUTE format('SELECT to_jsonb(gl) FROM %I.general_ledger gl WHERE code = $1 FOR UPDATE', v_schema)
        INTO v_debit USING v_debit_code;
    EXECUTE format('SELECT to_jsonb(gl) FROM %I.general_ledger gl WHERE code = $1 FOR UPDATE', v_schema)
        INTO v_credit USING v_credit_code;
    IF v_debit IS NULL OR v_credit IS NULL THEN RAISE EXCEPTION 'Required financial control accounts are not configured.'; END IF;
    IF v_debit->>'normal' = 'Debit' THEN v_delta := p_amount; ELSE v_delta := -p_amount; END IF;
    EXECUTE format('UPDATE %I.general_ledger SET balance = COALESCE(balance,0) + $1 WHERE code = $2', v_schema)
        USING v_delta, v_debit_code;
    IF v_credit->>'normal' = 'Credit' THEN v_delta := p_amount; ELSE v_delta := -p_amount; END IF;
    EXECUTE format('UPDATE %I.general_ledger SET balance = COALESCE(balance,0) + $1 WHERE code = $2', v_schema)
        USING v_delta, v_credit_code;

    EXECUTE format($sql$
        INSERT INTO %1$I.transactions AS inserted (
            id, date, type, status, channel, "memberId", "memberName", amount, details,
            "glDebit", "glCredit", "batchId", "postedBy", "branchId", "loanId"
        )
        VALUES (
            $1, NOW()::TEXT, $2, 'Completed', 'Treasury Online',
            $3, (SELECT name FROM %1$I.members WHERE id = $3), $4,
            jsonb_build_object('description', $5, 'referenceId', $6, 'action', $7)::TEXT,
            $8, $9, $10, $11, $12, $13
        )
        RETURNING to_jsonb(inserted)
    $sql$, v_schema)
    INTO v_tx
    USING 'TX-' || v_key, v_tx_type, p_member_id, p_amount, COALESCE(p_description, v_tx_type),
        p_reference_id, p_action, v_debit_code, v_credit_code, v_key, v_user_id, v_branch_id, p_loan_id;

    v_audit_id := 'AUD-' || extensions.uuid_generate_v4()::TEXT;
    EXECUTE format($sql$
        INSERT INTO %1$I.audit_trail
            (id, timestamp, "userId", "userName", action, module, "entityId", description, "ipAddress", "glImpact")
        VALUES ($1, NOW()::TEXT, $2, $3, UPPER(REGEXP_REPLACE($4, '\s+', '_', 'g')),
            'Online Finance', $5, $6, NULL, $7)
    $sql$, v_schema)
    USING v_audit_id, v_user_id, v_user_name, v_tx_type, v_tx->>'id',
        COALESCE(p_description, v_tx_type),
        'Dr ' || v_debit_code || ' ' || p_amount::TEXT || ' / Cr ' || v_credit_code || ' ' || p_amount::TEXT;
    RETURN v_tx || jsonb_build_object('auditId', v_audit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_tenant_domain_action(
    p_org_id TEXT,
    p_action TEXT,
    p_payload JSONB,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT;
    v_user_id TEXT;
    v_user_name TEXT;
    v_user_branch TEXT;
    v_single_limit NUMERIC;
    v_daily_limit NUMERIC;
    v_teller_id TEXT;
    v_can_originate BOOLEAN;
    v_can_credit BOOLEAN;
    v_can_treasury BOOLEAN;
    v_can_invest BOOLEAN;
    v_can_opex BOOLEAN;
    v_can_reconcile BOOLEAN;
    v_can_till BOOLEAN;
    v_can_users BOOLEAN;
    v_can_read_all BOOLEAN;
    v_can_release BOOLEAN;
    v_member JSONB;
    v_product JSONB;
    v_app JSONB;
    v_task JSONB;
    v_facility JSONB;
    v_position JSONB;
    v_branch JSONB;
    v_result JSONB;
    v_loan JSONB;
    v_schedule JSONB := '[]'::JSONB;
    v_history JSONB;
    v_policy JSONB;
    v_loan_item JSONB;
    v_actor_permissions JSONB;
    v_target_permissions JSONB;
    v_target_roles JSONB;
    v_roles_valid BOOLEAN;
    v_id TEXT;
    v_task_id TEXT;
    v_member_id TEXT;
    v_product_id TEXT;
    v_branch_id TEXT;
    v_target_id TEXT;
    v_amount NUMERIC;
    v_rate NUMERIC;
    v_monthly_rate NUMERIC;
    v_installment NUMERIC;
    v_balance NUMERIC;
    v_interest NUMERIC;
    v_principal NUMERIC;
    v_grace_days INTEGER;
    v_due_day INTEGER;
    v_till_count INTEGER;
    v_till_user_match BOOLEAN;
    v_till_id TEXT;
    v_existing_reference TEXT;
    v_existing_action TEXT;
    v_saved_action TEXT;
    v_saved_actor TEXT;
    v_saved_payload JSONB;
    v_saved_result JSONB;
    v_status TEXT;
    v_reason TEXT;
    v_batch TEXT;
    v_m INTEGER;
    v_audit_id TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_key TEXT := NULLIF(BTRIM(p_idempotency_key), '');
BEGIN
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'An operation payload is required.';
    END IF;
    IF v_key IS NULL OR v_key !~ '^[A-Za-z0-9:_-]{8,100}$' THEN
        RAISE EXCEPTION 'A valid idempotency key is required.';
    END IF;
    SELECT schema_name INTO v_schema FROM public.organizations
    WHERE id = p_org_id AND status = 'active' AND schema_name ~ '^org_[a-z0-9_]+$'
    FOR SHARE;
    IF v_schema IS NULL THEN RAISE EXCEPTION 'Active organization not found.'; END IF;
    EXECUTE format(
        'SELECT id, name, "branchId", "tellerId","singleApprovalLimit","dailyApprovalLimit",
            %1$I.org_has_permission(''ORIGINATE_LOAN_APP''),
            %1$I.org_has_permission(''APPROVE_CREDIT_FACILITY''),
            %1$I.org_has_permission(''EXECUTE_DFI_DRAWDOWN''),
            %1$I.org_has_permission(''PLACE_TBILLS''),
            %1$I.org_has_permission(''MODIFY_GL_JOURNAL''),
            %1$I.org_has_permission(''VAULT_RECONCILE''),
            %1$I.org_has_permission(''MANAGE_ASSIGNED_TILL''),
            %1$I.org_has_permission(''MANAGE_USERS''),
            %1$I.org_has_permission(''READ_ALL_MODULES''),
            %1$I.org_has_permission(''PACING_RELEASE_AUTHORIZE'')
         FROM %1$I.users WHERE auth_uid = auth.uid() AND status = ''Active''',
        v_schema
    ) INTO v_user_id, v_user_name, v_user_branch, v_teller_id,v_single_limit,v_daily_limit,
        v_can_originate, v_can_credit, v_can_treasury, v_can_invest,
        v_can_opex, v_can_reconcile, v_can_till, v_can_users, v_can_read_all, v_can_release;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'An active organization user is required.'; END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id || ':domain:' || v_key, 0));
    EXECUTE format(
        'SELECT action,actor_user_id,payload,result FROM %I.domain_action_idempotency WHERE idempotency_key=$1',
        v_schema
    ) INTO v_saved_action,v_saved_actor,v_saved_payload,v_saved_result USING v_key;
    IF v_saved_action IS NOT NULL THEN
        IF v_saved_action IS DISTINCT FROM p_action
           OR v_saved_actor IS DISTINCT FROM v_user_id
           OR v_saved_payload IS DISTINCT FROM p_payload THEN
            RAISE EXCEPTION 'Idempotency key was already used for a different operation.';
        END IF;
        RETURN v_saved_result;
    END IF;

    CASE p_action
        WHEN 'create_loan_product' THEN
            IF NOT COALESCE(v_can_credit, false) THEN RAISE EXCEPTION 'Credit product administration permission is required.'; END IF;
            v_id := 'PROD-' || v_key;
            EXECUTE format('SELECT to_jsonb(p) FROM %I.loan_products p WHERE id=$1',v_schema)
                INTO v_product USING v_id;
            IF v_product IS NOT NULL THEN
                IF v_product->>'created_by' IS DISTINCT FROM v_user_id
                   OR v_product->>'name' IS DISTINCT FROM BTRIM(p_payload->>'name')
                   OR (v_product->>'annual_interest_rate')::NUMERIC IS DISTINCT FROM (p_payload->>'annualInterestRate')::NUMERIC
                   OR v_product->>'repayment_method' IS DISTINCT FROM p_payload->>'repaymentMethod' THEN
                    RAISE EXCEPTION 'Idempotency key was already used for a different product.';
                END IF;
                RETURN v_product;
            END IF;
            IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
                ('name','annualInterestRate','repaymentMethod','penaltyGraceDays','penaltyFixedFee','penaltyDailyRate')) THEN
                RAISE EXCEPTION 'Unexpected loan product fields.';
            END IF;
            IF NULLIF(BTRIM(p_payload->>'name'), '') IS NULL OR length(BTRIM(p_payload->>'name')) > 80 THEN
                RAISE EXCEPTION 'A loan product name of at most 80 characters is required.';
            END IF;
            PERFORM pg_advisory_xact_lock(hashtextextended(
                p_org_id||':loan-product:'||lower(BTRIM(p_payload->>'name')),0
            ));
            v_rate := (p_payload->>'annualInterestRate')::NUMERIC;
            v_grace_days := COALESCE(NULLIF(p_payload->>'penaltyGraceDays','')::INTEGER, 0);
            IF v_rate < 0 OR v_rate > 1000 OR v_grace_days < 0 OR v_grace_days > 3650
               OR COALESCE((p_payload->>'penaltyFixedFee')::NUMERIC, 0) < 0
               OR COALESCE((p_payload->>'penaltyDailyRate')::NUMERIC, 0) < 0
               OR p_payload->>'repaymentMethod' NOT IN ('flat','reducing') THEN
                RAISE EXCEPTION 'Loan product policy values are invalid.';
            END IF;
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.loan_products WHERE lower(name)=lower($1))', v_schema)
                INTO v_till_user_match USING BTRIM(p_payload->>'name');
            IF v_till_user_match THEN RAISE EXCEPTION 'A product with this name already exists.'; END IF;
            EXECUTE format($sql$
                INSERT INTO %1$I.loan_products
                    (id, name, annual_interest_rate, repayment_method, penalty_grace_days,
                     penalty_fixed_fee, penalty_daily_rate, policy_version, created_by)
                VALUES ($1,$2,$3,$4,$5,$6,$7,
                    COALESCE((SELECT MAX(policy_version) FROM %1$I.loan_products),0)+1,$8)
                RETURNING jsonb_build_object(
                    'id',id,'name',name,'annualInterestRate',annual_interest_rate,
                    'rateConfigured',true,'repaymentMethod',repayment_method,
                    'penaltyGraceDays',penalty_grace_days,'penaltyFixedFee',penalty_fixed_fee,
                    'penaltyDailyRate',penalty_daily_rate,'policyVersion',policy_version
                )
            $sql$, v_schema) INTO v_result USING v_id, BTRIM(p_payload->>'name'), v_rate,
                p_payload->>'repaymentMethod', v_grace_days,
                COALESCE((p_payload->>'penaltyFixedFee')::NUMERIC,0),
                COALESCE((p_payload->>'penaltyDailyRate')::NUMERIC,0), v_user_id;
            v_result := v_result || jsonb_build_object('id', v_id);
            v_status := 'LOAN_PRODUCT_CREATED';
        WHEN 'update_loan_product' THEN
            IF NOT COALESCE(v_can_credit, false) THEN RAISE EXCEPTION 'Credit product administration permission is required.'; END IF;
            v_id := NULLIF(p_payload->>'productId','');
            IF v_id IS NULL THEN RAISE EXCEPTION 'Loan product ID is required.'; END IF;
            v_rate := (p_payload->>'annualInterestRate')::NUMERIC;
            v_grace_days := COALESCE(NULLIF(p_payload->>'penaltyGraceDays','')::INTEGER,0);
            IF v_rate < 0 OR v_rate > 1000 OR v_grace_days < 0 OR v_grace_days > 3650
               OR COALESCE((p_payload->>'penaltyFixedFee')::NUMERIC,0) < 0
               OR COALESCE((p_payload->>'penaltyDailyRate')::NUMERIC,0) < 0
               OR p_payload->>'repaymentMethod' NOT IN ('flat','reducing') THEN
                RAISE EXCEPTION 'Loan product policy values are invalid.';
            END IF;
            EXECUTE format($sql$
                UPDATE %1$I.loan_products SET
                    annual_interest_rate=$2, repayment_method=$3, penalty_grace_days=$4,
                    penalty_fixed_fee=$5, penalty_daily_rate=$6,
                    policy_version=policy_version+1, updated_at=NOW()
                WHERE id=$1
                RETURNING jsonb_build_object(
                    'id',id,'name',name,'annualInterestRate',annual_interest_rate,
                    'rateConfigured',true,'repaymentMethod',repayment_method,
                    'penaltyGraceDays',penalty_grace_days,'penaltyFixedFee',penalty_fixed_fee,
                    'penaltyDailyRate',penalty_daily_rate,'policyVersion',policy_version
                )
            $sql$, v_schema) INTO v_result USING v_id,v_rate,p_payload->>'repaymentMethod',
                v_grace_days,COALESCE((p_payload->>'penaltyFixedFee')::NUMERIC,0),
                COALESCE((p_payload->>'penaltyDailyRate')::NUMERIC,0);
            IF v_result IS NULL THEN RAISE EXCEPTION 'Loan product not found.'; END IF;
            v_status := 'LOAN_PRODUCT_POLICY_UPDATED';
        WHEN 'create_loan_application' THEN
            IF NOT COALESCE(v_can_originate, false) THEN RAISE EXCEPTION 'Loan application origination permission is required.'; END IF;
            v_member_id := NULLIF(p_payload->>'memberId','');
            v_product_id := NULLIF(p_payload->>'productId','');
            v_amount := (p_payload->>'amount')::NUMERIC;
            v_m := (p_payload->>'termMonths')::INTEGER;
            IF v_member_id IS NULL OR v_product_id IS NULL OR v_amount <= 0 OR v_amount > 999999999999
               OR v_m < 1 OR v_m > 600 OR NULLIF(BTRIM(p_payload->>'purpose'),'') IS NULL THEN
                RAISE EXCEPTION 'A member, product, purpose, positive amount, and valid term are required.';
            END IF;
            EXECUTE format('SELECT to_jsonb(m) FROM %I.members m WHERE id=$1 FOR UPDATE', v_schema)
                INTO v_member USING v_member_id;
            IF v_member IS NULL THEN RAISE EXCEPTION 'Loan applicant was not found.'; END IF;
            IF NOT COALESCE(v_can_read_all,false) AND (v_member->>'branchId') IS DISTINCT FROM v_user_branch THEN
                RAISE EXCEPTION 'Applicant is outside the operator branch.';
            END IF;
            EXECUTE format('SELECT jsonb_build_object(''id'',id,''name'',name,''annualInterestRate'',annual_interest_rate,''repaymentMethod'',repayment_method,''penaltyGraceDays'',penalty_grace_days,''penaltyFixedFee'',penalty_fixed_fee,''penaltyDailyRate'',penalty_daily_rate,''policyVersion'',policy_version) FROM %I.loan_products WHERE id=$1 FOR SHARE',v_schema)
                INTO v_product USING v_product_id;
            IF v_product IS NULL THEN RAISE EXCEPTION 'Select an active loan product.'; END IF;
            v_id := 'LA-' || v_key;
            v_task_id := 'WF-' || v_key;
            EXECUTE format('SELECT to_jsonb(a) FROM %I.loan_applications a WHERE id=$1',v_schema)
                INTO v_app USING v_id;
            IF v_app IS NOT NULL THEN
                IF v_app->>'maker_user_id' IS DISTINCT FROM v_user_id
                   OR v_app->>'member_id' IS DISTINCT FROM v_member_id
                   OR v_app->>'product_id' IS DISTINCT FROM v_product_id
                   OR (v_app->>'amount')::NUMERIC IS DISTINCT FROM v_amount
                   OR (v_app->>'term_months')::INTEGER IS DISTINCT FROM v_m THEN
                    RAISE EXCEPTION 'Idempotency key was already used for a different loan application.';
                END IF;
                RETURN v_app;
            END IF;
            v_policy := jsonb_build_object(
                'graceDays',COALESCE((v_product->>'penaltyGraceDays')::INTEGER,0),
                'fixedFee',COALESCE((v_product->>'penaltyFixedFee')::NUMERIC,0),
                'dailyRate',COALESCE((v_product->>'penaltyDailyRate')::NUMERIC,0),
                'version',COALESCE((v_product->>'policyVersion')::INTEGER,1)
            );
            v_history := jsonb_build_array(jsonb_build_object(
                'step','Maker Initiation','user',v_user_name,'action','Initiated','timestamp',v_now
            ));
            EXECUTE format($sql$
                INSERT INTO %1$I.loan_applications
                    (id,member_id,product_id,amount,purpose,term_months,guarantor_member_id,
                     urgency,status,maker_user_id,branch_id,annual_interest_rate,
                     repayment_method,penalty_policy,workflow_task_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Application Submitted',$9,$10,$11,$12,$13,$14)
                RETURNING to_jsonb(loan_applications)
            $sql$,v_schema) INTO v_app USING v_id,v_member_id,v_product_id,v_amount,
                BTRIM(p_payload->>'purpose'),v_m,NULLIF(p_payload->>'guarantorMemberId',''),
                COALESCE(NULLIF(p_payload->>'urgency',''),'Medium'),v_user_id,
                v_member->>'branchId',(v_product->>'annualInterestRate')::NUMERIC,
                v_product->>'repaymentMethod',v_policy,v_task_id;
            IF v_member->>'branchId' IS NULL THEN RAISE EXCEPTION 'Applicant has no assigned branch.'; END IF;
            IF COALESCE(p_payload->>'urgency','Medium') NOT IN ('Low','Medium','High') THEN
                RAISE EXCEPTION 'Urgency must be Low, Medium, or High.';
            END IF;
            IF NULLIF(p_payload->>'guarantorMemberId','') IS NOT NULL THEN
                IF p_payload->>'guarantorMemberId'=v_member_id OR NOT EXISTS (
                    SELECT 1 FROM public.organizations WHERE id=p_org_id AND status='active'
                ) THEN RAISE EXCEPTION 'A distinct valid guarantor member is required.'; END IF;
                EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.members WHERE id=$1)',v_schema)
                    INTO v_roles_valid USING p_payload->>'guarantorMemberId';
                IF NOT COALESCE(v_roles_valid,false) THEN RAISE EXCEPTION 'Guarantor member not found.'; END IF;
            END IF;
            EXECUTE format($sql$
                INSERT INTO %1$I.workflow_tasks
                    (id,type,entity_id,title,amount,maker_user_id,approver_role,status,priority,history)
                VALUES ($1,'Loan Application Review',$2,$3,$4,$5,'Credit/Loans',
                    'Pending Checker Release',$6,$7)
                RETURNING to_jsonb(workflow_tasks)
            $sql$,v_schema) INTO v_task USING v_task_id,v_id,
                (v_product->>'name') || ' - ' || (v_member->>'name'),v_amount,v_user_id,
                COALESCE(NULLIF(p_payload->>'urgency',''),'Medium'),v_history;
            v_result := jsonb_build_object(
                'id',v_id,'clientName',v_member->>'name','memberId',v_member_id,
                'branch',v_member->>'branchName','branchId',v_member->>'branchId',
                'product',v_product->>'name','productId',v_product_id,'amount',v_amount,
                'purpose',BTRIM(p_payload->>'purpose'),'termMonths',v_m,
                'guarantorMemberId',NULLIF(p_payload->>'guarantorMemberId',''),
                'appliedDate',v_now::DATE,'expectedYield',(v_product->>'annualInterestRate')::NUMERIC,
                'annualInterestRate',(v_product->>'annualInterestRate')::NUMERIC,
                'repaymentMethod',v_product->>'repaymentMethod','penaltyPolicy',v_policy,
                'urgency',COALESCE(NULLIF(p_payload->>'urgency',''),'Medium'),
                'status','Application Submitted','staggeredBatch',NULL,'workflowTaskId',v_task_id
            );
            v_status := 'LOAN_APPLICATION_SUBMITTED';
        WHEN 'review_loan_application' THEN
            IF NOT COALESCE(v_can_credit,false) THEN RAISE EXCEPTION 'Credit checker permission is required.'; END IF;
            v_id := NULLIF(p_payload->>'applicationId','');
            v_status := p_payload->>'decision';
            v_reason := BTRIM(COALESCE(p_payload->>'reason',''));
            IF v_id IS NULL OR v_status NOT IN ('Approve','Reject') THEN RAISE EXCEPTION 'A valid application decision is required.'; END IF;
            EXECUTE format('SELECT to_jsonb(a) FROM %I.loan_applications a WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_app USING v_id;
            IF v_app IS NULL THEN RAISE EXCEPTION 'Loan application not found.'; END IF;
            IF v_app->>'maker_user_id' = v_user_id THEN RAISE EXCEPTION 'A maker cannot approve or reject their own application.'; END IF;
            IF v_app->>'status' <> 'Application Submitted' THEN RAISE EXCEPTION 'Application is no longer awaiting review.'; END IF;
            IF v_status = 'Reject' AND v_reason = '' THEN RAISE EXCEPTION 'A rejection reason is required.'; END IF;
            IF v_status='Approve' AND v_single_limit>0 AND (v_app->>'amount')::NUMERIC>v_single_limit THEN
                RAISE EXCEPTION 'Application exceeds the operator single-approval limit.';
            END IF;
            IF v_status='Approve' AND v_daily_limit>0 THEN
                PERFORM pg_advisory_xact_lock(hashtextextended(
                    p_org_id||':loan-approval:'||v_user_id||':'||CURRENT_DATE::TEXT,0
                ));
                EXECUTE format('SELECT COALESCE(SUM(amount),0) FROM %I.loan_applications WHERE approved_by=$1 AND approved_at::DATE=CURRENT_DATE',v_schema)
                    INTO v_amount USING v_user_id;
                IF COALESCE(v_amount,0)+(v_app->>'amount')::NUMERIC>v_daily_limit THEN
                    RAISE EXCEPTION 'Application exceeds the operator remaining daily approval limit.';
                END IF;
            END IF;
            v_status := CASE WHEN p_payload->>'decision' = 'Approve' THEN 'Approved - Pending Pacing' ELSE 'Rejected' END;
            EXECUTE format($sql$
                UPDATE %1$I.loan_applications SET status=$2,
                    approved_by=CASE WHEN $2='Approved - Pending Pacing' THEN $3 ELSE NULL END,
                    approved_at=CASE WHEN $2='Approved - Pending Pacing' THEN NOW() ELSE NULL END,
                    rejection_reason=CASE WHEN $2='Rejected' THEN $4 ELSE NULL END
                WHERE id=$1 RETURNING to_jsonb(loan_applications)
            $sql$,v_schema) INTO v_app USING v_id,v_status,v_user_id,v_reason;
            EXECUTE format($sql$
                UPDATE %1$I.workflow_tasks
                SET status=$2,updated_at=NOW(),
                    history=history || jsonb_build_array(jsonb_build_object(
                        'step','Credit Checker Review','user',$3,'action',$4,
                        'reason',$5,'timestamp',NOW()))
                WHERE id=$1
            $sql$,v_schema) USING v_app->>'workflow_task_id',
                CASE WHEN v_status='Rejected' THEN 'Rejected / Returned to Maker' ELSE 'Approved & Released' END,
                v_user_name,p_payload->>'decision',v_reason;
            v_result := jsonb_build_object('application',v_app,'status',v_status);
            v_status := CASE WHEN p_payload->>'decision'='Approve' THEN 'LOAN_APPLICATION_APPROVED' ELSE 'LOAN_APPLICATION_REJECTED' END;
        WHEN 'set_loan_pacing' THEN
            IF NOT COALESCE(v_can_credit,false) THEN RAISE EXCEPTION 'Credit checker permission is required.'; END IF;
            v_id := NULLIF(p_payload->>'applicationId','');
            v_batch := NULLIF(p_payload->>'batch','');
            IF v_id IS NULL OR v_batch NOT IN ('Batch 1','Batch 2','Batch 3') THEN RAISE EXCEPTION 'A valid application and pacing batch are required.'; END IF;
            EXECUTE format($sql$
                UPDATE %1$I.loan_applications SET staggered_batch=$2
                WHERE id=$1 AND status='Approved - Pending Pacing'
                RETURNING to_jsonb(loan_applications)
            $sql$,v_schema) INTO v_app USING v_id,v_batch;
            IF v_app IS NULL THEN RAISE EXCEPTION 'Only an approved application can be paced.'; END IF;
            v_result := jsonb_build_object('applicationId',v_id,'batch',v_batch);
            v_status := 'LOAN_APPLICATION_PACED';
        WHEN 'disburse_loan_application' THEN
            IF NOT (COALESCE(v_can_credit,false) OR COALESCE(v_can_release,false)) THEN
                RAISE EXCEPTION 'Credit loan release permission is required.';
            END IF;
            v_id := NULLIF(p_payload->>'applicationId','');
            IF v_id IS NULL THEN RAISE EXCEPTION 'Loan application ID is required.'; END IF;
            EXECUTE format('SELECT to_jsonb(a) FROM %I.loan_applications a WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_app USING v_id;
            IF v_app IS NULL THEN RAISE EXCEPTION 'Loan application not found.'; END IF;
            EXECUTE format('SELECT to_jsonb(tx) FROM %I.transactions tx WHERE tx.id=$1',v_schema)
                INTO v_result USING 'TX-'||v_key;
            IF v_result IS NOT NULL THEN
                IF v_result->>'type' <> 'Loan Disbursement'
                   OR v_result->>'loanId' <> v_id
                   OR (v_result->>'amount')::NUMERIC <> (v_app->>'amount')::NUMERIC THEN
                    RAISE EXCEPTION 'Idempotency key belongs to a different loan release.';
                END IF;
                RETURN v_result;
            END IF;
            IF v_app->>'status' <> 'Approved - Pending Pacing' THEN RAISE EXCEPTION 'Only an approved loan can be disbursed.'; END IF;
            EXECUTE format('SELECT status FROM %I.workflow_tasks WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_status USING v_app->>'workflow_task_id';
            IF v_status <> 'Approved & Released' THEN RAISE EXCEPTION 'Maker-checker approval is required before disbursement.'; END IF;
            IF v_app->>'maker_user_id'=v_user_id THEN RAISE EXCEPTION 'A maker cannot release their own application.'; END IF;
            IF v_single_limit>0 AND (v_app->>'amount')::NUMERIC>v_single_limit THEN
                RAISE EXCEPTION 'Loan exceeds the operator single-release limit.';
            END IF;
            IF NOT COALESCE(v_can_read_all,false)
               AND (v_app->>'branch_id') IS DISTINCT FROM v_user_branch THEN
                RAISE EXCEPTION 'Loan application is outside the operator branch.';
            END IF;
            EXECUTE format('SELECT jsonb_build_object(''id'',id,''name'',name) FROM %I.loan_products WHERE id=$1',v_schema)
                INTO v_product USING v_app->>'product_id';
            v_member_id := v_app->>'member_id';
            EXECUTE format('SELECT to_jsonb(m) FROM %I.members m WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_member USING v_member_id;
            IF v_member IS NULL THEN RAISE EXCEPTION 'Loan applicant no longer exists.'; END IF;
            v_amount := (v_app->>'amount')::NUMERIC;
            v_rate := (v_app->>'annual_interest_rate')::NUMERIC;
            v_monthly_rate := v_rate/1200;
            v_m := (v_app->>'term_months')::INTEGER;
            v_installment := CASE
                WHEN v_app->>'repayment_method'='flat' THEN v_amount*(1+(v_rate/100)*v_m/12)/v_m
                WHEN v_monthly_rate=0 THEN v_amount/v_m
                ELSE v_amount*v_monthly_rate/(1-power(1+v_monthly_rate,-v_m))
            END;
            v_balance := v_amount;
            FOR v_m IN 1..(v_app->>'term_months')::INTEGER LOOP
                v_interest := CASE WHEN v_app->>'repayment_method'='flat'
                    THEN v_amount*v_monthly_rate ELSE v_balance*v_monthly_rate END;
                v_principal := CASE WHEN v_m=(v_app->>'term_months')::INTEGER THEN v_balance
                    ELSE LEAST(v_balance,GREATEST(0,v_installment-v_interest)) END;
                v_schedule := v_schedule || jsonb_build_array(jsonb_build_object(
                    'id',v_id||'-INST-'||v_m,
                    'dueDate',(CURRENT_DATE + make_interval(months=>v_m))::DATE,
                    'installmentAmount',CASE WHEN v_m=(v_app->>'term_months')::INTEGER
                        THEN v_balance+v_interest ELSE v_installment END,
                    'principalAmount',v_principal,'interestAmount',v_interest,'status','Due'
                ));
                v_balance := GREATEST(0,v_balance-v_principal);
            END LOOP;
            v_loan := jsonb_build_object(
                'loanId',v_id,'id',v_id,'product',COALESCE(v_product->>'name',v_app->>'product_id'),
                'principal',v_amount,'outstandingBalance',v_amount,'termMonths',(v_app->>'term_months')::INTEGER,
                'interestRate',v_rate,'repaymentMethod',v_app->>'repayment_method',
                'monthlyInstallment',v_installment,'repaymentSchedule',v_schedule,
                'nextDueDate',v_schedule->0->>'dueDate','penaltyPolicy',v_app->'penalty_policy',
                'penaltyAssessments','[]'::JSONB,'paymentHistory','[]'::JSONB,'disbursedAt',v_now
            );
            EXECUTE format('UPDATE %I.members SET "activeLoans"=COALESCE("activeLoans",''[]''::JSONB)||$1 WHERE id=$2',v_schema)
                USING jsonb_build_array(v_loan),v_member_id;
            v_result := public.execute_tenant_financial_action(p_org_id,'loan_disbursement',v_amount,
                'Loan disbursement to '||COALESCE(v_member->>'name',v_member_id),v_key,
                v_member_id,v_id,v_id);
            EXECUTE format('UPDATE %I.loan_applications SET status=''Disbursed'',disbursed_at=NOW() WHERE id=$1',v_schema)
                USING v_id;
            v_result := v_result || jsonb_build_object('loan',v_loan,'applicationId',v_id);
            v_status := 'LOAN_DISBURSED';
        WHEN 'assess_loan_penalty' THEN
            IF NOT COALESCE(v_can_credit,false) THEN RAISE EXCEPTION 'Credit checker permission is required to assess penalties.'; END IF;
            v_member_id := NULLIF(p_payload->>'memberId','');
            v_target_id := NULLIF(p_payload->>'loanId','');
            v_id := NULLIF(p_payload->>'installmentId','');
            v_amount := (p_payload->>'amount')::NUMERIC;
            v_reason := BTRIM(COALESCE(p_payload->>'reason',''));
            IF v_member_id IS NULL OR v_target_id IS NULL OR v_id IS NULL OR v_amount <= 0 OR v_reason='' THEN
                RAISE EXCEPTION 'A loan, instalment, positive penalty amount, and reason are required.';
            END IF;
            EXECUTE format('SELECT to_jsonb(m) FROM %I.members m WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_member USING v_member_id;
            IF v_member IS NULL THEN RAISE EXCEPTION 'Member not found.'; END IF;
            IF NOT COALESCE(v_can_read_all,false) AND (v_member->>'branchId') IS DISTINCT FROM v_user_branch THEN RAISE EXCEPTION 'Member is outside the operator branch.'; END IF;
            SELECT loan INTO v_loan_item FROM jsonb_array_elements(COALESCE(v_member->'activeLoans','[]'::JSONB)) loan
                WHERE loan->>'loanId'=v_target_id OR loan->>'id'=v_target_id LIMIT 1;
            IF v_loan_item IS NULL THEN RAISE EXCEPTION 'Loan account not found.'; END IF;
            SELECT penalty INTO v_result
            FROM jsonb_array_elements(COALESCE(v_loan_item->'penaltyAssessments','[]'::JSONB)) penalty
            WHERE penalty->>'id'='PEN-'||v_key LIMIT 1;
            IF v_result IS NOT NULL THEN
                IF v_result->>'installmentId'<>v_id
                   OR (v_result->>'amount')::NUMERIC<>v_amount
                   OR v_result->>'reason'<>v_reason THEN
                    RAISE EXCEPTION 'Idempotency key belongs to a different penalty assessment.';
                END IF;
                RETURN v_result;
            END IF;
            SELECT s INTO v_task FROM jsonb_array_elements(COALESCE(v_loan_item->'repaymentSchedule','[]'::JSONB)) s
                WHERE s->>'id'=v_id LIMIT 1;
            IF v_task IS NULL THEN
                RAISE EXCEPTION 'Instalment does not belong to this loan.';
            END IF;
            IF v_task->>'status'='Paid' OR (v_task->>'dueDate')::DATE>=CURRENT_DATE THEN
                RAISE EXCEPTION 'Only an overdue unpaid instalment can receive a penalty assessment.';
            END IF;
            IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_loan_item->'penaltyAssessments','[]'::JSONB)) p
                WHERE p->>'installmentId'=v_id AND LEFT(p->>'assessedAt',10)=CURRENT_DATE::TEXT) THEN
                RAISE EXCEPTION 'A penalty was already assessed on this instalment today.';
            END IF;
            v_loan_item := jsonb_set(v_loan_item,'{penaltyAssessments}',
                COALESCE(v_loan_item->'penaltyAssessments','[]'::JSONB)||jsonb_build_array(jsonb_build_object(
                    'id','PEN-'||v_key,'installmentId',v_id,'amount',v_amount,'reason',v_reason,
                    'assessedAt',v_now,'assessedBy',v_user_name,'status','Assessed - Unpaid'
                )),true);
            EXECUTE format($sql$
                UPDATE %1$I.members m SET "activeLoans"=(
                    SELECT jsonb_agg(CASE WHEN loan->>'loanId'=$2 OR loan->>'id'=$2 THEN $3 ELSE loan END)
                    FROM jsonb_array_elements(COALESCE(m."activeLoans",'[]'::JSONB)) loan)
                WHERE m.id=$1
            $sql$,v_schema) USING v_member_id,v_target_id,v_loan_item;
            v_result := jsonb_build_object('id','PEN-'||v_key,'memberId',v_member_id,
                'loanId',v_target_id,'installmentId',v_id,'amount',v_amount,'reason',v_reason,
                'assessedAt',v_now,'assessedBy',v_user_name,'status','Assessed - Unpaid');
            v_status := 'LOAN_PENALTY_ASSESSED';
        WHEN 'create_external_facility' THEN
            IF NOT COALESCE(v_can_treasury,false) THEN RAISE EXCEPTION 'DFI facility administration permission is required.'; END IF;
            v_id := 'DFI-'||v_key;
            EXECUTE format('SELECT to_jsonb(f) FROM %I.external_facilities f WHERE id=$1',v_schema)
                INTO v_facility USING v_id;
            IF v_facility IS NOT NULL THEN
                IF v_facility->>'created_by' IS DISTINCT FROM v_user_id
                   OR v_facility->>'lender' IS DISTINCT FROM BTRIM(p_payload->>'lender')
                   OR (v_facility->>'total_commitment')::NUMERIC IS DISTINCT FROM (p_payload->>'commitment')::NUMERIC THEN
                    RAISE EXCEPTION 'Idempotency key was already used for a different facility.';
                END IF;
                RETURN v_facility;
            END IF;
            v_amount := (p_payload->>'commitment')::NUMERIC;
            v_rate := COALESCE((p_payload->>'interestRate')::NUMERIC,0);
            IF NULLIF(BTRIM(p_payload->>'lender'),'') IS NULL
               OR NULLIF(BTRIM(p_payload->>'facilityType'),'') IS NULL
               OR v_amount <= 0 OR v_rate < 0 THEN RAISE EXCEPTION 'Facility name, type, commitment, and valid rate are required.'; END IF;
            EXECUTE format($sql$
                INSERT INTO %1$I.external_facilities
                    (id,lender,facility_type,total_commitment,interest_rate,first_repayment_date,
                     repayment_amount,expected_drawdown_date,expected_drawdown_amount,created_by)
                VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::DATE,$7,NULLIF($8,'')::DATE,$9,$10)
                RETURNING to_jsonb(external_facilities)
            $sql$,v_schema) INTO v_facility USING v_id,BTRIM(p_payload->>'lender'),
                BTRIM(p_payload->>'facilityType'),v_amount,v_rate,
                COALESCE(p_payload->>'firstRepaymentDate',''),
                COALESCE((p_payload->>'repaymentAmount')::NUMERIC,0),
                COALESCE(p_payload->>'expectedDrawdownDate',''),
                COALESCE((p_payload->>'expectedDrawdownAmount')::NUMERIC,0),v_user_id;
            v_result := jsonb_build_object('id',v_id,'lender',v_facility->>'lender',
                'facilityType',v_facility->>'facility_type','totalCommitment',v_amount,
                'drawnAmount',0,'availableToDraw',v_amount,'interestRate',v_rate,
                'nextRepaymentDate',v_facility->>'first_repayment_date',
                'nextRepaymentAmount',v_facility->>'repayment_amount',
                'nextExpectedDrawdownDate',v_facility->>'expected_drawdown_date',
                'nextExpectedDrawdownAmount',v_facility->>'expected_drawdown_amount');
            v_status := 'NEW_DFI_FACILITY_REGISTERED';
        WHEN 'draw_external_facility' THEN
            IF NOT COALESCE(v_can_treasury,false) THEN RAISE EXCEPTION 'DFI drawdown permission is required.'; END IF;
            v_id := NULLIF(p_payload->>'facilityId','');
            v_amount := (p_payload->>'amount')::NUMERIC;
            EXECUTE format('SELECT to_jsonb(f) FROM %I.external_facilities f WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_facility USING v_id;
            IF v_facility IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
                RAISE EXCEPTION 'Facility not found or drawdown exceeds available commitment.';
            END IF;
            EXECUTE format('SELECT to_jsonb(tx) FROM %I.transactions tx WHERE tx.id=$1',v_schema)
                INTO v_result USING 'TX-'||v_key;
            IF v_result IS NOT NULL THEN
                RETURN public.execute_tenant_financial_action(p_org_id,'dfi_drawdown',v_amount,
                    COALESCE(p_payload->>'notes','DFI facility drawdown'),v_key,NULL,NULL,v_id);
            END IF;
            IF v_amount > (v_facility->>'total_commitment')::NUMERIC-(v_facility->>'drawn_amount')::NUMERIC THEN
                RAISE EXCEPTION 'Drawdown exceeds available facility commitment.';
            END IF;
            EXECUTE format('UPDATE %I.external_facilities SET drawn_amount=drawn_amount+$2 WHERE id=$1',v_schema)
                USING v_id,v_amount;
            v_result := public.execute_tenant_financial_action(p_org_id,'dfi_drawdown',v_amount,
                COALESCE(p_payload->>'notes','DFI facility drawdown'),v_key,NULL,NULL,v_id);
            v_status := 'DFI_FACILITY_DRAWDOWN';
        WHEN 'create_operating_expense' THEN
            IF NOT COALESCE(v_can_opex,false) THEN RAISE EXCEPTION 'Operating expense schedule permission is required.'; END IF;
            v_amount := (p_payload->>'monthlyAmount')::NUMERIC;
            v_due_day := COALESCE((p_payload->>'dueDay')::INTEGER,15);
            IF NULLIF(BTRIM(p_payload->>'category'),'') IS NULL OR v_amount <= 0 OR v_due_day NOT BETWEEN 1 AND 31 THEN
                RAISE EXCEPTION 'An expense category, positive monthly amount, and due day from 1 to 31 are required.';
            END IF;
            v_id := 'OPX-'||v_key;
            EXECUTE format('SELECT to_jsonb(o) FROM %I.operating_expenses o WHERE id=$1',v_schema)
                INTO v_result USING v_id;
            IF v_result IS NOT NULL THEN
                IF v_result->>'created_by' IS DISTINCT FROM v_user_id
                   OR v_result->>'category' IS DISTINCT FROM BTRIM(p_payload->>'category')
                   OR (v_result->>'monthly_amount')::NUMERIC IS DISTINCT FROM v_amount THEN
                    RAISE EXCEPTION 'Idempotency key was already used for a different expense schedule.';
                END IF;
                RETURN v_result;
            END IF;
            EXECUTE format('INSERT INTO %I.operating_expenses(id,category,monthly_amount,due_day,created_by) VALUES($1,$2,$3,$4,$5) RETURNING to_jsonb(operating_expenses)',v_schema)
                INTO v_result USING v_id,BTRIM(p_payload->>'category'),v_amount,v_due_day,v_user_id;
            v_result := jsonb_build_object('id',v_id,'category',v_result->>'category',
                'monthlyAmount',v_amount,'dueDayOfMonth',v_due_day);
            v_status := 'OPEX_SCHEDULE_ADDED';
        WHEN 'reconcile_vault' THEN
            IF NOT COALESCE(v_can_reconcile,false) THEN RAISE EXCEPTION 'Vault reconciliation permission is required.'; END IF;
            v_branch_id := COALESCE(NULLIF(p_payload->>'branchId',''),v_user_branch);
            v_amount := (p_payload->>'cashInVault')::NUMERIC;
            IF v_branch_id IS NULL OR v_amount < 0 OR NOT EXISTS (
                SELECT 1 FROM public.organizations WHERE id=p_org_id AND status='active') THEN
                RAISE EXCEPTION 'Valid branch and non-negative physical vault count are required.';
            END IF;
            EXECUTE format('SELECT to_jsonb(b) FROM %I.branches b WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_branch USING v_branch_id;
            IF v_branch IS NULL THEN RAISE EXCEPTION 'Branch not found.'; END IF;
            EXECUTE format('SELECT %I.org_can_access_branch($1)',v_schema) INTO v_till_user_match USING v_branch_id;
            IF NOT COALESCE(v_till_user_match,false) THEN RAISE EXCEPTION 'Branch access denied.'; END IF;
            v_id := 'REC-'||v_key;
            EXECUTE format('SELECT to_jsonb(r) FROM %I.branch_reconciliations r WHERE id=$1',v_schema)
                INTO v_result USING v_id;
            IF v_result IS NOT NULL THEN
                IF v_result->>'operator_id' IS DISTINCT FROM v_user_id
                   OR v_result->>'branch_id' IS DISTINCT FROM v_branch_id
                   OR (v_result->>'cash_in_vault')::NUMERIC IS DISTINCT FROM v_amount THEN
                    RAISE EXCEPTION 'Idempotency key was already used for a different vault count.';
                END IF;
                RETURN v_result;
            END IF;
            EXECUTE format('UPDATE %I.branches SET "cashInVault"=$2,"lastReconciledAt"=NOW()::TEXT,"reconciliationDiscrepancy"=$2-COALESCE("cashInVault",0) WHERE id=$1',v_schema)
                USING v_branch_id,v_amount;
            EXECUTE format('INSERT INTO %I.branch_reconciliations(id,branch_id,operator_id,cash_in_vault,prior_cash_in_vault,notes) VALUES($1,$2,$3,$4,$5,$6)',v_schema)
                USING v_id,v_branch_id,v_user_id,v_amount,COALESCE((v_branch->>'cashInVault')::NUMERIC,0),COALESCE(p_payload->>'notes','Vault physical count');
            v_result := jsonb_build_object('id',v_id,'branchId',v_branch_id,
                'cashInVault',v_amount,'priorCashInVault',COALESCE((v_branch->>'cashInVault')::NUMERIC,0),
                'recordedAt',v_now,'notes',COALESCE(p_payload->>'notes','Vault physical count'));
            v_status := 'VAULT_RECONCILIATION_SUBMITTED';
        WHEN 'reconcile_assigned_till' THEN
            IF NOT (COALESCE(v_can_till,false) OR COALESCE(v_can_reconcile,false)) THEN RAISE EXCEPTION 'Assigned till reconciliation permission is required.'; END IF;
            IF v_user_branch IS NULL THEN RAISE EXCEPTION 'Operator has no assigned branch.'; END IF;
            v_amount := (p_payload->>'balance')::NUMERIC;
            IF v_amount < 0 THEN RAISE EXCEPTION 'Till balance cannot be negative.'; END IF;
            EXECUTE format('SELECT to_jsonb(b) FROM %I.branches b WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_branch USING v_user_branch;
            IF v_branch IS NULL THEN RAISE EXCEPTION 'Operator branch not found.'; END IF;
            SELECT COUNT(*),MIN(t->>'tellerId') INTO v_till_count,v_till_id
            FROM jsonb_array_elements(COALESCE(v_branch->'tillBalances','[]'::JSONB)) t
            WHERE t->>'userId'=v_user_id OR (v_teller_id IS NOT NULL AND t->>'tellerId'=v_teller_id);
            IF v_till_count <> 1 THEN RAISE EXCEPTION 'Exactly one assigned till is required to reconcile.'; END IF;
            EXECUTE format($sql$
                UPDATE %1$I.branches b SET "tillBalances"=(
                    SELECT jsonb_agg(CASE WHEN t->>'userId'=$2 OR ($3 IS NOT NULL AND t->>'tellerId'=$3)
                        THEN jsonb_set(jsonb_set(t,'{balance}',to_jsonb($4),true),
                            '{status}',to_jsonb('Reconciled'::TEXT),true)
                        ELSE t END)
                    FROM jsonb_array_elements(COALESCE(b."tillBalances",'[]'::JSONB)) t
                ) WHERE b.id=$1
            $sql$,v_schema) USING v_user_branch,v_user_id,v_teller_id,v_amount;
            v_result := jsonb_build_object('branchId',v_user_branch,'tellerId',v_teller_id,
                'balance',v_amount,'status','Reconciled');
            v_status := 'TELLER_TILL_RECONCILED';
        WHEN 'create_investment' THEN
            IF NOT COALESCE(v_can_invest,false) THEN RAISE EXCEPTION 'Treasury investment placement permission is required.'; END IF;
            v_id := 'INV-'||v_key;
            EXECUTE format('SELECT to_jsonb(i) FROM %I.investment_positions i WHERE id=$1',v_schema)
                INTO v_position USING v_id;
            IF v_position IS NOT NULL THEN
                IF v_position->>'created_by' IS DISTINCT FROM v_user_id
                   OR v_position->>'institution' IS DISTINCT FROM BTRIM(p_payload->>'institution')
                   OR (v_position->>'principal')::NUMERIC IS DISTINCT FROM (p_payload->>'principal')::NUMERIC THEN
                    RAISE EXCEPTION 'Idempotency key was already used for a different investment.';
                END IF;
                RETURN public.execute_tenant_financial_action(p_org_id,'investment_placement',
                    (v_position->>'principal')::NUMERIC,'Treasury investment placement',
                    v_key,NULL,NULL,v_id);
            END IF;
            v_amount := (p_payload->>'principal')::NUMERIC;
            v_rate := COALESCE((p_payload->>'annualYield')::NUMERIC,0);
            IF NULLIF(BTRIM(p_payload->>'institution'),'') IS NULL
               OR NULLIF(BTRIM(p_payload->>'product'),'') IS NULL
               OR v_amount <= 0 OR v_rate < 0
               OR NULLIF(p_payload->>'maturityDate','')::DATE IS NULL
               OR NULLIF(p_payload->>'maturityDate','')::DATE <= CURRENT_DATE THEN
                RAISE EXCEPTION 'Investment institution, product, positive amount, yield, and future maturity date are required.';
            END IF;
            EXECUTE format('INSERT INTO %I.investment_positions(id,institution,product,principal,annual_yield,maturity_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING to_jsonb(investment_positions)',v_schema)
                INTO v_position USING v_id,BTRIM(p_payload->>'institution'),BTRIM(p_payload->>'product'),
                    v_amount,v_rate,(p_payload->>'maturityDate')::DATE,v_user_id;
            v_result := public.execute_tenant_financial_action(p_org_id,'investment_placement',v_amount,
                'Treasury investment placement: '||BTRIM(p_payload->>'institution'),v_key,NULL,NULL,v_id);
            v_result := v_result || jsonb_build_object('investment',jsonb_build_object(
                'id',v_id,'institution',v_position->>'institution','product',v_position->>'product',
                'principal',v_amount,'annualYield',v_rate,'maturityDate',v_position->>'maturity_date',
                'status','Active'));
            v_status := 'TREASURY_INVESTMENT_PLACED';
        WHEN 'redeem_investment' THEN
            IF NOT COALESCE(v_can_invest,false) THEN RAISE EXCEPTION 'Treasury investment permission is required.'; END IF;
            v_id := NULLIF(p_payload->>'investmentId','');
            IF v_id IS NULL THEN RAISE EXCEPTION 'Investment ID is required.'; END IF;
            EXECUTE format('SELECT to_jsonb(i) FROM %I.investment_positions i WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_position USING v_id;
            IF v_position IS NULL THEN RAISE EXCEPTION 'Investment not found.'; END IF;
            EXECUTE format('SELECT to_jsonb(tx) FROM %I.transactions tx WHERE tx.id=$1',v_schema)
                INTO v_result USING 'TX-'||v_key;
            IF v_result IS NOT NULL THEN
                BEGIN
                    v_existing_reference := (v_result->>'details')::JSONB->>'referenceId';
                    v_existing_action := (v_result->>'details')::JSONB->>'action';
                EXCEPTION WHEN OTHERS THEN
                    v_existing_reference := NULL;
                    v_existing_action := NULL;
                END;
                IF v_result->>'postedBy' IS DISTINCT FROM v_user_id
                   OR v_result->>'type' IS DISTINCT FROM 'Treasury Investment Redemption'
                   OR (v_result->>'amount')::NUMERIC IS DISTINCT FROM
                        (v_position->>'principal')::NUMERIC
                   OR v_existing_reference IS DISTINCT FROM v_id
                   OR v_existing_action IS DISTINCT FROM 'investment_redemption' THEN
                    RAISE EXCEPTION 'Idempotency key was already used for a different investment redemption.';
                END IF;
                RETURN public.execute_tenant_financial_action(p_org_id,'investment_redemption',
                    (v_result->>'amount')::NUMERIC,'Treasury investment redemption',v_key,
                    NULL,NULL,v_existing_reference);
            END IF;
            IF v_position->>'status' <> 'Active' THEN RAISE EXCEPTION 'Active investment not found.'; END IF;
            v_amount := (v_position->>'principal')::NUMERIC;
            EXECUTE format('UPDATE %I.investment_positions SET status=''Redeemed'' WHERE id=$1',v_schema) USING v_id;
            v_result := public.execute_tenant_financial_action(p_org_id,'investment_redemption',v_amount,
                'Treasury investment redemption: '||v_id,v_key,NULL,NULL,v_id);
            v_result := v_result || jsonb_build_object('investmentId',v_id,'status','Redeemed');
            v_status := 'TREASURY_INVESTMENT_REDEEMED';
        WHEN 'post_portfolio_provision' THEN
            IF NOT (COALESCE(v_can_credit,false) OR COALESCE(v_can_opex,false)) THEN RAISE EXCEPTION 'Portfolio provision posting permission is required.'; END IF;
            v_amount := (p_payload->>'amount')::NUMERIC;
            IF v_amount <= 0 THEN RAISE EXCEPTION 'Provision amount must be positive.'; END IF;
            v_result := public.execute_tenant_financial_action(p_org_id,'loan_loss_provision',v_amount,
                COALESCE(p_payload->>'notes','Loan loss provision'),v_key,NULL,NULL,'PORTFOLIO');
            v_status := 'LOAN_LOSS_PROVISION_POSTED';
        WHEN 'update_user_roles' THEN
            IF NOT COALESCE(v_can_users,false) THEN RAISE EXCEPTION 'User administration permission is required.'; END IF;
            v_target_id := NULLIF(p_payload->>'userId','');
            IF v_target_id IS NULL OR jsonb_typeof(p_payload->'roles') <> 'array' OR jsonb_array_length(p_payload->'roles')=0 THEN
                RAISE EXCEPTION 'A user and at least one valid role are required.';
            END IF;
            EXECUTE format('SELECT roles FROM %I.users WHERE id=$1 FOR UPDATE',v_schema)
                INTO v_target_roles USING v_target_id;
            IF v_target_roles IS NULL THEN RAISE EXCEPTION 'User not found.'; END IF;
            EXECUTE format($sql$
                SELECT
                    jsonb_array_length($2) = COUNT(DISTINCT selected.value),
                    COALESCE((SELECT jsonb_agg(DISTINCT permission.value)
                        FROM %1$I.users actor
                        CROSS JOIN LATERAL jsonb_array_elements_text(actor.roles) actor_role
                        JOIN %1$I.roles role_row ON role_row.id=actor_role.value
                        CROSS JOIN LATERAL jsonb_array_elements_text(role_row.permissions) permission
                        WHERE actor.id=$1),'[]'::JSONB),
                    COALESCE((SELECT jsonb_agg(DISTINCT permission.value)
                        FROM jsonb_array_elements_text($2) selected_role
                        JOIN %1$I.roles role_row ON role_row.id=selected_role.value
                        CROSS JOIN LATERAL jsonb_array_elements_text(role_row.permissions) permission),'[]'::JSONB)
                FROM jsonb_array_elements_text($2) selected
            $sql$,v_schema) INTO v_roles_valid,v_actor_permissions,v_target_permissions
                USING v_user_id,p_payload->'roles';
            IF NOT COALESCE(v_roles_valid,false) THEN RAISE EXCEPTION 'One or more selected roles do not exist.'; END IF;
            IF NOT (COALESCE(v_target_permissions,'[]'::JSONB) <@ COALESCE(v_actor_permissions,'[]'::JSONB)) THEN
                RAISE EXCEPTION 'You cannot grant permissions that you do not hold.';
            END IF;
            IF v_target_id=v_user_id AND NOT (COALESCE(v_target_permissions,'[]'::JSONB) @> '["MANAGE_USERS"]'::JSONB) THEN
                RAISE EXCEPTION 'Do not remove your own last user-management capability.';
            END IF;
            EXECUTE format('UPDATE %I.users SET roles=$2 WHERE id=$1 RETURNING to_jsonb(users)',v_schema)
                INTO v_result USING v_target_id,p_payload->'roles';
            v_status := 'USER_ROLES_UPDATED';
        WHEN 'update_user_status' THEN
            IF NOT COALESCE(v_can_users,false) THEN RAISE EXCEPTION 'User administration permission is required.'; END IF;
            v_target_id := NULLIF(p_payload->>'userId','');
            v_status := p_payload->>'status';
            IF v_target_id IS NULL OR v_status NOT IN ('Active','Suspended','Inactive') THEN RAISE EXCEPTION 'A valid user status is required.'; END IF;
            IF EXISTS (SELECT 1 FROM public.organizations WHERE id=p_org_id) AND v_target_id=v_user_id AND v_status<>'Active' THEN
                RAISE EXCEPTION 'You cannot suspend your own active session.';
            END IF;
            EXECUTE format('UPDATE %I.users SET status=$2 WHERE id=$1 RETURNING to_jsonb(users)',v_schema)
                INTO v_result USING v_target_id,v_status;
            IF v_result IS NULL THEN RAISE EXCEPTION 'User not found.'; END IF;
            v_status := 'USER_STATUS_UPDATED';
        ELSE
            RAISE EXCEPTION 'This tenant operation is not enabled.';
    END CASE;

    v_audit_id := 'AUD-'||extensions.uuid_generate_v4()::TEXT;
    EXECUTE format($sql$
        INSERT INTO %1$I.audit_trail
            (id,timestamp,"userId","userName",action,module,"entityId",description,"ipAddress","glImpact")
        VALUES ($1,NOW()::TEXT,$2,$3,$4,'Online Operations',$5,$6,NULL,'No GL effect')
    $sql$,v_schema)
    USING v_audit_id,v_user_id,v_user_name,v_status,
        COALESCE(v_result->>'id',v_result->>'applicationId',v_result->>'transactionId',p_action),
        COALESCE(p_payload->>'notes',p_payload->>'reason',p_payload->>'purpose',p_action);
    v_result := v_result || jsonb_build_object('auditId',v_audit_id);
    EXECUTE format(
        'INSERT INTO %I.domain_action_idempotency(idempotency_key,action,actor_user_id,payload,result) VALUES($1,$2,$3,$4,$5)',
        v_schema
    ) USING v_key,p_action,v_user_id,p_payload,v_result;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.online_write_capabilities(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execute_tenant_financial_action(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execute_tenant_domain_action(TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.online_write_capabilities(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_tenant_financial_action(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_tenant_domain_action(TEXT, TEXT, JSONB, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
