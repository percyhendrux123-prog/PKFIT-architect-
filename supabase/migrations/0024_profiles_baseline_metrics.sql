-- Baseline body metrics on the client profile. Stored canonical (kg, cm) so a
-- single source of truth holds across imperial and metric users; the display
-- layer converts via src/lib/units.js (cmToFeetInches, kgToLbs). Both columns
-- are nullable — onboarding may have skipped them, the importer may not have
-- a value, and downstream code already null-handles.

alter table public.profiles
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric;
