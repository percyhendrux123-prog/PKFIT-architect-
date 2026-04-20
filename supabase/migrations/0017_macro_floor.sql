-- Macro floor target on the profile. Used on Meals to compare eaten vs.
-- prescribed and flag when a day missed the floor.

alter table public.profiles
  add column if not exists target_kcal      integer,
  add column if not exists target_protein_g integer,
  add column if not exists target_carbs_g   integer,
  add column if not exists target_fat_g     integer;
