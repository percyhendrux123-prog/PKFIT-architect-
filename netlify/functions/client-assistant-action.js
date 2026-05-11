// PKFIT Operator Assistant — Action Handler
//
// Executes one of the 5 actions the Operator Assistant can propose:
//   swap_exercise, log_meal, log_check_in, message_coach, flag_for_review
//
// Security model:
//   1. Bearer token auth (Supabase user)
//   2. Tier gate: only tier3 (Premium) executes mutations. tier2 (Full
//      Integration) is chat-only and gets 403 from this endpoint. tier1,
//      trial, and unplanned profiles never reach here (gated upstream by
//      client-assistant.js).
//   3. Conversation lineage check: the action must have been proposed in
//      the last assistant message of the given conversation. Prevents
//      clients from crafting arbitrary mutation POSTs.
//   4. Per-client scoping: mutations only apply to the authenticated
//      user's own rows. RLS reinforces this server-side.
//
// Logged side effects:
//   Every executed action is logged into client_notes (type='ai_action_log')
//   so Percy can audit what Claude did via the coach surface.

import { getAdminClient, getAnonClient } from './_shared/supabase-admin.js';
import { tierFromProfile } from './_shared/tier.js';
import { isOwnerEmail } from './_shared/owner.js';
import { checkRateLimit } from './_shared/rate-limit.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const ACTION_RPM = 10;
const ACTION_WINDOW_SEC = 60;

// Supported actions and their required params (very loose validation —
// types are enforced by Supabase column types).
const ACTION_SCHEMA = {
  swap_exercise: ['original_exercise_name', 'substitute_exercise_name', 'reason'],
  log_meal: ['meal_type', 'items'],
  log_check_in: ['date'],
  message_coach: ['message_body'],
  flag_for_review: ['note'],
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function authenticate(req) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    const err = new Error('Missing Authorization bearer token');
    err.statusCode = 401;
    throw err;
  }
  const token = header.slice('Bearer '.length).trim();
  const anon = getAnonClient();
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Invalid session');
    err.statusCode = 401;
    throw err;
  }
  return data.user;
}

// Pull the params encoded inside the last assistant message of the given
// conversation. The assistant proposes actions as inline tags:
//   [ACTION:swap_exercise|key1=val1|key2=val2|...]
// We parse and compare to what the client claims they're confirming.
async function fetchProposedAction(admin, conversationId, expectedAction) {
  const { data: lastAssistantMsg } = await admin
    .from('conversation_messages')
    .select('content, created_at')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastAssistantMsg?.content) return null;

  const match = lastAssistantMsg.content.match(/\[ACTION:([a-z_]+)\|([^\]]+)\]/i);
  if (!match) return null;

  const [, actionType, paramsBlob] = match;
  if (actionType !== expectedAction) return null;

  const params = {};
  for (const pair of paramsBlob.split('|')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    params[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }

  return { actionType, params };
}

// ---- Action handlers -------------------------------------------------------

