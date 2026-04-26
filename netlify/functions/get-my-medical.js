import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { decryptMedical } from './_shared/medical-crypto.js';

// Returns the decrypted medical block for the authenticated user. The owner
// can also request another user's medical via ?clientId= (used for coach
// surfaces); that branch is intentionally NOT enabled in v1 — coach UI
// reads via dedicated coach functions, never this one.

export const handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  try {
    const { user } = await requireUser(event);
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('medical_encrypted')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return jsonResponse(500, { error: error.message });
    const medical = decryptMedical(data?.medical_encrypted);
    return jsonResponse(200, { medical: medical ?? null });
  } catch (e) {
    return errorResponse(e);
  }
};
