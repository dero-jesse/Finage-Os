-- Remove the empty Finage MFI ltd tenant so onboarding can be repeated.
-- This is intentionally tenant-specific and refuses to run if any tenant table
-- contains data or an external database object depends on it. It preserves the
-- platform registry, platform superusers, and Auth users outside this tenant.

DO $$
DECLARE
  v_org_id TEXT := 'finage';
  v_expected_name TEXT := 'Finage MFI ltd';
  v_schema TEXT;
  v_table TEXT;
  v_row_count BIGINT;
  v_setting TEXT;
  v_schemas TEXT[];
  v_exposed_schemas TEXT;
BEGIN
  SELECT schema_name INTO v_schema
  FROM public.organizations
  WHERE id = v_org_id AND name = v_expected_name AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND OR v_schema <> 'org_finage' THEN
    RAISE EXCEPTION 'Expected active tenant finage / % with schema org_finage; refusing reset.', v_expected_name;
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'roles', 'users', 'branches', 'members', 'general_ledger', 'transactions', 'audit_trail'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', v_schema, v_table) INTO v_row_count;
    IF v_row_count > 0 THEN
      RAISE EXCEPTION 'Tenant reset refused: %.% contains % rows.', v_schema, v_table, v_row_count;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_depend AS d
    JOIN pg_class AS target ON d.refclassid = 'pg_class'::REGCLASS AND d.refobjid = target.oid
    JOIN pg_namespace AS target_ns ON target_ns.oid = target.relnamespace
    CROSS JOIN LATERAL pg_identify_object(d.classid, d.objid, d.objsubid) AS dependent
    WHERE target_ns.nspname = v_schema
      AND dependent.schema IS NOT NULL
      AND dependent.schema <> v_schema
      AND dependent.schema <> 'pg_toast'
  ) THEN
    RAISE EXCEPTION 'Tenant reset refused: an object outside % depends on its tables.', v_schema;
  END IF;

  SELECT setting INTO v_setting
  FROM pg_roles AS r
  CROSS JOIN LATERAL unnest(COALESCE(r.rolconfig, ARRAY[]::TEXT[])) AS config(setting)
  WHERE r.rolname = 'authenticator' AND setting LIKE 'pgrst.db_schemas=%'
  LIMIT 1;

  IF v_setting IS NULL THEN
    v_schemas := ARRAY['public', 'graphql_public'];
  ELSE
    SELECT COALESCE(array_agg(DISTINCT btrim(exposed_schema) ORDER BY btrim(exposed_schema)), ARRAY[]::TEXT[])
    INTO v_schemas
    FROM unnest(string_to_array(substring(v_setting FROM length('pgrst.db_schemas=') + 1), ',')) AS exposed(exposed_schema)
    WHERE btrim(exposed_schema) <> v_schema
      AND btrim(exposed_schema) ~ '^[a-z_][a-z0-9_]*$';
    v_schemas := v_schemas || ARRAY['public', 'graphql_public'];
  END IF;

  SELECT string_agg(schema_name, ', ' ORDER BY schema_name)
  INTO v_exposed_schemas
  FROM (SELECT DISTINCT unnest(v_schemas) AS schema_name) AS exposed;

  EXECUTE format('DROP SCHEMA %I CASCADE', v_schema);
  DELETE FROM public.organizations WHERE id = v_org_id;

  EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', v_exposed_schemas);
  NOTIFY pgrst, 'reload config';
  NOTIFY pgrst, 'reload schema';
END;
$$;