async function actSwapExercise(admin, userId, params) {
  const { original_exercise_name, substitute_exercise_name, reason } = params;

  // Find the most recent workout_session for this client.
  const { data: session, error } = await admin
    .from('workout_sessions')
    .select('id, exercises, notes')
    .eq('client_id', userId)
    .order('performed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Workout lookup failed: ${error.message}`);
  if (!session) {
    return {
      success: false,
      reason: 'No workout session found to modify. Ask Percy to assign one first.',
    };
  }

  // Swap in the exercises JSONB. Tolerate either array-of-strings or
  // array-of-objects-with-{name} — historically both shapes have appeared.
  const exercises = Array.isArray(session.exercises) ? [...session.exercises] : [];
  let swapped = false;
  for (let i = 0; i < exercises.length; i++) {
    const entry = exercises[i];
    const nameField =
      typeof entry === 'string'
        ? entry
        : entry?.name ?? entry?.exercise ?? entry?.title ?? '';
    if (
      typeof nameField === 'string' &&
      nameField.toLowerCase().includes(original_exercise_name.toLowerCase())
    ) {
      if (typeof entry === 'string') {
        exercises[i] = substitute_exercise_name;
      } else {
        exercises[i] = { ...entry, name: substitute_exercise_name };
      }
      swapped = true;
      break;
    }
  }

  if (!swapped) {
    return {
      success: false,
      reason: `Could not find "${original_exercise_name}" in the current workout to swap.`,
    };
  }

  const newNote = `${session.notes ?? ''}\n[AI swap ${new Date().toISOString()}] ${original_exercise_name} → ${substitute_exercise_name}. Reason: ${reason}`.trim();

  const { error: updErr } = await admin
    .from('workout_sessions')
    .update({ exercises, notes: newNote })
    .eq('id', session.id)
    .eq('client_id', userId); // belt-and-suspenders on top of RLS

  if (updErr) throw new Error(`Update failed: ${updErr.message}`);

  return {
    success: true,
    summary: `Swapped ${original_exercise_name} → ${substitute_exercise_name}.`,
    workout_session_id: session.id,
  };
}

async function actLogMeal(admin, userId, params) {
  const { meal_type, items, macros, date } = params;
  const today = new Date().toISOString().slice(0, 10);

  // items can come in as a string (e.g. "200g chicken, 1 cup rice") or
  // a JSON array. Normalize to array-of-strings.
  let itemsArray;
  if (Array.isArray(items)) {
    itemsArray = items;
  } else if (typeof items === 'string') {
    itemsArray = items
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    itemsArray = [];
  }

  // macros may also come as a string like "p=200 c=320 f=80". Parse loosely.
  let macrosObj = {};
  if (macros && typeof macros === 'object') {
    macrosObj = macros;
  } else if (typeof macros === 'string') {
    const parts = macros.match(/(\w+)\s*[=:]\s*([\d.]+)/g) || [];
    for (const p of parts) {
      const [k, v] = p.split(/[=:]/);
      macrosObj[k.trim().toLowerCase()] = Number(v.trim());
    }
  }

  const { data: meal, error } = await admin
    .from('meals')
    .insert({
      client_id: userId,
      meal_type: meal_type ?? 'snack',
      items: itemsArray,
      macros: macrosObj,
      date: date ?? today,
      eaten: true,
      eaten_at: new Date().toISOString(),
    })
    .select('id, date, meal_type')
    .maybeSingle();

  if (error) throw new Error(`Meal insert failed: ${error.message}`);

  return {
    success: true,
    summary: `Logged ${meal.meal_type} for ${meal.date}.`,
    meal_id: meal.id,
  };
}

async function actLogCheckIn(admin, userId, params) {
  const { date, weight, body_fat, notes } = params;
  const dateValue = date ?? new Date().toISOString().slice(0, 10);

  const payload = {
    client_id: userId,
    date: dateValue,
  };
  if (weight != null) payload.weight = Number(weight);
  if (body_fat != null) payload.body_fat = Number(body_fat);
  if (notes) payload.notes = `[AI assisted] ${notes}`;

  const { data: ci, error } = await admin
    .from('check_ins')
    .insert(payload)
    .select('id, date')
    .maybeSingle();

  if (error) throw new Error(`Check-in insert failed: ${error.message}`);

  return {
    success: true,
    summary: `Check-in logged for ${ci.date}.`,
    check_in_id: ci.id,
  };
}

async function actMessageCoach(admin, userId, params) {
  const { message_body, urgency } = params;
  const messageContent = `[AI-Assisted | urgency=${urgency ?? 'LOW'}] ${message_body}`;

  // Find or create the dm_thread for this client.
  let { data: thread } = await admin
    .from('dm_threads')
    .select('id')
    .eq('client_id', userId)
    .maybeSingle();

  if (!thread) {
    const { data: newThread, error: createErr } = await admin
      .from('dm_threads')
      .insert({ client_id: userId })
      .select('id')
      .maybeSingle();
    if (createErr) throw new Error(`Thread create failed: ${createErr.message}`);
    thread = newThread;
  }

  const { data: msg, error } = await admin
    .from('dm_messages')
    .insert({
      thread_id: thread.id,
      author_id: userId,
      content: messageContent,
      read_by_client: true,
      read_by_coach: false,
    })
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Message insert failed: ${error.message}`);

  // Touch the thread for sorting in coach inbox.
  await admin
    .from('dm_threads')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', thread.id);

  // HIGH urgency triggers a Slack alert via the same #dm-alerts webhook
  // Lane 1 uses. Fire-and-forget; errors are non-blocking.
  if (urgency === 'HIGH' && process.env.SLACK_WEBHOOK_URL_OPS) {
    try {
      const { data: prof } = await admin
        .from('profiles')
        .select('name, email')
        .eq('id', userId)
        .maybeSingle();
      const who = prof?.name || prof?.email || userId;
      await fetch(process.env.SLACK_WEBHOOK_URL_OPS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🟥 HIGH-URGENCY AI-routed message from ${who}\n>${message_body.slice(0, 280)}`,
        }),
      });
    } catch {
      // Slack failure is non-blocking.
    }
  }

  return {
    success: true,
    summary: 'Message dropped into Percy\'s DM thread. He\'ll see it in his inbox.',
    message_id: msg.id,
    urgency: urgency ?? 'LOW',
  };
}

