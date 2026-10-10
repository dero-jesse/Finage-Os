-- Explicit role-based write authorization.
-- READ_ALL_MODULES remains read-only; only roles explicitly granted
-- WRITE_ALL_MODULES receive every server-authorized write capability.

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN
        SELECT schema_name
        FROM public.organizations
        WHERE status = 'active' AND schema_name ~ '^org_[a-z0-9_]+$'
    LOOP
        IF to_regclass(format('%I.roles', tenant.schema_name)) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format($sql$
            UPDATE %1$I.roles
            SET permissions = COALESCE(permissions, '[]'::JSONB) || '["WRITE_ALL_MODULES"]'::JSONB
            WHERE id = 'ROLE-ADMIN'
              AND NOT COALESCE(permissions, '[]'::JSONB) @> '["WRITE_ALL_MODULES"]'::JSONB
        $sql$, tenant.schema_name);

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
                      AND (
                          r.permissions @> jsonb_build_array(p_permission)
                          OR r.permissions @> '["WRITE_ALL_MODULES"]'::JSONB
                      )
                );
            $fn$
        $ddl$, tenant.schema_name);

        EXECUTE format(
            'REVOKE ALL ON FUNCTION %I.org_has_permission(TEXT) FROM PUBLIC, anon',
            tenant.schema_name
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %I.org_has_permission(TEXT) TO authenticated, service_role',
            tenant.schema_name
        );
    END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
