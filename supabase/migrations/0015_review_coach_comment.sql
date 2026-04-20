-- Let the coach leave a short note on a review. Clients read it; only coaches
-- (or RPC-level) can write it. Existing RLS on reviews already allows coach
-- read/write on all rows, so no policy change is needed.

alter table public.reviews
  add column if not exists coach_comment     text,
  add column if not exists coach_commented_at timestamptz;