async function actFlagForReview(admin, userId, params) {
  const { note, target_type, target_id } = params;

  const body = target_type
    ? `[Flag | target=${target_type}${target_id ? `:${target_id}` : ''}] ${note}`
    : note;

  const { data: noteRow, error } = await admin
    .from('client_notes')
    .insert({
      client_id: userId,
      author_id: userId,
      type: 'ai_flag',
      title: 'Flagged for review',
      body,
    })
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Flag insert failed: ${error.message}`);

  return {
    success: true,
    summary: 'Flagged for Percy\'s next review of your file.',
    note_id: noteRow.id,
  };
}

// Action log: every executed action also writes a row to client_notes so
// Percy has a single place to audit all AI-side mutations.
async function logActionAudit(admin, userId, conversationId, action, result) {
  try {
    await admin.from('client_notes').insert({
      client_id: userId,
      author_id: userId,
      type: 'ai_action_log',
      title: `AI action: ${action}`,
      body: `Conversation: ${conversationId}\nResult: ${JSON.stringify(result).slice(0, 2000)}`,
    });
  } catch {
    // Audit failure is non-blocking.
  }
}

// ---- HTTP handler ----------------------------------------------------------

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let user;
  try {
    user = await authenticate(req);
  } catch (e) {
    return jsonResponse(e.statusCode ?? 401, { error: e.message });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { conversation_id: conversationId, action, params } = body || {};
  if (!conversationId || typeof conversationId !== 'string') {
    return jsonResponse(400, { error: 'conversation_id required' });
  }
  if (!action || !(action in ACTION_SCHEMA)) {
    return jsonResponse(400, { error: 'Unknown or missing action' });
  }

  const isOwner = isOwnerEmail(user.email);

  // Rate limit: 10 actions per minute (10 RPM) per user. Owner bypasses.
  if (!isOwner) {
    const limit = await checkRateLimit({
      userId: user.id,
      bucket: 'assistant_action',
      max: ACTION_RPM,
      windowSec: ACTION_WINDOW_SEC,
    });
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({ error: `Rate limit. Wait ${limit.retryAfterSec ?? 30}s.` }),
        {
          status: 429,
          headers: { ...JSON_HEADERS, 'Retry-After': String(limit.retryAfterSec ?? 30) },
        },
      );
    }
  }

  const admin = getAdminClient();

  // Tier gate. Only tier3 (Premium) executes mutating actions. Owner
  // bypass for testing.
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, role')
    .eq('id', user.id)
    .maybeSingle();
  const tier = isOwner ? 'owner' : tierFromProfile(profile);
  if (!isOwner && tier !== 'tier3') {
    return jsonResponse(403, {
      error: 'tier_required',
      message:
        'Action execution is a Premium-tier feature. Reach out to Percy to upgrade if you want full assistant capability.',
    });
  }

  // Conversation lineage check: action must match what the assistant
  // proposed in the last message of this conversation.
  const proposed = await fetchProposedAction(admin, conversationId, action);
  if (!proposed && !isOwner) {
    return jsonResponse(409, {
      error: 'no_proposed_action',
      message:
        'No matching action proposal found in this conversation. The assistant must propose an action before it can be executed.',
    });
  }

  // Merge proposed params (from Claude) with client-confirmed params (from
  // the frontend). Client params override the proposed values to allow
  // small edits ("yes, but use cable row instead of machine row").
  const mergedParams = { ...(proposed?.params ?? {}), ...(params ?? {}) };

  // Required-field check.
  for (const required of ACTION_SCHEMA[action]) {
    if (!mergedParams[required]) {
      return jsonResponse(400, {
        error: 'missing_param',
        message: `Action ${action} requires ${required}.`,
      });
    }
  }

  let result;
  try {
    switch (action) {
      case 'swap_exercise':
        result = await actSwapExercise(admin, user.id, mergedParams);
        break;
      case 'log_meal':
        result = await actLogMeal(admin, user.id, mergedParams);
        break;
      case 'log_check_in':
        result = await actLogCheckIn(admin, user.id, mergedParams);
        break;
      case 'message_coach':
        result = await actMessageCoach(admin, user.id, mergedParams);
        break;
      case 'flag_for_review':
        result = await actFlagForReview(admin, user.id, mergedParams);
        break;
      default:
        return jsonResponse(400, { error: 'Unhandled action' });
    }
  } catch (e) {
    return jsonResponse(500, { error: e?.message ?? 'Action execution failed' });
  }

  // Audit log every executed action (best-effort, non-blocking).
  await logActionAudit(admin, user.id, conversationId, action, result);

  return jsonResponse(200, result);
};
