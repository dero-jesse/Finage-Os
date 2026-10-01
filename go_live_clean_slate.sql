-- ============================================================
-- FINAGE OS — GO-LIVE CLEAN SLATE
-- Clears ALL demo/simulation data from Supabase while
-- preserving staff users, roles, and branch structure.
--
-- Run AFTER seed_admin_user.sql and supabase_schema.sql.
-- Run this ONCE before starting real operations.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────
-- 1. Wipe operational data (transactions, audit, members)
--    These are completely replaced by real data going forward.
-- ──────────────────────────────────────────────────────────
DELETE FROM public.audit_trail;
DELETE FROM public.transactions;
DELETE FROM public.members;

-- ──────────────────────────────────────────────────────────
-- 2. Zero out the General Ledger balances
--    All accounts start at 0 — real opening entries are posted
--    manually as journal entries by the Treasury officer.
-- ──────────────────────────────────────────────────────────
UPDATE public.general_ledger SET balance = 0;

-- ──────────────────────────────────────────────────────────
-- 3. Zero out branch vaults and till floats
--    Tellers will receive their opening floats from the vault
--    at the start of the first real business day.
-- ──────────────────────────────────────────────────────────
UPDATE public.branches SET
  "cashInVault" = 0,
  "reconciliationDiscrepancy" = 0,
  "tillBalances" = (
    -- Keep the teller names/IDs but zero all balances
    SELECT jsonb_agg(
      till || '{"balance": 0, "status": "Pending Open"}'::jsonb
    )
    FROM jsonb_array_elements("tillBalances") AS till
  ),
  "lastReconciledAt" = NOW()::TEXT;

-- ──────────────────────────────────────────────────────────
-- 4. Keep roles intact (do not wipe — needed for RLS)
-- ──────────────────────────────────────────────────────────
-- (no action — roles are structural, not operational data)

-- ──────────────────────────────────────────────────────────
-- 5. Keep staff users intact
--    Only remove the demo member-user (if still present)
-- ──────────────────────────────────────────────────────────
DELETE FROM public.users WHERE email = 'sarah.kamau@barakafarms.co.ke';

-- ──────────────────────────────────────────────────────────
-- 6. Insert a system audit event marking the go-live
-- ──────────────────────────────────────────────────────────
INSERT INTO public.audit_trail (
  id, timestamp, "userId", "userName",
  action, module, "entityId", description, "ipAddress", "glImpact"
) VALUES (
  'AUD-GOLIVE-' || to_char(NOW(), 'YYYYMMDD'),
  NOW()::TEXT,
  'USR-001',
  'System Administrator',
  'SYSTEM_GO_LIVE',
  'System Administration',
  'INST-001',
  'Finage OS production go-live: all demo data purged, real operations commenced.',
  '127.0.0.1',
  'All GL accounts zeroed — opening balances to be posted by Treasury'
);

COMMIT;

-- ──────────────────────────────────────────────────────────
-- VERIFICATION — run these after the script completes
-- ──────────────────────────────────────────────────────────
SELECT 'members'     AS table_name, COUNT(*) AS rows FROM public.members
UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'audit_trail',  COUNT(*) FROM public.audit_trail
UNION ALL
SELECT 'users',        COUNT(*) FROM public.users
UNION ALL
SELECT 'branches',     COUNT(*) FROM public.branches
UNION ALL
SELECT 'general_ledger', COUNT(*) FROM public.general_ledger;

-- Expected result:
--   members       → 0
--   transactions  → 0
--   audit_trail   → 1  (the go-live event)
--   users         → N  (your real staff count)
--   branches      → 5  (branch structure intact)
--   general_ledger → 20 (COA intact, all balances = 0)
