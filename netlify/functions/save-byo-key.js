import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { tierFromProfile } from './_shared/tier.js';
import { encryptByoKey } from './_shared/byo-crypto.js';

// Tier 3 subscribers can paste an Anthropic API key. The server encrypts it
// AES-256-GCM with BYO_KEY_SECRET and stores the ciphertext on the profile.
// Subsequent generator/assistant calls will decrypt it per-request and use
// it as `apiKeyOverride` to Anthropic's SDK — meaning the user's own key
// pays for tokens, while PKFIT keeps the subscription margin.

export const handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  try {
    const { user, profile } = await requireUser(event);

    if (tierFromProfile(profile) !== 'tier3') {
      return jsonResponse(403, { error: 'BYO key is a tier3 feature' });
    }

    const admin = getAdminClient();

    if (event.httpMethod === 'DELETE') {
      const { error } = await admin
        .from('profiles')
        .update({ byo_anthropic_key_encrypted: null })
        .eq('id', user.id);
      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(200, { ok: true, cleared: true });
    }

    const { apiKey } = JSON.parse(event.body || '{}');
    if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) {
      return jsonResponse(400, { error: 'Provide an Anthropic API key (sk-ant-...)' });
    }

    const encrypted = encryptByoKey(apiKey.trim());
    const { error } = await admin
      .from('profiles')
      .update({ byo_anthropic_key_encrypted: encrypted })
      .eq('id', user.id);
    if (error) return jsonResponse(500, { error: error.message });

    return jsonResponse(200, { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
};
