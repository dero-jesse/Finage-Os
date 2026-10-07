-- Finage OS online data foundation migration
-- Apply this file in Supabase SQL Editor to an existing installation.
-- It revokes direct browser DML and adds a guarded, one-time legacy import RPC.

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN
        SELECT schema_name
        FROM public.organizations
        WHERE status = 'active' AND schema_name ~ '^org_[a-z0-9_]+$'
    LOOP
        EXECUTE format(
            'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA %I FROM authenticated',
            tenant.schema_name
        );
        EXECUTE format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I
             REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM authenticated',
            tenant.schema_name
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tenant_setup(TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.import_legacy_tenant_state(
    p_org_id TEXT,
    p_org_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_schema TEXT;
    v_can_manage BOOLEAN;
    v_has_data BOOLEAN;
    v_batch_id TEXT;
BEGIN
    SELECT schema_name INTO v_schema
    FROM public.organizations
    WHERE id = p_org_id AND status = 'active'
    FOR UPDATE;
    IF v_schema IS NULL OR v_schema !~ '^org_[a-z0-9_]+$' THEN
        RAISE EXCEPTION 'Active organization not found.';
    END IF;

    EXECUTE format('SELECT %I.org_has_permission(''MANAGE_USERS'')', v_schema)
    INTO v_can_manage;
    IF NOT COALESCE(v_can_manage, false) THEN
        RAISE EXCEPTION 'Organization administrator permission required for legacy import.';
    END IF;

    IF jsonb_typeof(COALESCE(p_org_data->'branches', '[]'::JSONB)) <> 'array'
       OR jsonb_array_length(COALESCE(p_org_data->'branches', '[]'::JSONB)) = 0 THEN
        RAISE EXCEPTION 'Legacy import requires at least one branch.';
    END IF;

    IF to_regclass(format('%I.branches', v_schema)) IS NULL
       OR to_regclass(format('%I.general_ledger', v_schema)) IS NULL
       OR to_regclass(format('%I.members', v_schema)) IS NULL
       OR to_regclass(format('%I.transactions', v_schema)) IS NULL
       OR to_regclass(format('%I.audit_trail', v_schema)) IS NULL
       OR to_regclass(format('%I.migration_batches', v_schema)) IS NULL THEN
        RAISE EXCEPTION 'Tenant operational schema is incomplete.';
    END IF;
    EXECUTE format(
        'LOCK TABLE %1$I.branches, %1$I.general_ledger, %1$I.members,
            %1$I.transactions, %1$I.audit_trail, %1$I.migration_batches
         IN ACCESS EXCLUSIVE MODE',
        v_schema
    );

    EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %1$I.branches)
            OR EXISTS (SELECT 1 FROM %1$I.general_ledger)
            OR EXISTS (SELECT 1 FROM %1$I.members)
            OR EXISTS (SELECT 1 FROM %1$I.transactions)
            OR EXISTS (SELECT 1 FROM %1$I.audit_trail)
            OR EXISTS (SELECT 1 FROM %1$I.migration_batches)',
        v_schema
    ) INTO v_has_data;
    IF v_has_data THEN
        RAISE EXCEPTION 'Import refused: this organization already contains operational data or an import batch.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(COALESCE(p_org_data->'branches', '[]'::JSONB)) AS item(id TEXT)
        GROUP BY id HAVING COUNT(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM jsonb_to_recordset(COALESCE(p_org_data->'glAccounts', '[]'::JSONB)) AS item(code TEXT)
        GROUP BY code HAVING COUNT(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM jsonb_to_recordset(COALESCE(p_org_data->'members', '[]'::JSONB)) AS item(id TEXT)
        GROUP BY id HAVING COUNT(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM jsonb_to_recordset(COALESCE(p_org_data->'members', '[]'::JSONB)) AS item("nationalId" TEXT)
        GROUP BY "nationalId" HAVING COUNT(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM jsonb_to_recordset(COALESCE(p_org_data->'transactions', '[]'::JSONB)) AS item(id TEXT)
        GROUP BY id HAVING COUNT(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM jsonb_to_recordset(COALESCE(p_org_data->'auditTrail', '[]'::JSONB)) AS item(id TEXT)
        GROUP BY id HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Import refused: duplicate identifiers exist in the selected browser records.';
    END IF;

    v_batch_id := COALESCE(NULLIF(p_org_data->>'migrationBatchId', ''), 'LEGACY-' || uuid_generate_v4()::TEXT);
    PERFORM public.apply_tenant_setup(p_org_id, p_org_data, true);

    EXECUTE format($sql$
        UPDATE %1$I.branches AS branch
        SET "cashInVault" = COALESCE(imported."cashInVault", branch."cashInVault"),
            "tillBalances" = COALESCE(imported."tillBalances", branch."tillBalances"),
            "lastReconciledAt" = COALESCE(imported."lastReconciledAt", branch."lastReconciledAt"),
            "reconciliationDiscrepancy" = COALESCE(imported."reconciliationDiscrepancy", branch."reconciliationDiscrepancy")
        FROM jsonb_to_recordset($1) AS imported(
            id TEXT, "cashInVault" NUMERIC, "tillBalances" JSONB,
            "lastReconciledAt" TEXT, "reconciliationDiscrepancy" NUMERIC
        )
        WHERE branch.id = imported.id
    $sql$, v_schema)
    USING COALESCE(p_org_data->'branches', '[]'::JSONB);

    EXECUTE format($sql$
        UPDATE %1$I.transactions AS tx
        SET approver = imported.approver,
            "approverRole" = imported."approverRole",
            "batchId" = imported."batchId",
            "postedBy" = imported."postedBy"
        FROM jsonb_to_recordset($1) AS imported(
            id TEXT, approver TEXT, "approverRole" TEXT, "batchId" TEXT, "postedBy" TEXT
        )
        WHERE tx.id = imported.id
    $sql$, v_schema)
    USING COALESCE(p_org_data->'transactions', '[]'::JSONB);

    EXECUTE format($sql$
        INSERT INTO %1$I.audit_trail (
            id, timestamp, "userId", "userName", action, module, "entityId",
            description, "ipAddress", "glImpact"
        )
        SELECT item.id, item.timestamp, item."userId", item."userName", item.action,
               item.module, item."entityId", item.description, item."ipAddress", item."glImpact"
        FROM jsonb_to_recordset($1) AS item(
            id TEXT, timestamp TEXT, "userId" TEXT, "userName" TEXT, action TEXT,
            module TEXT, "entityId" TEXT, description TEXT, "ipAddress" TEXT, "glImpact" TEXT
        )
    $sql$, v_schema)
    USING COALESCE(p_org_data->'auditTrail', '[]'::JSONB);

    EXECUTE format($sql$
        INSERT INTO %1$I.migration_batches
            (id, source_files, row_counts, control_totals, status, imported_by)
        VALUES ($1, COALESCE($2, '[]'::JSONB), COALESCE($3, '{}'::JSONB),
                COALESCE($4, '{}'::JSONB), 'completed', auth.uid())
    $sql$, v_schema)
    USING v_batch_id,
          p_org_data->'migrationSourceFiles',
          p_org_data->'migrationRowCounts',
          p_org_data->'migrationControlTotals';

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', p_org_id,
        'schema_name', v_schema,
        'migration_batch_id', v_batch_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.import_legacy_tenant_state(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_legacy_tenant_state(TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
