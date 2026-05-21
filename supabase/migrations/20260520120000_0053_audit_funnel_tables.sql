-- 0053_audit_funnel_tables.sql
-- Phase 2A foundation for The Standard Audit funnel (audit.pkfit.com).
-- Three tables, server-side writes only, anon reads disabled.
-- Reference: ~/Documents/PKFIT/Funnel/ARCHITECTURE.md sections 2.7 and 5.

-- ─── audits ──────────────────────────────────────────────────────────────
-- One row per Stripe checkout for The Standard Audit. Magic-link token is
-- the bearer credential the buyer uses to open audit.pkfit.com/take/[token].
-- output_verdict holds the rendered output JSON so re-views are deterministic.

create table if not exists public.audits (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  stripe_id           text unique,                  -- checkout session id
  magic_link_token    text unique,                  -- bearer token, 64+ chars
  magic_link_expires  timestamptz,                  -- 24h TTL on issuance
  status              text not null default 'purchased',
                                                    -- purchased|started|completed|abandoned
  signature           text,                         -- e.g. "M02-avoid-spouse-morning"
  m02_result          jsonb,
  m03_result          jsonb,
  q9_marriage_answer  text,                         -- raw Q9 text for verdict readback
  output_verdict      jsonb,                        -- full rendered output template
  first_name          text,
  partnered           boolean,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  constraint audits_status_check
    check (status in ('purchased', 'started', 'completed', 'abandoned'))
);

create index if not exists audits_email_idx       on public.audits (email);
create index if not exists audits_created_at_idx  on public.audits (created_at desc);
create index if not exists audits_stripe_id_idx   on public.audits (stripe_id);
create index if not exists audits_status_idx      on public.audits (status);

alter table public.audits enable row level security;
-- No client-facing policies. The audit app reads/writes via service role only.
-- The buyer authenticates by magic_link_token at the application layer.

-- ─── events ──────────────────────────────────────────────────────────────
-- Funnel-wide event log per architecture Section 5.1. Subject is email or
-- anonymous id. funnel_layer is 0..5 mapped to the architecture diagram.

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,                     -- e.g. audit_purchased, audit_completed
  subject_id    text,                              -- email or anon id
  email         text,                              -- denormalized for fast lookups
  subscriber_id text,                              -- Kit subscriber id when known
  properties    jsonb not null default '{}'::jsonb,
  funnel_layer  smallint,                          -- 0..5
  source        text                               -- stripe|app|kit|manychat|landing
);

create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_name_idx       on public.events (name);
create index if not exists events_email_idx      on public.events (email);
create index if not exists events_layer_idx      on public.events (funnel_layer);

alter table public.events enable row level security;
-- No client-facing policies. Server-side writes only.

-- ─── leads ───────────────────────────────────────────────────────────────
-- Lightweight CRM mirror. Kit is the messaging layer; this is the durable
-- record of who entered the funnel and where they sit. tags is a flat array
-- mirroring the Kit tag taxonomy (architecture Section 4.2).

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  first_name    text,
  partnered     boolean,
  source        text,                              -- landing|dm|podcast|referral
  tags          text[] not null default '{}',
  status        text not null default 'warm',
                                                    -- warm|audit_purchased|audit_completed|client|churned
  first_seen    timestamptz not null default now(),
  last_active   timestamptz not null default now(),
  constraint leads_status_check
    check (status in ('warm', 'audit_purchased', 'audit_completed', 'client', 'churned'))
);

create index if not exists leads_email_idx        on public.leads (email);
create index if not exists leads_status_idx       on public.leads (status);
create index if not exists leads_last_active_idx  on public.leads (last_active desc);
create index if not exists leads_tags_idx         on public.leads using gin (tags);

alter table public.leads enable row level security;
-- No client-facing policies. Server-side writes only.

comment on table public.audits is
  'The Standard Audit purchase + diagnostic state. Service-role writes only.';
comment on table public.events is
  'Funnel-wide event log. Subject is email or anon id. Service-role writes only.';
comment on table public.leads is
  'CRM mirror of Kit subscribers. Tags mirror Kit taxonomy. Service-role writes only.';
