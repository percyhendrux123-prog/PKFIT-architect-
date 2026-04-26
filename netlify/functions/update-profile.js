import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { encryptMedical } from './_shared/medical-crypto.js';

// Single endpoint for writing the intake / medical / consent / name fields
// on a profile row. Medical is encrypted at this boundary so the column
// never holds plaintext.

const TEXT_LIMIT = 200;
const NOTE_LIMIT = 2000;

function sanitize(s, max = TEXT_LIMIT) {
  if (typeof s !== 'string') return null;
  return s.trim().slice(0, max) || null;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');

    const updates = {};

    if (body.name !== undefined) {
      const name = sanitize(body.name);
      if (name) updates.name = name;
    }

    if (body.intake && typeof body.intake === 'object') {
      // Whitelist keys so a malformed POST can't smuggle arbitrary blobs.
      const i = body.intake;
      updates.intake = {
        legal_name: sanitize(i.legal_name),
        address_line1: sanitize(i.address_line1),
        address_line2: sanitize(i.address_line2),
        city: sanitize(i.city),
        state: sanitize(i.state, 4),
        postal_code: sanitize(i.postal_code, 12),
        country: sanitize(i.country, 4) ?? 'US',
        dob: sanitize(i.dob, 12),
        sex: sanitize(i.sex, 12),
        height_cm: typeof i.height_cm === 'number' ? i.height_cm : null,
        weight_lb: typeof i.weight_lb === 'number' ? i.weight_lb : null,
        occupation: sanitize(i.occupation),
        training_background: sanitize(i.training_background, NOTE_LIMIT),
        goals: sanitize(i.goals, NOTE_LIMIT),
        training_days_per_week: typeof i.training_days_per_week === 'number' ? i.training_days_per_week : null,
        equipment: sanitize(i.equipment, NOTE_LIMIT),
      };
    }

    if (body.medical && typeof body.medical === 'object') {
      const m = body.medical;
      const cleaned = {
        conditions: sanitize(m.conditions, NOTE_LIMIT),
        medications: sanitize(m.medications, NOTE_LIMIT),
        allergies: sanitize(m.allergies, NOTE_LIMIT),
        injuries: sanitize(m.injuries, NOTE_LIMIT),
        emergency_contact: m.emergency_contact && typeof m.emergency_contact === 'object'
          ? {
              name: sanitize(m.emergency_contact.name),
              phone: sanitize(m.emergency_contact.phone, 30),
              relation: sanitize(m.emergency_contact.relation, 40),
            }
          : null,
      };
      updates.medical_encrypted = encryptMedical(cleaned);
    }

    if (body.consent && typeof body.consent === 'object') {
      const c = body.consent;
      updates.consent = {
        tos_v: Number(c.tos_v) || null,
        coaching_v: Number(c.coaching_v) || null,
        privacy_v: Number(c.privacy_v) || null,
        signed_at: new Date().toISOString(),
        ua: sanitize(event.headers?.['user-agent'] ?? '', 300),
      };
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse(400, { error: 'Nothing to update' });
    }

    const admin = getAdminClient();
    const { error } = await admin.from('profiles').update(updates).eq('id', user.id);
    if (error) return jsonResponse(500, { error: error.message });

    return jsonResponse(200, { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
};
