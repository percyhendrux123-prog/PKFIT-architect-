import { pickModel } from './anthropic.js';
import { decryptByoKey } from './byo-crypto.js';

const LEGACY_PLAN_TO_TIER = {
  performance: 'tier1',
  identity: 'tier1',
  full: 'tier2',
  premium: 'tier3',
};

export function tierFromProfile(profile) {
  if (!profile) return 'trial';
  const raw = profile.plan ?? profile.tier ?? 'trial';
  if (raw === 'tier1' || raw === 'tier2' || raw === 'tier3' || raw === 'trial') return raw;
  return LEGACY_PLAN_TO_TIER[raw] ?? 'trial';
}

export function resolveModelAndKey(profile) {
  const tier = tierFromProfile(profile);
  const model = pickModel(tier);
  let apiKeyOverride;
  if (tier === 'tier3' && profile?.byo_anthropic_key_encrypted) {
    try {
      apiKeyOverride = decryptByoKey(profile.byo_anthropic_key_encrypted);
    } catch {
      // Fall back to platform key if decryption fails. Do not throw — the
      // user still gets service, just on the platform's billing.
      apiKeyOverride = undefined;
    }
  }
  return { tier, model, apiKeyOverride };
}
