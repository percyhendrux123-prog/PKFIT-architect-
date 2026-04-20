-- Meal adherence. Flip a boolean per meal row when the client eats it.

alter table public.meals
  add column if not exists eaten       boolean not null default false,
  add column if not exists eaten_at    timestamptz;
