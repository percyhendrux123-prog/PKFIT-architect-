-- Profile intake + legal consent + emergency contact.
--
-- Three new JSONB columns on `profiles`:
--   intake             — non-sensitive personal data (legal name, address,
--                        DOB, sex, height_cm, weight_lb, occupation, training
--                        background, goals, training days/week, equipment).
--   medical_encrypted  — bytea ciphertext of the JSON medical block
--                        (conditions, medications, allergies, injuries,
--                        emergency_contact). AES-256-GCM keyed by
--                        MEDICAL_ENC_SECRET. Server-side only — clients
--                        read/write through update-profile / get-my-medical
--                        Netlify functions, never directly via supabase-js.
--   consent            — { tos_v: int, coaching_v: int, privacy_v: int,
--                          signed_at: timestamp, ip?: text, ua?: text }.
--
-- The profiles_lock_privileged trigger already prevents clients from
-- self-promoting role/plan/loop_stage/start_date; the new columns are not
-- privileged so client UPDATEs that touch them go through (subject to RLS).
-- We still funnel writes through update-profile.js so the medical block can
-- be encrypted before storage.

alter table public.profiles
  add column if not exists intake jsonb,
  add column if not exists medical_encrypted bytea,
  add column if not exists consent jsonb;

comment on column public.profiles.intake is
  'Non-sensitive intake data: legal name, address, DOB, sex, height_cm, weight_lb, etc.';
comment on column public.profiles.medical_encrypted is
  'AES-256-GCM ciphertext (IV(12)||tag(16)||ct) of the medical JSON block. Keyed by MEDICAL_ENC_SECRET server env.';
comment on column public.profiles.consent is
  'Versioned consent record: { tos_v, coaching_v, privacy_v, signed_at }.';
