-- FINAGE OS — TENANT GO-LIVE CLEAN SLATE
-- Clears operational/demo data only for the explicitly selected active org.
-- Preserves organization records, staff users, roles, branches, and GL accounts.
-- Set v_org_id before running. Run once before real operations begin.

DO $$
DECLARE
  v_org_id TEXT := NULL;
  v_schema TEXT;
  v_active_org_count INTEGER;
  v_active_org_ids TEXT;
  v_members BIGINT;
  v_transactions BIGINT;
  v_audit BIGINT;
BEGIN
  IF v_org_id IS NULL OR v_org_id = '' THEN
    SELECT COUNT(*), string_agg(id, ', ' ORDER BY id)
    INTO v_active_org_count, v_active_org_ids
    FROM public.organizations
    WHERE status = 'active';

    IF v_active_org_count = 0 THEN
      RAISE EXCEPTION 'No active organization exists. Provision an organization before go-live cleanup.';
    ELSIF v_active_org_count > 1 THEN
      RAISE EXCEPTION 'Multiple active organizations found (%). Set v_org_id explicitly. Active IDs: %',
        v_active_org_count, v_active_org_ids;
    END IF;

    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE status = 'active'
    LIMIT 1;
  END IF;

  SELECT schema_name INTO v_schema
  FROM public.organizations
  WHERE id = v_org_id AND status = 'active';

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'No active organization found for id %.', v_org_id;
  END IF;

  EXECUTE format('DELETE FROM %I.audit_trail', v_schema);
  EXECUTE format('DELETE FROM %I.transactions', v_schema);
  EXECUTE format('DELETE FROM %I.members', v_schema);
  EXECUTE format('UPDATE %I.general_ledger SET balance = 0', v_schema);
  EXECUTE format($sql$
    UPDATE %I.branches
    SET "cashInVault" = 0,
        "reconciliationDiscrepancy" = 0,
        "tillBalances" = COALESCE((
          SELECT jsonb_agg(till || '{"balance": 0, "status": "Pending Open"}'::jsonb)
          FROM jsonb_array_elements(COALESCE("tillBalances", '[]'::jsonb)) AS till
        ), '[]'::jsonb),
        "lastReconciledAt" = NOW()::TEXT
  $sql$, v_schema);

  EXECUTE format($sql$
    INSERT INTO %I.audit_trail (
      id, timestamp, "userId", "userName", action, module, "entityId",
      description, "ipAddress", "glImpact"
    ) VALUES (
      $1, NOW()::TEXT, 'SYSTEM', 'System', 'SYSTEM_GO_LIVE',
      'System Administration', $2,
      'Tenant operational demo data purged before real operations.',
      '127.0.0.1', 'GL balances and branch cash reset to zero'
    )
    ON CONFLICT (id) DO NOTHING
  $sql$, v_schema)
  USING 'AUD-GOLIVE-' || to_char(NOW(), 'YYYYMMDD'), v_org_id;

  EXECUTE format('SELECT COUNT(*) FROM %I.members', v_schema) INTO v_members;
  EXECUTE format('SELECT COUNT(*) FROM %I.transactions', v_schema) INTO v_transactions;
  EXECUTE format('SELECT COUNT(*) FROM %I.audit_trail', v_schema) INTO v_audit;

  RAISE NOTICE 'Go-live cleanup complete for org % (schema %): members %, transactions %, audit events %.',
    v_org_id, v_schema, v_members, v_transactions, v_audit;
END;
$$;