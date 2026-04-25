// POST /.netlify/functions/trainerize-import
//
// Ingests a Trainerize export (JSON) and writes to Supabase. Coach-auth only.
// Idempotent — re-running with the same payload skips already-imported rows.
//
// Companion: Issue #19 (Apify scraper) produces the JSON in the schema
// documented at docs/trainerize-import-contract.md and exemplified at
// tests/fixtures/trainerize-sample.json.
//
// Supports an internal seam for testing: pass a custom { admin, anon } pair
// into runImport() to substitute mock clients in unit tests without touching
// real Supabase. The HTTP handler always uses the production clients.

// Auth helpers and the production Supabase admin client are imported lazily
// inside the HTTP handler. That keeps `runImport` — the testable orchestrator
// surface — free of any Supabase module dependency, so unit tests can run
// against a fake admin without installing @supabase/supabase-js into the test
// environment.
import {
  isSchemaCompatible,
  mapProfileFields,
  mapProgramRow,
  mapSessionRow,
  mapCheckInRow,
  checkInDedupKey,
  mapMealRow,
  resolveAdherence,
  buildPhotoPath,
  decodePhotoBase64,
  mapMessageRow,
  messageDedupKey,
  extractTrainerizeIdFromJsonbWrap,
  PHOTOS_BUCKET,
} from './_shared/trainerize-mappers.js';

export const handler = async (event) => {
  const { jsonResponse, errorResponse, requireUser } = await import('./_shared/auth.js');
  const { getAdminClient } = await import('./_shared/supabase-admin.js');
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, role } = await requireUser(event);
    if (role !== 'coach') return jsonResponse(403, { error: 'Coach only' });

    const body = JSON.parse(event.body || '{}');
    const exp = body.trainerize_export;
    const tzClientId = body.trainerize_client_id;
    const dryRun = Boolean(body.dry_run);

    if (!exp) return jsonResponse(400, { error: 'trainerize_export required' });
    if (!tzClientId) return jsonResponse(400, { error: 'trainerize_client_id required' });
    if (!isSchemaCompatible(exp._schema_version)) {
      return jsonResponse(400, {
        error: `Unsupported _schema_version "${exp._schema_version}". Supported major: 1.x.x.`,
      });
    }
    if (!exp.client?.email) {
      return jsonResponse(400, { error: 'client.email required' });
    }
    if (exp.client.trainerize_id !== tzClientId) {
      return jsonResponse(400, {
        error: `trainerize_client_id "${tzClientId}" does not match client.trainerize_id "${exp.client.trainerize_id}"`,
      });
    }

    const result = await runImport({
      admin: getAdminClient(),
      coachId: user.id,
      payload: exp,
      dryRun,
    });

    return jsonResponse(200, result);
  } catch (e) {
    return errorResponse(e);
  }
};

// ─── core ──────────────────────────────────────────────────────────────

