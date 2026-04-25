// Pure mapping functions for the Trainerize → PKFIT importer. No Supabase
// dependencies — everything here is deterministic data transformation, easy to
// unit test in isolation. The function entry point composes these mappers and
// applies the database side effects.
//
// Schema gaps:
//   • profiles has no trainerize_client_id column (email is the natural key).
//   • programs / workout_sessions / meals have no external_id column — we
//     embed _meta.trainerize_id inside their jsonb columns instead.
//   • check_ins / dm_messages have no jsonb — content hashes guard dedup.
//   • Issue #13 referenced a checkin_photos bucket; the live bucket is
//     baseline-photos (per migration 0008). We use that and flag the gap.
//
// See docs/trainerize-import-contract.md for the full payload shape.

import { createHash } from 'node:crypto';

export const SUPPORTED_SCHEMA_MAJOR = 1;
export const PHOTOS_BUCKET = 'baseline-photos';

// ─── helpers ────────────────────────────────────────────────────────────

export function parseSchemaVersion(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function isSchemaCompatible(v) {
  const parsed = parseSchemaVersion(v);
  return Boolean(parsed && parsed.major === SUPPORTED_SCHEMA_MAJOR);
}

// Stable SHA-256 hex of a string. Used as a content key when we don't have a
// jsonb column to embed the trainerize_id into.
export function contentHash(...parts) {
  const h = createHash('sha256');
  for (const p of parts) h.update(String(p ?? ''));
  return h.digest('hex');
}

function isoDateOnly(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ─── client / profile ───────────────────────────────────────────────────

export function mapProfileFields(client) {
  const out = {};
  if (client.name) out.name = client.name;
  if (client.email) out.email = client.email;
  if (client.plan_label) out.plan = client.plan_label;
  const start = isoDateOnly(client.joined_at);
  if (start) out.start_date = start;
  if (client.weight_unit === 'lbs') out.units = 'imperial';
  else if (client.weight_unit === 'kg') out.units = 'metric';
  return out;
}

// ─── programs ──────────────────────────────────────────────────────────

export function mapProgramRow(client_id, program) {
  const status = program.status === 'active' || program.status === 'archived' || program.status === 'draft'
    ? program.status
    : 'archived';
  const schedule = {
    ...(program.schedule ?? {}),
    title: program.title ?? program.schedule?.title,
  };
  return {
    client_id,
    week_number: Number.isFinite(program.week_number) ? program.week_number : 1,
    schedule,
    exercises: {
      _meta: { trainerize_id: program.trainerize_id, source: 'trainerize' },
      items: Array.isArray(program.exercises) ? program.exercises : [],
    },
    status,
  };
}

// ─── workout sessions ──────────────────────────────────────────────────

export function mapSessionRow(client_id, session, programIdMap) {
  const localProgramId = session.trainerize_program_id
    ? programIdMap.get(session.trainerize_program_id) ?? null
    : null;
  return {
    client_id,
    program_id: localProgramId,
    performed_at: session.performed_at,
    duration_min: Number.isFinite(session.duration_min) ? session.duration_min : null,
    rpe_avg: Number.isFinite(session.rpe_avg) ? session.rpe_avg : null,
    notes: session.notes ?? null,
    exercises: {
      _meta: { trainerize_id: session.trainerize_id, source: 'trainerize' },
      items: Array.isArray(session.exercises) ? session.exercises : [],
    },
  };
}

// ─── check-ins ─────────────────────────────────────────────────────────

export function mapCheckInRow(client_id, checkin) {
  return {
    client_id,
    date: checkin.date,
    weight: Number.isFinite(checkin.weight_kg) ? checkin.weight_kg : null,
    body_fat: Number.isFinite(checkin.body_fat_pct) ? checkin.body_fat_pct : null,
    notes: checkin.notes ?? null,
  };
}

export function checkInDedupKey(client_id, checkin) {
  // No jsonb column — natural key (client_id, date). Two rows for the same
  // day collapse to one (Trainerize itself only allows one weigh-in per day).
  return contentHash(client_id, checkin.date);
}

// ─── meals ─────────────────────────────────────────────────────────────

export function mapMealRow(client_id, meal) {
  return {
    client_id,
    date: meal.date ?? null,
    day: meal.day ?? null,
    meal_type: meal.meal_type ?? null,
    items: {
      _meta: { trainerize_id: meal.trainerize_id, source: 'trainerize' },
      items: Array.isArray(meal.items) ? meal.items : [],
    },
    macros: meal.macros ?? {},
  };
}

// Adherence resolves the trainerize_meal_id against meals already imported.
// Returns { ok: true, update } or { ok: false, reason }.
export function resolveAdherence(adherence, mealIdMap) {
  const tzId = adherence.trainerize_meal_id;
  const supabaseMealId = mealIdMap.get(tzId);
  if (!supabaseMealId) {
    return { ok: false, reason: 'no matching meal in import or in db' };
  }
  return {
    ok: true,
    supabase_meal_id: supabaseMealId,
    update: {
      eaten: Boolean(adherence.eaten),
      eaten_at: adherence.eaten_at ?? null,
    },
  };
}

// ─── progress photos ───────────────────────────────────────────────────

export function buildPhotoPath(client_id, photo) {
  const ext = photo.mime_type === 'image/png' ? 'png'
    : photo.mime_type === 'image/jpeg' ? 'jpg'
    : 'bin';
  const ts = photo.captured_at ?? photo.checkin_date ?? new Date().toISOString();
  const tsClean = String(ts).replace(/[:]/g, '-');
  return `${client_id}/checkin-${tsClean}-${photo.trainerize_id}.${ext}`;
}

export function decodePhotoBase64(b64) {
  if (typeof b64 !== 'string' || b64.length === 0) {
    return { ok: false, reason: 'empty data_base64' };
  }
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length === 0) return { ok: false, reason: 'invalid base64' };
    return { ok: true, buffer: buf };
  } catch {
    return { ok: false, reason: 'invalid base64' };
  }
}

// ─── messages ──────────────────────────────────────────────────────────

export function mapMessageRow(thread_id, client_id, coach_id, msg) {
  let author_id = null;
  if (msg.direction === 'from_client') author_id = client_id;
  else if (msg.direction === 'from_coach') author_id = coach_id;
  return {
    thread_id,
    author_id,
    content: msg.content,
    created_at: msg.sent_at,
    // Imported history is read-by-everyone — nothing should pop as unread on day one.
    read_by_client: true,
    read_by_coach: true,
  };
}

export function messageDedupKey(thread_id, msg) {
  return contentHash(thread_id, msg.sent_at, msg.content);
}

// ─── extractors for embedded trainerize_ids ────────────────────────────

export function extractTrainerizeIdFromJsonbWrap(wrap) {
  if (!wrap || typeof wrap !== 'object') return null;
  return wrap?._meta?.trainerize_id ?? null;
}
