-- distributed_posts — external join table for the Buffer distributor.
--
-- Buffer's GraphQL Post type does not expose a customFields/metadata surface
-- in the public schema (verified 2026-04, see distribute spec §4), so we keep
-- our own row per scheduled post and join on buffer_post_id. This is the
-- correlation surface the Observer agent uses to trace published-post
-- performance back to the Producer task, canon version, and content pillar
-- that produced it.
--
-- producer_task_id and source_asset_id are forward-references — the
-- producer_tasks and assets tables don't exist yet (will land with the
-- AXIOM Producer bench). Columns are typed `uuid` with no FK so this
-- migration ships independently. When those tables arrive, a follow-up
-- migration adds the constraints.
--
-- Server-only writes via service role; clients never touch this table.

create table if not exists public.distributed_posts (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),

  -- Buffer side
  buffer_post_id              text not null unique,
  buffer_channel_id           text not null,
  platform                    text not null,
  scheduled_at                timestamptz,
  published_url               text,
  buffer_status               text not null default 'scheduled',

  -- Observer correlation surface
  producer_task_id            uuid,
  source_asset_id             uuid,
  canon_version               text not null,
  content_pillar              text not null,
  generation_model            text,
  generation_prompt_hash      text,
  caption_canon_score         numeric(4,3),
  distributor_agent_version   text,
  metadata_json               jsonb not null default '{}'::jsonb,

  -- Idempotency: the same producer task should never publish to the same
  -- channel twice (see spec §10). The function returns 409 on conflict.
  constraint distributed_posts_task_channel_unique
    unique (producer_task_id, buffer_channel_id)
);

create index if not exists distributed_posts_producer_task_idx
  on public.distributed_posts (producer_task_id);

create index if not exists distributed_posts_pillar_idx
  on public.distributed_posts (content_pillar);

create index if not exists distributed_posts_canon_idx
  on public.distributed_posts (canon_version);

create index if not exists distributed_posts_status_scheduled_idx
  on public.distributed_posts (buffer_status, scheduled_at);

alter table public.distributed_posts enable row level security;
-- No policies: only the server (service role) reads/writes. RLS still on
-- so a misconfigured anon-key request gets a deterministic permission denied
-- rather than reading the full table.