export async function runImport({ admin, coachId, payload, dryRun }) {
  const warnings = [];
  const skipped = {
    programs: [], sessions: [], checkins: [], meals: [],
    meal_adherence: [], photos: [], messages: [],
  };
  const imported = {
    programs: 0, sessions: 0, checkins: 0, meals: 0,
    meal_adherence: 0, photos: 0, messages: 0,
  };

  // 1) Resolve / create the client profile.
  const clientId = await ensureClient({ admin, client: payload.client, dryRun, warnings });

  // Track informational fields that have no home.
  if (payload.client.starting_height_cm != null) {
    warnings.push('client.starting_height_cm: no column on profiles — value retained in raw payload only');
  }
  if (payload.client.starting_weight_kg != null && !(payload.check_ins?.length)) {
    warnings.push('client.starting_weight_kg: no check_ins in payload to seed; value not persisted');
  }

  // 2) Programs. Map of trainerize_program_id → supabase program_id.
  const programIdMap = await importPrograms({
    admin, clientId, programs: payload.programs ?? [],
    dryRun, imported, skipped,
  });

  // 3) Workout sessions, joined to programIdMap.
  await importSessions({
    admin, clientId, sessions: payload.workout_sessions ?? [],
    programIdMap, dryRun, imported, skipped,
  });

  // 4) Check-ins.
  await importCheckIns({
    admin, clientId, checkins: payload.check_ins ?? [],
    dryRun, imported, skipped,
  });

  // 5) Meals + adherence (adherence reads the meal map written here).
  const { mealIdMap, existingAdherence } = await importMeals({
    admin, clientId, meals: payload.meals ?? [],
    dryRun, imported, skipped,
  });
  await applyMealAdherence({
    admin, adherence: payload.meal_adherence ?? [],
    mealIdMap, existingAdherence, dryRun, imported, skipped,
  });

  // 6) Progress photos. Storage upload + check_ins.photo_path update.
  await importPhotos({
    admin, clientId, photos: payload.progress_photos ?? [],
    dryRun, imported, skipped, warnings,
  });

  // 7) DM messages.
  await importMessages({
    admin, clientId, coachId, messages: payload.messages ?? [],
    dryRun, imported, skipped,
  });

  const anySkipsOtherThanAlreadyImported = Object.values(skipped).some((arr) =>
    arr.some((s) => s.reason && !s.reason.startsWith('already imported')),
  );
  const status = anySkipsOtherThanAlreadyImported ? 'partial' : 'ok';

  return {
    status,
    client_id_supabase: clientId,
    imported,
    skipped,
    warnings,
    dry_run: dryRun,
  };
}

// ─── client / profile ──────────────────────────────────────────────────

async function ensureClient({ admin, client, dryRun, warnings }) {
  // Look up by email first via profiles. Fast and uses our own table.
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', client.email)
    .maybeSingle();

  let userId = existing?.id ?? null;

  if (!userId) {
    if (dryRun) {
      // Synthetic UUID for dry-run reporting only — never written.
      userId = '00000000-0000-0000-0000-000000000000';
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: client.email,
        email_confirm: true,
        user_metadata: { name: client.name ?? '', source: 'trainerize-import' },
      });
      if (error) {
        const wrapped = new Error(`auth.admin.createUser failed: ${error.message}`);
        wrapped.statusCode = 500;
        throw wrapped;
      }
      userId = created.user.id;
    }
  }

  const updates = mapProfileFields(client);
  if (!dryRun && Object.keys(updates).length > 0) {
    const { error } = await admin.from('profiles').update(updates).eq('id', userId);
    if (error) {
      // Profile update failure is non-fatal — surface as warning, the auth user
      // and the trigger-created profile row already exist.
      warnings.push(`profile update failed: ${error.message}`);
    }
  }
  return userId;
}

// ─── programs ──────────────────────────────────────────────────────────

async function importPrograms({ admin, clientId, programs, dryRun, imported, skipped }) {
  const idMap = new Map();
  if (programs.length === 0) return idMap;

  // Pre-fetch existing programs for this client and index by embedded trainerize_id.
  const existingByTzId = await fetchExistingByTzId(admin, 'programs', clientId, 'exercises');

  for (const p of programs) {
    if (!p.trainerize_id) {
      skipped.programs.push({ reason: 'missing trainerize_id' });
      continue;
    }
    const hit = existingByTzId.get(p.trainerize_id);
    if (hit) {
      idMap.set(p.trainerize_id, hit.id);
      skipped.programs.push({ trainerize_id: p.trainerize_id, reason: 'already imported (matching _meta.trainerize_id)' });
      continue;
    }
    const row = mapProgramRow(clientId, p);
    if (dryRun) {
      idMap.set(p.trainerize_id, `dry-run-program-${imported.programs}`);
      imported.programs += 1;
      continue;
    }
    const { data, error } = await admin.from('programs').insert(row).select('id').single();
    if (error) {
      skipped.programs.push({ trainerize_id: p.trainerize_id, reason: `db error: ${error.message}` });
      continue;
    }
    idMap.set(p.trainerize_id, data.id);
    imported.programs += 1;
  }
  return idMap;
}

