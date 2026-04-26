-- Tier simplification + BYO Anthropic key column.
--
-- Replaces the legacy 4-tier structure (performance / identity / full /
-- premium) with three model-aware tiers (tier1 = Haiku, tier2 = Sonnet,
-- tier3 = Opus). Tier 3 subscribers can paste their own Anthropic API key,
-- which is stored AES-GCM encrypted at the application layer.

-- 1. Add the encrypted BYO key column. Plain bytea — encryption is performed
--    by netlify/functions/_shared/byo-crypto.js using BYO_KEY_SECRET. Storing
--    encrypted bytes (rather than plaintext) means a Postgres or Supabase
--    breach alone is not sufficient to leak Anthropic credentials.
alter table public.profiles
  add column if not exists byo_anthropic_key_encrypted bytea;

comment on column public.profiles.byo_anthropic_key_encrypted is
  'AES-256-GCM encrypted Anthropic API key for tier3 BYO option. IV(12)||tag(16)||ct.';

-- 2. Backfill legacy plan strings to the new tier names. Mapping rule:
--      performance -> tier1   (matches Haiku price point)
--      identity    -> tier1   (rolls up to closest active tier)
--      full        -> tier2   (Sonnet)
--      premium     -> tier3   (Opus)
--    Existing Stripe subscriptions stay live until renewal; the webhook keeps
--    legacy price IDs mapped to the same target tiers (see stripe-webhook.js).
update public.profiles
  set plan = case plan
    when 'performance' then 'tier1'
    when 'identity'    then 'tier1'
    when 'full'        then 'tier2'
    when 'premium'     then 'tier3'
    else plan
  end
  where plan in ('performance', 'identity', 'full', 'premium');

update public.payments
  set plan = case plan
    when 'performance' then 'tier1'
    when 'identity'    then 'tier1'
    when 'full'        then 'tier2'
    when 'premium'     then 'tier3'
    else plan
  end
  where plan in ('performance', 'identity', 'full', 'premium');
