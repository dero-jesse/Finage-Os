-- One-time cleanup for the retired demo System Admin account.
-- This does not remove ROLE-ADMIN; each organization still needs that role.
BEGIN;

DELETE FROM public.users
WHERE lower(email) = 'admin@finage.co.ug';

DELETE FROM auth.users
WHERE lower(email) = 'admin@finage.co.ug';

COMMIT;