// ─── sessions ──────────────────────────────────────────────────────────

async function importSessions({ admin, clientId, sessions, programIdMap, dryRun, imported, skipped }) {
  if (sessions.length === 0) return;
  const existingByTzId = await fetchExistingByTzId(admin, 'workout_sessions', clientId, 'exercises');

  for (const s of sessions) {
    if (!s.trainerize_id) {
      skipped.sessions.push({ reason: 'missing trainerize_id' });
      continue;
    }
    if (existingByTzId.has(s.trainerize_id)) {
      skipped.sessions.push({ trainerize_id: s.trainerize_id, reason: 'already imported (matching _meta.trainerize_id)' });
      continue;
    }
    if (!s.performed_at) {
      skipped.sessions.push({ trainerize_id: s.trainerize_id, reason: 'missing performed_at' });
      continue;
    }
    const row = mapSessionRow(clientId, s, programIdMap);
    if (dryRun) {
      imported.sessions += 1;
      continue;
    }
    const { error } = await admin.from('workout_sessions').insert(row);
    if (error) {
      skipped.sessions.push({ trainerize_id: s.trainerize_id, reason: `db error: ${error.message}` });
      continue;
    }
    imported.sessions += 1;
  }
}

// ─── check-ins ─────────────────────────────────────────────────────────

async function importCheckIns({ admin, clientId, checkins, dryRun, imported, skipped }) {
  if (checkins.length === 0) return;
  const { data: existing } = await admin
    .from('check_ins')
    .select('id, date')
    .eq('client_id', clientId);
  const existingDates = new Set((existing ?? []).map((r) => r.date));

  for (const c of checkins) {
    if (!c.trainerize_id) {
      skipped.checkins.push({ reason: 'missing trainerize_id' });
      continue;
    }
    if (!c.date) {
      skipped.checkins.push({ trainerize_id: c.trainerize_id, reason: 'missing date' });
      continue;
    }
    if (existingDates.has(c.date)) {
      skipped.checkins.push({ trainerize_id: c.trainerize_id, reason: 'already imported (matching client_id+date)' });
      continue;
    }
    const row = mapCheckInRow(clientId, c);
    if (dryRun) {
      existingDates.add(c.date);
      imported.checkins += 1;
      continue;
    }
    const { error } = await admin.from('check_ins').insert(row);
    if (error) {
      skipped.checkins.push({ trainerize_id: c.trainerize_id, reason: `db error: ${error.message}` });
      continue;
    }
    existingDates.add(c.date);
    imported.checkins += 1;
  }
  // Reference checkInDedupKey so future shape changes are caught at lint time.
  void checkInDedupKey;
}

// ─── meals ─────────────────────────────────────────────────────────────

async function importMeals({ admin, clientId, meals, dryRun, imported, skipped }) {
  // Returns { mealIdMap, existingAdherence }.
  //   mealIdMap         : trainerize_meal_id → supabase meal id
  //   existingAdherence : trainerize_meal_id → { eaten, eaten_at } as it sits
  //                       on disk BEFORE this run. applyMealAdherence consults
  //                       it to skip UPDATEs whose new state already matches,
  //                       which is what makes the importer idempotent on the
  //                       adherence pass.
  const mealIdMap = new Map();
  const existingAdherence = new Map();
  // Pre-load existing meals so adherence can target rows from prior imports.
  // Pull eaten / eaten_at too so the adherence pass can dedupe idempotently.
  const existingByTzId = await fetchExistingByTzId(admin, 'meals', clientId, 'items', ['eaten', 'eaten_at']);
  for (const [tzId, row] of existingByTzId) {
    mealIdMap.set(tzId, row.id);
    existingAdherence.set(tzId, {
      eaten: row.eaten ?? false,
      eaten_at: row.eaten_at ?? null,
    });
  }

  if (meals.length === 0) return { mealIdMap, existingAdherence };

  for (const m of meals) {
    if (!m.trainerize_id) {
      skipped.meals.push({ reason: 'missing trainerize_id' });
      continue;
    }
    if (mealIdMap.has(m.trainerize_id)) {
      skipped.meals.push({ trainerize_id: m.trainerize_id, reason: 'already imported (matching _meta.trainerize_id)' });
      continue;
    }
    const row = mapMealRow(clientId, m);
    if (dryRun) {
      mealIdMap.set(m.trainerize_id, `dry-run-meal-${imported.meals}`);
      imported.meals += 1;
      continue;
    }
    const { data, error } = await admin.from('meals').insert(row).select('id').single();
    if (error) {
      skipped.meals.push({ trainerize_id: m.trainerize_id, reason: `db error: ${error.message}` });
      continue;
    }
    mealIdMap.set(m.trainerize_id, data.id);
    imported.meals += 1;
  }
  return { mealIdMap, existingAdherence };
}

