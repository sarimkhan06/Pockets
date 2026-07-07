-- Pockets — database schema
-- Run this in your Supabase project's SQL editor to create all the tables the app needs.
-- user_id columns reference Supabase Auth users (auth.users.id).
--
-- Note: `date` on transactions is stored as a short display string (e.g. "Jul 6"),
-- not a real date type — that's how the app formats Plaid dates before saving.

-- ── plaid_items ────────────────────────────────────────────────
-- One row per user: their Plaid connection (bank link).
create table if not exists plaid_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  access_token    text not null,          -- Plaid access token (secret)
  item_id         text,                   -- Plaid item id
  needs_reconnect boolean default false,  -- true when the bank link expired
  created_at      timestamptz default now() -- used as the transaction import cutoff
);

-- ── pockets ────────────────────────────────────────────────────
-- The spending envelopes. One special "Unsorted" pocket per user (is_unsorted = true)
-- absorbs the gap between the live bank balance and the sum of named pockets.
create table if not exists pockets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  name           text not null,
  color          text,
  balance        numeric default 0,
  income_percent numeric,                 -- share of income for auto-distribution (null = excluded)
  archived_at    timestamptz,             -- non-null = archived (used as the template backup)
  is_unsorted    boolean default false,   -- the system "Unsorted" pocket
  created_at     timestamptz default now()
);

-- ── transactions ───────────────────────────────────────────────
-- Every transaction. pocket_id null + distributed false = still in the inbox.
create table if not exists transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null,
  merchant             text,
  amount               numeric not null,  -- negative = spending, positive = income
  date                 text,              -- display string like "Jul 6"
  icon                 text,
  pocket_id            uuid,              -- null = unassigned (inbox) unless distributed
  plaid_transaction_id text,              -- dedupe key for synced transactions
  distributed          boolean default false, -- true = income split across pockets (see allocations)
  created_at           timestamptz default now()
);

-- ── transaction_allocations ────────────────────────────────────
-- Per-pocket breakdown of a distributed income transaction.
-- e.g. one $100 paycheck → $50 Needs, $30 Wants, $20 Savings = 3 allocation rows.
create table if not exists transaction_allocations (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null,
  pocket_id      uuid not null,
  amount         numeric not null
);

-- ── user_settings ──────────────────────────────────────────────
-- One row per user: their chosen budgeting method (template).
create table if not exists user_settings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  method_id          text,   -- current budgeting template id
  previous_method_id text    -- kept so a previous setup can be restored
);

-- Optional but recommended: enable Row Level Security on every table.
-- The backend uses the service role key, which bypasses RLS, so this won't break
-- the server — it just blocks direct access with the public anon key.
alter table plaid_items             enable row level security;
alter table pockets                 enable row level security;
alter table transactions            enable row level security;
alter table transaction_allocations enable row level security;
alter table user_settings           enable row level security;
