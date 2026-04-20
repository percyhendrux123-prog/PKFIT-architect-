-- Which adjustments has the client actually executed this week. Keyed by
-- index into `adjustments`. Clients can toggle; coaches can see but don't
-- write. Existing RLS on reviews already allows both.

alter table public.reviews
  add column if not exists adjustments_state jsonb not null default '{}'::jsonb;