async function applyMealAdherence({ admin, adherence, mealIdMap, existingAdherence, dryRun, imported, skipped }) {
  if (adherence.length === 0) return;
  for (const a of adherence) {
    const r = resolveAdherence(a, mealIdMap);
    if (!r.ok) {
      skipped.meal_adherence.push({ trainerize_meal_id: a.trainerize_meal_id, reason: r.reason });
      continue;
    }
    // Idempotency: if this meal was loaded from a prior import and the row
    // already carries the same { eaten, eaten_at } we are about to write,
    // the UPDATE is a no-op. Skip it so re-running the importer does not
    // inflate counters or touch updated_at on rows the coach has not in
    // fact changed. Freshly inserted meals (in this same run) are absent
    // from existingAdherence, so they always fall through to the UPDATE.
    const current = existingAdherence?.get(a.trainerize_meal_id);
    if (current && current.eaten === r.update.eaten && current.eaten_at === r.update.eaten_at) {
      skipped.meal_adherence.push({
        trainerize_meal_id: a.trainerize_meal_id,
        reason: 'already imported (matching eaten state)',
      });
      continue;
    }
    if (dryRun) {
      imported.meal_adherence += 1;
      continue;
    }
    const { error } = await admin.from('meals').update(r.update).eq('id', r.supabase_meal_id);
    if (error) {
      skipped.meal_adherence.push({ trainerize_meal_id: a.trainerize_meal_id, reason: `db error: ${error.message}` });
      continue;
    }
    // Track what we just wrote so duplicate adherence rows later in the
    // same payload see the live state rather than the pre-run state.
    existingAdherence?.set(a.trainerize_meal_id, { eaten: r.update.eaten, eaten_at: r.update.eaten_at });
    imported.meal_adherence += 1;
  }
}

// ─── photos ────────────────────────────────────────────────────────────

async function importPhotos({ admin, clientId, photos, dryRun, imported, skipped, warnings }) {
  if (photos.length === 0) return;

  // Pull check_ins for this client so we can attach photo_path by date.
  let checkinsByDate = new Map();
  if (!dryRun) {
    const { data } = await admin.from('check_ins').select('id,date').eq('client_id', clientId);
    checkinsByDate = new Map((data ?? []).map((r) => [r.date, r.id]));
  }

  for (const photo of photos) {
    if (!photo.trainerize_id) {
      skipped.photos.push({ reason: 'missing trainerize_id' });
      continue;
    }
    if (!photo.checkin_date) {
      skipped.photos.push({ trainerize_id: photo.trainerize_id, reason: 'missing checkin_date' });
      continue;
    }
    const decoded = decodePhotoBase64(photo.data_base64);
    if (!decoded.ok) {
      skipped.photos.push({ trainerize_id: photo.trainerize_id, reason: decoded.reason });
      continue;
    }
    const path = buildPhotoPath(clientId, photo);

    if (dryRun) {
      imported.photos += 1;
      continue;
    }

    // Storage upsert is idempotent on path. contentType drives the served headers.
    const { error: upErr } = await admin.storage.from(PHOTOS_BUCKET).upload(path, decoded.buffer, {
      contentType: photo.mime_type ?? 'application/octet-stream',
      upsert: true,
    });
    if (upErr) {
      skipped.photos.push({ trainerize_id: photo.trainerize_id, reason: `storage error: ${upErr.message}` });
      continue;
    }

    const checkinId = checkinsByDate.get(photo.checkin_date);
    if (!checkinId) {
      warnings.push(`photo ${photo.trainerize_id}: no matching check_in for date ${photo.checkin_date}; file uploaded, photo_path not attached`);
      imported.photos += 1;
      continue;
    }
    const { error: updErr } = await admin.from('check_ins').update({ photo_path: path }).eq('id', checkinId);
    if (updErr) {
      warnings.push(`photo ${photo.trainerize_id}: photo_path update failed: ${updErr.message}`);
    }
    imported.photos += 1;
  }
  // Reference for future use without a lint warning.
  void warnings;
}

