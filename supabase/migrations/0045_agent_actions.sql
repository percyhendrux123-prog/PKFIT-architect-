-- 0045_agent_actions.sql
-- Architect v2 — Owner-Agentic Phase 1.
--
-- Tables added:
--   agent_actions     → audit log for every tool invocation by the owner
--                       agent. Logged BEFORE execution so a mid-action
--                       failure is still recorded. Credentials and PII
--                       are pre-redacted by the caller.
--   agent_token_usage → monthly Anthropic spend tracking, for the future
--                       tier4 "Agent Owner" allowance + overage model. Per
--                       Phase 1 spec, no Stripe price exists yet — this
--                       table is ready for when Percy flips the tier4 flag.
--   agent_mcp_credentials → encrypted per-owner MCP credential store. Each
--                           row stores credentials for one MCP server
--                           (e.g. "slack", "notion"). Encrypted at rest
--                           using BYO_KEY_SECRET (same AES-256-GCM as
--                           byo_anthropic_key_encrypted).
--
-- RLS:
--   - agent_actions: owners can read all rows; non-owners can read their own.
--   - agent_token_usage: read-own; writes are service-role only.
--   - agent_mcp_credentials: read-own only; writes service-role.

-- ═══ agent_actions ═══════════════════════════════════════════════════════
create table if not exists public.agent_actions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  tool_name       text not null,
  risk_level      text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  -- Inputs with credentials/PII redacted by the caller. Keys like 'value',
  -- 'password', 'token', 'secret', '*_key' replaced with masked last-4 form.
  inputs_redacted jsonb,
  -- One-line plain-English summary of what the tool did. Never row contents.
  outputs_summary text,
  -- approval_status:
  --   autonomous → LOW-risk, no confirmation needed
  --   approved   → user confirmed (HIGH/CRITICAL)
  --   auto_batch → batch-approval pattern ("yes for next 5")
  --   denied     → user rejected
  --   pending    → logged before execution, status finalized after
  --   error      → execution failed
  approval_status text not null check (approval_status in (
    'autonomous', 'approved', 'auto_batch', 'denied', 'pending', 'error'
  )),
  approver_user_id uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index if not exists agent_actions_user_id_idx
  on public.agent_actions(user_id, created_at desc);
create index if not exists agent_actions_conv_idx
  on public.agent_actions(conversation_id, created_at desc);
create index if not exists agent_actions_tool_idx
  on public.agent_actions(tool_name, created_at desc);

alter table public.agent_actions enable row level security;

-- Read-own only. Owner-wide reads (for the AgentLog audit view) go through
-- the service-role path on the server — the `user_role` enum here is
-- ('client','coach') and the app identifies owners by email via
-- OWNER_EMAILS, not profiles.role. Phase 1 is effectively single-owner
-- (Percy) so read-own gives him visibility into his own agent actions.
drop policy if exists "agent_actions read own" on public.agent_actions;
create policy "agent_actions read own"
  on public.agent_actions
  for select
  using (auth.uid() = user_id);

-- Inserts are service-role only (Netlify functions). No anon insert path.
drop policy if exists "agent_actions service-role insert" on public.agent_actions;

-- Updates restricted to service-role too (status transitions, etc.).
drop policy if exists "agent_actions service-role update" on public.agent_actions;

-- ═══ agent_token_usage ════════════════════════════════════════════════════
-- Tracks Anthropic input/output tokens per user per UTC month, used for the
-- future tier4 allowance (5M tokens/mo) + overage ($0.012/1K) and the
-- per-conversation hard caps ($10 tier4 / $5 owner soft prompt).
create table if not exists public.agent_token_usage (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  period_month    date not null,  -- first of month, UTC, e.g. 2026-05-01
  input_tokens    bigint not null default 0,
  output_tokens   bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_creation_tokens bigint not null default 0,
  -- usd_estimate is computed and stored at write time using a static rate
  -- table per model. Not authoritative — Anthropic's invoice wins — but
  -- useful for ceiling enforcement without an external API call.
  usd_estimate    numeric(10, 4) not null default 0,
  model           text,
  created_at      timestamptz not null default now()
);

create index if not exists agent_token_usage_user_period_idx
  on public.agent_token_usage(user_id, period_month);
create index if not exists agent_token_usage_user_conv_idx
  on public.agent_token_usage(user_id, conversation_id);
create index if not exists agent_token_usage_user_created_idx
  on public.agent_token_usage(user_id, created_at desc);

alter table public.agent_token_usage enable row level security;

drop policy if exists "agent_token_usage read own" on public.agent_token_usage;
create policy "agent_token_usage read own"
  on public.agent_token_usage
  for select
  using (auth.uid() = user_id);

-- ═══ agent_mcp_credentials ════════════════════════════════════════════════
-- Stores encrypted MCP server credentials per owner, keyed by server name.
-- AES-256-GCM encrypted via byo-crypto.js (BYO_KEY_SECRET).
create table if not exists public.agent_mcp_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  server_name     text not null,
  credentials_encrypted bytea,
  config_json     jsonb,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, server_name)
);

create index if not exists agent_mcp_credentials_user_idx
  on public.agent_mcp_credentials(user_id);

alter table public.agent_mcp_credentials enable row level security;

drop policy if exists "agent_mcp_credentials read own" on public.agent_mcp_credentials;
create policy "agent_mcp_credentials read own"
  on public.agent_mcp_credentials
  for select
  using (auth.uid() = user_id);

-- ═══ tier4 flag on profiles ══════════════════════════════════════════════
-- Boolean column for the future "Agent Owner" tier. Phase 1 hardcodes this
-- to false for all users — Percy flips on per-user manually until the
-- Stripe price exists.
alter table public.profiles
  add column if not exists tier4_agent_owner boolean not null default false;

comment on column public.profiles.tier4_agent_owner is
  'Phase 2 Agent Owner tier flag. When true, user has access to the owner-agentic tool registry (with allowance + per-conversation caps). Hardcoded false until Stripe price is created — Percy enables per-user manually.';
