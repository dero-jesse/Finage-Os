-- Finage OS bounded online-write phase:
--   * server-authorized member creation
--   * atomic counter deposit / withdrawal / loan repayment / manual journal
-- Apply after platform_schema.sql and online_data_migration.sql.
-- No generic state replacement and no direct tenant DML are exposed.

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN
        SELECT schema_name
        FROM public.organizations
        WHERE status = 'active' AND schema_name ~ '^org_[a-z0-9_]+$'
    LOOP
        EXECUTE format('ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS "tellerId" TEXT', tenant.schema_name);
        EXECUTE format('ALTER TABLE %I.transactions ADD COLUMN IF NOT EXISTS "loanId" TEXT', tenant.schema_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_gl_select ON %I.general_ledger', tenant.schema_name);
        EXECUTE format(
            'CREATE POLICY tenant_gl_select ON %1$I.general_ledger FOR SELECT TO authenticated
             USING (%1$I.org_has_permission(''READ_ALL_MODULES'')
                 OR %1$I.org_has_permission(''MODIFY_GL_JOURNAL'')
                 OR %1$I.org_has_permission(''REPORTS_ACCESS'')
                 OR %1$I.org_has_permission(''POST_COUNTER_TX'')
                 OR %1$I.org_has_permission(''APPROVE_BRANCH_LOAN_TIER1''))',
            tenant.schema_name
        );
        EXECUTE format('DROP POLICY IF EXISTS tenant_audit_select ON %I.audit_trail', tenant.schema_name);
        EXECUTE format(
            'CREATE POLICY tenant_audit_select ON %1$I.audit_trail FOR SELECT TO authenticated
             USING (%1$I.org_has_permission(''VIEW_AUDIT_LOGS'')
                 OR %1$I.org_has_permission(''READ_ALL_MODULES'')
                 OR "userId" = %1$I.org_current_user_id())',
            tenant.schema_name
        );
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
BEGIN
    SELECT schema_name INTO v_schema
    FROM public.organizations
    WHERE id = p_org_id AND status = 'active'
      AND schema_name ~ '^org_[a-z0-9_]+$';
    IF v_schema IS NULL THEN
        RAISE EXCEPTION 'Active organization not found.';
    END IF;

    EXECUTE format('SELECT %I.org_current_user_id()', v_schema) INTO v_user_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'An active organization user is required.';
    END IF;
    EXECUTE format(
        'SELECT jsonb_build_object(
            ''member_create'', %1$I.org_has_permission(''MANAGE_USERS'')
                OR %1$I.org_has_permission(''APPROVE_BRANCH_LOAN_TIER1''),
            ''counter_post'', %1$I.org_has_permission(''POST_COUNTER_TX''),
            ''manual_journal'', %1$I.org_has_permission(''MODIFY_GL_JOURNAL''))',
        v_schema
    ) INTO v_result;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_tenant_member(p_org_id TEXT, p_member JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT;
    v_user_id TEXT;
    v_member_id TEXT;
    v_branch_id TEXT := NULLIF(p_member->>'branchId', '');
    v_member JSONB;
    v_can_create BOOLEAN;
    v_branch_allowed BOOLEAN;
BEGIN
    SELECT schema_name INTO v_schema
    FROM public.organizations
    WHERE id = p_org_id AND status = 'active'
      AND schema_name ~ '^org_[a-z0-9_]+$';
    IF v_schema IS NULL THEN RAISE EXCEPTION 'Active organization not found.'; END IF;

    EXECUTE format('SELECT %I.org_current_user_id()', v_schema) INTO v_user_id;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'An active organization user is required.'; END IF;
    EXECUTE format(
        'SELECT %1$I.org_has_permission(''MANAGE_USERS'')
            OR %1$I.org_has_permission(''APPROVE_BRANCH_LOAN_TIER1'')',
        v_schema
    ) INTO v_can_create;
    IF NOT COALESCE(v_can_create, false) THEN
        RAISE EXCEPTION 'Member onboarding permission is required.';
    END IF;
    IF v_branch_id IS NULL THEN RAISE EXCEPTION 'A branch is required.'; END IF;
    EXECUTE format('SELECT %I.org_can_access_branch($1)', v_schema)
        INTO v_branch_allowed USING v_branch_id;
    IF NOT COALESCE(v_branch_allowed, false) THEN RAISE EXCEPTION 'Branch access denied.'; END IF;

    IF NULLIF(BTRIM(p_member->>'name'), '') IS NULL
       OR NULLIF(BTRIM(p_member->>'nationalId'), '') IS NULL
       OR NULLIF(BTRIM(p_member->>'phone'), '') IS NULL THEN
        RAISE EXCEPTION 'Name, national ID, and phone are required.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_member->'activeLoans', '[]'::JSONB))
    ) THEN
        RAISE EXCEPTION 'Loan facilities cannot be created through member onboarding.';
    END IF;

    v_member_id := 'MEM-' || UPPER(SUBSTRING(REPLACE(uuid_generate_v4()::TEXT, '-', '') FROM 1 FOR 12));
    EXECUTE format($sql$
        INSERT INTO %1$I.members AS inserted (
            id, name, "nationalId", phone, email, "joinDate", "branchId", "branchName",
            "kycStatus", occupation, employer, "riskSegment", "relationshipScore",
            "savingsBalance", "fixedDepositBalance", "shareCapital", "activeLoans", "guarantorCommitments"
        )
        SELECT $1, BTRIM($2->>'name'), BTRIM($2->>'nationalId'), BTRIM($2->>'phone'),
            NULLIF(BTRIM($2->>'email'), ''), CURRENT_DATE::TEXT, branch.id, branch.name,
            'Verified (New Onboarding)', COALESCE(NULLIF(BTRIM($2->>'occupation'), ''), 'Retail Client'),
            COALESCE(NULLIF(BTRIM($2->>'employer'), ''), 'Self'), 'Low Risk', 50, 0, 0, 0, '[]'::JSONB, '[]'::JSONB
        FROM %1$I.branches AS branch
        WHERE branch.id = $3
        RETURNING to_jsonb(inserted)
    $sql$, v_schema) INTO v_member USING v_member_id, p_member, v_branch_id;
    IF v_member IS NULL THEN RAISE EXCEPTION 'Member was not created.'; END IF;

    EXECUTE format($sql$
        INSERT INTO %1$I.audit_trail
            (id, timestamp, "userId", "userName", action, module, "entityId", description, "ipAddress", "glImpact")
        SELECT 'AUD-' || uuid_generate_v4()::TEXT, NOW()::TEXT, operator.id, operator.name,
            'MEMBER_ONBOARDED', 'Core Banking', $1,
            'Onboarded member ' || BTRIM($2->>'name'), NULL, 'None (Account Created)'
        FROM %1$I.users AS operator
        WHERE operator.id = $3
    $sql$, v_schema) USING v_member_id, p_member, v_user_id;

    RETURN v_member;