// ─── messages ──────────────────────────────────────────────────────────

async function importMessages({ admin, clientId, coachId, messages, dryRun, imported, skipped }) {
  if (messages.length === 0) return;

  // Ensure a single thread for this client (unique on client_id).
  let threadId;
  if (dryRun) {
    threadId = '00000000-0000-0000-0000-000000000001';
  } else {
    const { data: existing } = await admin
      .from('dm_threads')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle();
    if (existing) {
      threadId = existing.id;
    } else {
      const { data: inserted, error } = await admin
        .from('dm_threads')
        .insert({ client_id: clientId })
        .select('id')
        .single();
      if (error) {
        for (const m of messages) {
          skipped.messages.push({ trainerize_id: m.trainerize_id, reason: `dm_thread insert failed: ${error.message}` });
        }
        return;
      }
      threadId = inserted.id;
    }
  }

  // Build dedup index from existing messages.
  let existingHashes = new Set();
  if (!dryRun) {
    const { data: existing } = await admin
      .from('dm_messages')
      .select('content,created_at')
      .eq('thread_id', threadId);
    for (const row of existing ?? []) {
      existingHashes.add(messageDedupKey(threadId, { content: row.content, sent_at: row.created_at }));
    }
  }

  for (const msg of messages) {
    if (!msg.trainerize_id) {
      skipped.messages.push({ reason: 'missing trainerize_id' });
      continue;
    }
    if (!msg.sent_at || !msg.content) {
      skipped.messages.push({ trainerize_id: msg.trainerize_id, reason: 'missing sent_at or content' });
      continue;
    }
    if (msg.direction !== 'from_client' && msg.direction !== 'from_coach') {
      skipped.messages.push({ trainerize_id: msg.trainerize_id, reason: `unknown direction "${msg.direction}"` });
      continue;
    }
    const key = messageDedupKey(threadId, msg);
    if (existingHashes.has(key)) {
      skipped.messages.push({ trainerize_id: msg.trainerize_id, reason: 'already imported (content hash match)' });
      continue;
    }
    const row = mapMessageRow(threadId, clientId, coachId, msg);
    if (dryRun) {
      existingHashes.add(key);
      imported.messages += 1;
      continue;
    }
    const { error } = await admin.from('dm_messages').insert(row);
    if (error) {
      skipped.messages.push({ trainerize_id: msg.trainerize_id, reason: `db error: ${error.message}` });
      continue;
    }
    existingHashes.add(key);
    imported.messages += 1;
  }
}

// ─── helpers ───────────────────────────────────────────────────────────

// Pulls existing rows for this client and indexes them by their embedded
// _meta.trainerize_id. Filtering on `<jsonb>->'_meta'->>'trainerize_id'` is
// done client-side (the row count is per-client, never huge).
async function fetchExistingByTzId(admin, table, clientId, jsonbColumn, extraCols = []) {
  const cols = ['id', jsonbColumn, ...extraCols].join(', ');
  const { data } = await admin.from(table).select(cols).eq('client_id', clientId);
  const map = new Map();
  for (const row of data ?? []) {
    const id = extractTrainerizeIdFromJsonbWrap(row[jsonbColumn]);
    if (id) map.set(id, { ...row });
  }
  return map;
}
