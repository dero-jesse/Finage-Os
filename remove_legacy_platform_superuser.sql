-- Remove the legacy superuser created by direct auth.users SQL inserts.
-- Run in Supabase SQL Editor only if deleting this account in the Dashboard fails.
-- Afterward, recreate it in Authentication > Users, then run
-- seed_platform_superuser.sql to grant platform access.

BEGIN;

UPDATE public.organizations
SET created_by = NULL
WHERE created_by IN (
  SELECT id FROM auth.users WHERE lower(email) = 'superuser@finage.io'
);

DELETE FROM public.platform_superusers
WHERE lower(email) = 'superuser@finage.io';

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'superuser@finage.io'
);

DELETE FROM auth.users
WHERE lower(email) = 'superuser@finage.io';

COMMIT;

SELECT id, email
FROM auth.users
WHERE lower(email) = 'superuser@finage.io';