EXCEPTION
    WHEN unique_violation THEN RAISE EXCEPTION 'A member with this identifier already exists.';
END;
$$;

CREATE OR REPLACE FUNCTION public.post_tenant_financial_transaction(
    p_org_id TEXT,
    p_type TEXT,
    p_member_id TEXT,
    p_loan_id TEXT,
    p_amount NUMERIC,
    p_channel TEXT,
    p_description TEXT,
    p_legs JSONB,
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
    v_teller_id TEXT;
    v_permission_counter BOOLEAN;
    v_permission_journal BOOLEAN;
    v_permission_read_all BOOLEAN;
    v_member JSONB;
    v_member_name TEXT;
    v_branch JSONB;
    v_branch_name TEXT;
    v_tx_id TEXT;
    v_audit_id TEXT;
    v_debits NUMERIC := 0;
    v_credits NUMERIC := 0;
    v_leg JSONB;
    v_gl JSONB;
    v_gl_normal TEXT;
    v_gl_code TEXT;
    v_leg_type TEXT;
    v_leg_amount NUMERIC;
    v_delta NUMERIC;
    v_cash_delta NUMERIC := 0;
    v_savings_delta NUMERIC := 0;
    v_loan_found BOOLEAN := false;
    v_has_user_till BOOLEAN := false;
    v_till_count INTEGER := 0;
    v_loan_outstanding NUMERIC;
    v_tx JSONB;
    v_dedupe_key TEXT := NULLIF(BTRIM(p_idempotency_key), '');
BEGIN
    SELECT schema_name INTO v_schema
    FROM public.organizations
    WHERE id = p_org_id AND status = 'active'
      AND schema_name ~ '^org_[a-z0-9_]+$'
    FOR SHARE;
    IF v_schema IS NULL THEN RAISE EXCEPTION 'Active organization not found.'; END IF;

    EXECUTE format(
        'SELECT id, name, "branchId", "tellerId",
                %1$I.org_has_permission(''POST_COUNTER_TX''),
                %1$I.org_has_permission(''MODIFY_GL_JOURNAL''),
                %1$I.org_has_permission(''READ_ALL_MODULES'')
         FROM %1$I.users WHERE auth_uid = auth.uid() AND status = ''Active''',
        v_schema
    ) INTO v_user_id, v_user_name, v_user_branch, v_teller_id,
        v_permission_counter, v_permission_journal, v_permission_read_all;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'An active organization user is required.'; END IF;

    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 999999999999
       OR p_legs IS NULL OR jsonb_typeof(p_legs) <> 'array'
       OR jsonb_array_length(p_legs) <> 2 THEN
        RAISE EXCEPTION 'A positive amount and exactly two posting legs are required.';
    END IF;
    IF v_dedupe_key IS NULL OR v_dedupe_key !~ '^[A-Za-z0-9:_-]{8,100}$' THEN
        RAISE EXCEPTION 'A valid idempotency key is required for financial posting.';
    END IF;
    IF p_type = 'Manual GL Journal' THEN
        IF NOT COALESCE(v_permission_journal, false) THEN RAISE EXCEPTION 'Manual GL journal permission is required.'; END IF;
    ELSIF p_type IN ('Teller Deposit', 'Teller Withdrawal', 'Teller Loan Payment',
                     'Member Deposit', 'Member Withdrawal', 'Loan Repayment') THEN
        IF NOT COALESCE(v_permission_counter, false) THEN RAISE EXCEPTION 'Counter transaction permission is required.'; END IF;
        IF v_user_branch IS NULL THEN RAISE EXCEPTION 'Operator has no assigned branch.'; END IF;
        IF p_member_id IS NULL THEN RAISE EXCEPTION 'Select a member.'; END IF;
    ELSE
        RAISE EXCEPTION 'This transaction type is not enabled for online posting.';
    END IF;

    IF v_dedupe_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(p_org_id || ':' || v_dedupe_key, 0));
        EXECUTE format('SELECT to_jsonb(tx) FROM %I.transactions AS tx WHERE tx.id = $1', v_schema)
            INTO v_tx USING 'TX-' || v_dedupe_key;
        IF v_tx IS NOT NULL THEN
            IF v_tx->>'postedBy' <> v_user_id
               OR v_tx->>'type' <> p_type
               OR (v_tx->>'amount')::NUMERIC <> p_amount
               OR COALESCE(v_tx->>'memberId', '') <> COALESCE(p_member_id, '')
               OR COALESCE(v_tx->>'loanId', '') <> COALESCE(p_loan_id, '')
               OR COALESCE(v_tx->>'batchId', '') <> v_dedupe_key THEN
                RAISE EXCEPTION 'Idempotency key was already used for a different posting.';
            END IF;
            RETURN v_tx;
        END IF;
    END IF;

    IF p_member_id IS NOT NULL THEN
        EXECUTE format('SELECT to_jsonb(member) FROM %I.members AS member WHERE member.id = $1 FOR UPDATE', v_schema)
            INTO v_member USING p_member_id;
        IF v_member IS NULL THEN RAISE EXCEPTION 'Member not found.'; END IF;
        IF (v_member->>'branchId') IS DISTINCT FROM v_user_branch AND NOT COALESCE(v_permission_read_all, false) THEN
            RAISE EXCEPTION 'Member is outside the operator branch.';
        END IF;
        v_member_name := v_member->>'name';
        v_branch_name := v_member->>'branchName';
    END IF;

    IF p_type IN ('Teller Deposit', 'Teller Withdrawal', 'Teller Loan Payment') THEN
        v_branch_name := COALESCE(v_branch_name, '');
        IF (SELECT COUNT(*) FROM jsonb_array_elements(p_legs)) <> 2 THEN
            RAISE EXCEPTION 'Counter postings require exactly two legs.';
        END IF;
        IF p_type = 'Teller Deposit' AND NOT (
            p_legs @> '[{"glCode":"1010","type":"Debit"}]'::JSONB
            AND p_legs @> '[{"glCode":"2010","type":"Credit"}]'::JSONB
        ) THEN RAISE EXCEPTION 'Teller deposit must debit 1010 and credit 2010.'; END IF;
        IF p_type = 'Teller Withdrawal' AND NOT (
            p_legs @> '[{"glCode":"2010","type":"Debit"}]'::JSONB
            AND p_legs @> '[{"glCode":"1010","type":"Credit"}]'::JSONB
        ) THEN RAISE EXCEPTION 'Teller withdrawal must debit 2010 and credit 1010.'; END IF;
        IF p_type = 'Teller Loan Payment' AND NOT (
            p_legs @> '[{"glCode":"1010","type":"Debit"}]'::JSONB
            AND p_legs @> '[{"glCode":"1200","type":"Credit"}]'::JSONB
        ) THEN RAISE EXCEPTION 'Teller loan payment must debit 1010 and credit 1200.'; END IF;
    ELSIF p_type = 'Member Deposit' AND NOT (
        p_legs @> '[{"glCode":"1010","type":"Debit"}]'::JSONB
        AND p_legs @> '[{"glCode":"2010","type":"Credit"}]'::JSONB
    ) THEN RAISE EXCEPTION 'Member deposit must debit 1010 and credit 2010.';
    ELSIF p_type = 'Member Withdrawal' AND NOT (
        p_legs @> '[{"glCode":"2010","type":"Debit"}]'::JSONB
        AND p_legs @> '[{"glCode":"1010","type":"Credit"}]'::JSONB
    ) THEN RAISE EXCEPTION 'Member withdrawal must debit 2010 and credit 1010.';
    ELSIF p_type = 'Loan Repayment' AND NOT (
        p_legs @> '[{"glCode":"1010","type":"Debit"}]'::JSONB
        AND p_legs @> '[{"glCode":"1200","type":"Credit"}]'::JSONB
    ) THEN RAISE EXCEPTION 'Loan repayment must debit 1010 and credit 1200.';
    END IF;

    FOR v_leg IN SELECT value FROM jsonb_array_elements(p_legs)
    LOOP
        v_gl_code := v_leg->>'glCode';
        v_leg_type := v_leg->>'type';
        BEGIN
            v_leg_amount := (v_leg->>'amount')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Posting leg amount must be numeric.'; END;
        IF v_gl_code IS NULL OR v_leg_type NOT IN ('Debit', 'Credit')
           OR v_leg_amount IS NULL OR v_leg_amount <= 0 THEN
            RAISE EXCEPTION 'Invalid posting leg.';
        END IF;
        IF v_leg_type = 'Debit' THEN v_debits := v_debits + v_leg_amount;
        ELSE v_credits := v_credits + v_leg_amount; END IF;

        EXECUTE format('SELECT to_jsonb(gl) FROM %I.general_ledger AS gl WHERE code = $1 FOR UPDATE', v_schema)
            INTO v_gl USING v_gl_code;
        IF v_gl IS NULL THEN RAISE EXCEPTION 'GL account % does not exist.', v_gl_code; END IF;
        v_gl_normal := v_gl->>'normal';
        IF v_gl_normal NOT IN ('Debit', 'Credit') THEN RAISE EXCEPTION 'GL account % has invalid normal balance.', v_gl_code; END IF;
        IF v_gl_normal = 'Debit' THEN
            v_delta := CASE WHEN v_leg_type = 'Debit' THEN v_leg_amount ELSE -v_leg_amount END;
        ELSE
            v_delta := CASE WHEN v_leg_type = 'Credit' THEN v_leg_amount ELSE -v_leg_amount END;
        END IF;
        EXECUTE format('UPDATE %I.general_ledger SET balance = COALESCE(balance, 0) + $1 WHERE code = $2', v_schema)
            USING v_delta, v_gl_code;
        IF v_gl_code = '1010' AND p_type <> 'Manual GL Journal' THEN
            v_cash_delta := v_cash_delta + CASE WHEN v_leg_type = 'Debit' THEN v_leg_amount ELSE -v_leg_amount END;
        END IF;
    END LOOP;
    IF ABS(v_debits - v_credits) > 0.0001 THEN
        RAISE EXCEPTION 'Unbalanced transaction: debit % does not equal credit %.', v_debits, v_credits;
    END IF;
    IF ABS(v_debits - p_amount) > 0.0001 THEN
        RAISE EXCEPTION 'Posting total must equal the transaction amount.';
    END IF;

    IF p_member_id IS NOT NULL THEN
        IF p_type IN ('Teller Deposit', 'Member Deposit') THEN
            v_savings_delta := p_amount;
        ELSIF p_type IN ('Teller Withdrawal', 'Member Withdrawal') THEN
            v_savings_delta := -p_amount;
        ELSIF p_type IN ('Teller Loan Payment', 'Loan Repayment') THEN
            IF p_loan_id IS NULL THEN RAISE EXCEPTION 'Choose the loan being repaid.'; END IF;
            IF NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(COALESCE(v_member->'activeLoans', '[]'::JSONB)) loan
                WHERE loan->>'loanId' = p_loan_id OR loan->>'id' = p_loan_id
            ) THEN RAISE EXCEPTION 'Loan does not belong to this member.'; END IF;
            SELECT (loan->>'outstandingBalance')::NUMERIC INTO v_loan_outstanding
            FROM jsonb_array_elements(COALESCE(v_member->'activeLoans', '[]'::JSONB)) loan
            WHERE loan->>'loanId' = p_loan_id OR loan->>'id' = p_loan_id
            LIMIT 1;
            IF p_amount > COALESCE(v_loan_outstanding, 0) THEN
                RAISE EXCEPTION 'Repayment exceeds the loan outstanding balance.';
            END IF;
            v_loan_found := true;
        END IF;
        IF v_savings_delta < 0 AND (COALESCE((v_member->>'savingsBalance')::NUMERIC, 0) < p_amount) THEN
            RAISE EXCEPTION 'Insufficient member savings balance.';
        END IF;
    END IF;

    IF v_cash_delta <> 0 THEN
        EXECUTE format('SELECT to_jsonb(branch) FROM %I.branches AS branch WHERE id = $1 FOR UPDATE', v_schema)
            INTO v_branch USING v_user_branch;
        IF v_branch IS NULL THEN RAISE EXCEPTION 'Operator branch not found.'; END IF;
        v_has_user_till := EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(v_branch->'tillBalances', '[]'::JSONB)) till
            WHERE till->>'userId' = v_user_id
        );
        SELECT COUNT(*) INTO v_till_count
        FROM jsonb_array_elements(COALESCE(v_branch->'tillBalances', '[]'::JSONB)) till
        WHERE (v_has_user_till AND till->>'userId' = v_user_id)
           OR (NOT v_has_user_till AND v_teller_id IS NOT NULL AND till->>'tellerId' = v_teller_id);
        IF v_till_count > 1 THEN RAISE EXCEPTION 'Operator has ambiguous till assignments.'; END IF;
        IF v_cash_delta < 0 AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(v_branch->'tillBalances', '[]'::JSONB)) till
            WHERE ((v_has_user_till AND till->>'userId' = v_user_id)
                OR (NOT v_has_user_till AND v_teller_id IS NOT NULL AND till->>'tellerId' = v_teller_id))
              AND COALESCE((till->>'balance')::NUMERIC, 0) < ABS(v_cash_delta)
        ) THEN RAISE EXCEPTION 'Insufficient teller till cash.'; END IF;
        EXECUTE format($sql$
            UPDATE %1$I.branches AS branch
            SET "tillBalances" = CASE
                WHEN EXISTS (
                    SELECT 1 FROM jsonb_array_elements(COALESCE(branch."tillBalances", '[]'::JSONB)) t
                    WHERE ($5 AND t->>'userId' = $2)
                       OR (NOT $5 AND $4 IS NOT NULL AND t->>'tellerId' = $4)
                ) THEN (
                    SELECT jsonb_agg(
                        CASE WHEN ($5 AND t->>'userId' = $2)
                                  OR (NOT $5 AND $4 IS NOT NULL AND t->>'tellerId' = $4) THEN
                            jsonb_set(jsonb_set(t, '{balance}',
                                to_jsonb(GREATEST(0, COALESCE((t->>'balance')::NUMERIC, 0) + $3)), true),
                                '{status}', to_jsonb('Intraday Active'::TEXT), true)
                        ELSE t END
                    ) FROM jsonb_array_elements(COALESCE(branch."tillBalances", '[]'::JSONB)) t
                )
                ELSE branch."tillBalances"
            END,
            "cashInVault" = CASE
                WHEN EXISTS (
                    SELECT 1 FROM jsonb_array_elements(COALESCE(branch."tillBalances", '[]'::JSONB)) t
                    WHERE ($5 AND t->>'userId' = $2)
                       OR (NOT $5 AND $4 IS NOT NULL AND t->>'tellerId' = $4)
                ) THEN branch."cashInVault"
                ELSE COALESCE(branch."cashInVault", 0) + $3
            END
            WHERE branch.id = $1
        $sql$, v_schema) USING v_user_branch, v_user_id, v_cash_delta, v_teller_id, v_has_user_till;
    END IF;

    IF v_member IS NOT NULL THEN
        IF v_savings_delta <> 0 THEN
            EXECUTE format('UPDATE %I.members SET "savingsBalance" = COALESCE("savingsBalance",0) + $1 WHERE id = $2', v_schema)
                USING v_savings_delta, p_member_id;
        END IF;
    END IF;

    v_tx_id := 'TX-' || COALESCE(v_dedupe_key, REPLACE(uuid_generate_v4()::TEXT, '-', ''));
    EXECUTE format($sql$
        INSERT INTO %1$I.transactions AS inserted (
            id, date, type, status, channel, "memberId", "memberName", amount, details,
            approver, "approverRole", "glDebit", "glCredit", "batchId", "postedBy", "branchId", "loanId"
        )
        VALUES (
            $1, NOW()::TEXT, $2, 'Completed', COALESCE($3, 'Branch FOSA'),
            $4, $5, $6, $7, NULL, NULL,
            (SELECT leg->>'glCode' FROM jsonb_array_elements($8) leg WHERE leg->>'type' = 'Debit' LIMIT 1),
            (SELECT leg->>'glCode' FROM jsonb_array_elements($8) leg WHERE leg->>'type' = 'Credit' LIMIT 1),
            $9, $10, $11, $12
        )
        RETURNING to_jsonb(inserted)
    $sql$, v_schema)
    INTO v_tx
    USING v_tx_id, p_type, p_channel, p_member_id, v_member_name, p_amount,
          COALESCE(p_description, p_type), p_legs, v_dedupe_key, v_user_id, v_user_branch, p_loan_id;

    IF v_loan_found THEN
        EXECUTE format($sql$
            UPDATE %1$I.members AS member
            SET "activeLoans" = (
                SELECT jsonb_agg(
                    CASE WHEN loan->>'loanId' = $2 OR loan->>'id' = $2 THEN
                        jsonb_set(
                            jsonb_set(loan, '{outstandingBalance}',
                                to_jsonb(GREATEST(0, COALESCE((loan->>'outstandingBalance')::NUMERIC, 0) - $3)), true),
                            '{paymentHistory}',
                            COALESCE(loan->'paymentHistory', '[]'::JSONB) ||
                                jsonb_build_array(jsonb_build_object(
                                    'transactionId', $4, 'amount', $3, 'postedAt', NOW(), 'channel', $5
                                )),
                            true
                        )
                    ELSE loan END
                )
                FROM jsonb_array_elements(COALESCE(member."activeLoans", '[]'::JSONB)) loan
            )
            WHERE member.id = $1
        $sql$, v_schema)
        USING p_member_id, p_loan_id, p_amount, v_tx_id, COALESCE(p_channel, '');
    END IF;

    v_audit_id := 'AUD-' || uuid_generate_v4()::TEXT;
    EXECUTE format($sql$
        INSERT INTO %1$I.audit_trail
            (id, timestamp, "userId", "userName", action, module, "entityId",
             description, "ipAddress", "glImpact")
        VALUES (
            $1, NOW()::TEXT, $2, $3, UPPER(REGEXP_REPLACE($4, '\s+', '_', 'g')),
            'Online Core Banking', $5, $6, NULL, $7
        )
    $sql$, v_schema)
    USING v_audit_id, v_user_id, v_user_name, p_type, v_tx_id,
          COALESCE(p_description, p_type),
          (SELECT string_agg(
              CASE WHEN leg->>'type' = 'Debit' THEN 'Dr ' ELSE 'Cr ' END ||
              (leg->>'glCode') || ' ' || (leg->>'amount'), ' / '
           ) FROM jsonb_array_elements(p_legs) leg);

    RETURN v_tx || jsonb_build_object('auditId', v_audit_id);
END;
$$;

REVOKE ALL ON FUNCTION public.online_write_capabilities(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_tenant_member(TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_tenant_financial_transaction(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.online_write_capabilities(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_member(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_tenant_financial_transaction(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
