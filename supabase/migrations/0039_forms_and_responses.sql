-- 0039_forms_and_responses.sql
-- PK•FIT v1 — Block 1 schema additions.
-- The forms engine. Two tables:
--   forms          → coach-authored form templates (intake, weekly check-in,
--                    consult prep, custom). Field schema lives as jsonb so
--                    a builder UI can iterate without a DDL change per form.
--   form_responses → one row per submission. Responses jsonb is keyed by
--                    field id from the parent form's `fields` array.
--
-- Per engineering scope §2.2, `form_fields` is denormalised into
-- `forms.fields jsonb` for v1 — simpler to evolve, simpler to migrate
-- from Trainerize. If a future query path needs per-field analytics, a
-- view over the jsonb is the next step.
--
-- Depends on: profiles (0001).
-- Followed by:  0040_client_tags.sql.
--
-- DO NOT APPLY in this block. File-write only.

-- ─── forms ───────────────────────────────────────────────────────────────
create table if not exists public.forms (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  -- 'intake'  → one-time, on first login or assignment.
  -- 'checkin' → recurring per cadence.
  -- 'custom'  → coach-defined, ad-hoc.
  type        text not null
              check (type in ('intake', 'checkin', 'custom')),
  -- Cadence is meaningful only for type='checkin'. Null for intake/custom.
  cadence     text
              check (cadence is null or cadence in ('once', 'daily', 'weekly', 'biweekly', 'monthly')),
  description text,
  -- Field schema. Shape per builder convention:
  -- [{id: uuid, label: text, kind: 'text'|'number'|'scale'|'yesno'|'multi'|'photo',
  --   required: bool, options?: text[], min?: int, max?: int}]
  fields      jsonb not null default '[]'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.forms is
  'Coach-authored form templates. fields jsonb is the schema; form_responses.responses keys against field.id.';
comment on column public.forms.cadence is
  'Frequency for type=checkin. Null for intake/custom.';
comment on column public.forms.is_active is
  'Inactive forms are hidden from clients but kept for response history.';

create index if not exists forms_owner_idx on public.forms (owner_id);
create index if not exists forms_active_type_idx on public.forms (is_active, type);

-- Touch updated_at on every UPDATE.
create or replace function public.forms_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forms_touch_updated_at on public.forms;
create trigger forms_touch_updated_at
  before update on public.forms
  for each row execute function public.forms_touch_updated_at();

-- ─── form_responses ──────────────────────────────────────────────────────
create table if not exists public.form_responses (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references public.forms(id) on delete cascade,
  client_id     uuid not null references public.profiles(id) on delete cascade,
  -- Map keyed by field.id from the parent form's `fields` array.
  responses     jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz not null default now(),
  -- Period tag for cadenced check-in forms (e.g. '2026-W19' for the week
  -- of submission). Null for one-shot intake.
  period_key    text,
  created_at    timestamptz not null default now()
);

comment on table public.form_responses is
  'One row per form submission. responses jsonb keys against forms.fields[*].id.';
comment on column public.form_responses.period_key is
  'For cadenced forms: a period tag (e.g. 2026-W19) so a UI can render "this week" without a date range query.';

create index if not exists form_responses_form_idx
  on public.form_responses (form_id, submitted_at desc);
create index if not exists form_responses_client_idx
  on public.form_responses (client_id, submitted_at desc);
create index if not exists form_responses_form_client_period_idx
  on public.form_responses (form_id, client_id, period_key);
-- One response per client per period for a given form.
create unique index if not exists form_responses_form_client_period_unique
  on public.form_responses (form_id, client_id, period_key)
  where period_key is not null;

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table public.forms enable row level security;
alter table public.form_responses enable row level security;

-- forms: coach full CRUD.
drop policy if exists "forms coach rw" on public.forms;
create policy "forms coach rw" on public.forms
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- forms: client read on active forms (so the client app can render the
-- form-fill page).
drop policy if exists "forms client read active" on public.forms;
create policy "forms client read active" on public.forms
  for select
  using (
    auth.role() = 'authenticated'
    and is_active
  );

-- form_responses: coach full CRUD.
drop policy if exists "form_responses coach rw" on public.form_responses;
create policy "form_responses coach rw" on public.form_responses
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- form_responses: client read on their own.
drop policy if exists "form_responses client read own" on public.form_responses;
create policy "form_responses client read own" on public.form_responses
  for select
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- form_responses: client insert on their own.
drop policy if exists "form_responses client insert own" on public.form_responses;
create policy "form_responses client insert own" on public.form_responses
  for insert
  with check (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- form_responses: client update their own (allows draft / autosave flows).
drop policy if exists "form_responses client update own" on public.form_responses;
create policy "form_responses client update own" on public.form_responses
  for update
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  )
  with check (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "form_responses client update own" on public.form_responses;
-- drop policy if exists "form_responses client insert own" on public.form_responses;
-- drop policy if exists "form_responses client read own" on public.form_responses;
-- drop policy if exists "form_responses coach rw" on public.form_responses;
-- drop policy if exists "forms client read active" on public.forms;
-- drop policy if exists "forms coach rw" on public.forms;
-- alter table public.form_responses disable row level security;
-- alter table public.forms disable row level security;
-- drop index if exists form_responses_form_client_period_unique;
-- drop index if exists form_responses_form_client_period_idx;
-- drop index if exists form_responses_client_idx;
-- drop index if exists form_responses_form_idx;
-- drop trigger if exists forms_touch_updated_at on public.forms;
-- drop function if exists public.forms_touch_updated_at();
-- drop index if exists forms_active_type_idx;
-- drop index if exists forms_owner_idx;
-- drop table if exists public.form_responses;
-- drop table if exists public.forms;
