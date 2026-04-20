-- Stripe delivers webhooks at-least-once. Track every event we've processed so
-- re-delivery is a no-op. `stripe_event_id` is unique on insert; we short-
-- circuit when the row already exists.

create table if not exists public.stripe_events (
  id                uuid primary key default gen_random_uuid(),
  stripe_event_id   text not null unique,
  type              text,
  received_at       timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No client policies. Service role only.
