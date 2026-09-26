-- FINAGE OS - SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Roles Table
CREATE TABLE public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    permissions JSONB DEFAULT '[]'::JSONB
);

-- 2. Branches Table
CREATE TABLE public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    "tellerCount" INTEGER,
    "vaultLimit" NUMERIC DEFAULT 0.00,
    "cashInVault" NUMERIC DEFAULT 0.00,
    "tillBalances" JSONB DEFAULT '[]'::JSONB,
    "lastReconciledAt" TEXT,
    "reconciliationDiscrepancy" NUMERIC DEFAULT 0.00,
    status TEXT DEFAULT 'Active'
);

-- 3. Users Table (System Operators)
CREATE TABLE public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    roles JSONB DEFAULT '[]'::JSONB,
    "branchId" TEXT,
    "branchName" TEXT,
    "singleApprovalLimit" NUMERIC DEFAULT 0.00,
    "dailyApprovalLimit" NUMERIC DEFAULT 0.00,
    status TEXT DEFAULT 'Active',
    "mfaEnabled" BOOLEAN DEFAULT true,
    "lastLogin" TEXT
);

-- 4. Members Table (Customers)
CREATE TABLE public.members (
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
    "savingsBalance" NUMERIC DEFAULT 0.00,
    "fixedDepositBalance" NUMERIC DEFAULT 0.00,
    "shareCapital" NUMERIC DEFAULT 0.00,
    "activeLoans" JSONB DEFAULT '[]'::JSONB,
    "guarantorCommitments" JSONB DEFAULT '[]'::JSONB
);

-- 5. General Ledger Table
CREATE TABLE public.general_ledger (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    balance NUMERIC DEFAULT 0.00,
    normal TEXT NOT NULL
);

-- 6. Transactions Table
CREATE TABLE public.transactions (
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
    "batchId" TEXT
);

-- 7. Audit Trail Table
CREATE TABLE public.audit_trail (
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
);

-- Turn on Realtime for relevant tables
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.general_ledger;
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.audit_trail;

-- Disable Row Level Security (RLS) so the frontend can read/write during testing
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anon (in case public privileges were revoked)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
