// read_client_data — high-level per-client data reads.
// run_generator      — trigger a generator (workout, meal_plan, etc.) for a client.
// compare_periods    — cross-time analysis on a single metric.
// aggregate_clients  — roster-level queries.

import { getAdminClient } from '../../supabase-admin.js';
import { RISK } from '../risk.js';

// ----- Date range helpers ---------------------------------------------------

function parseDateRange(range) {
  // Accepts ISO range "2026-04-01..2026-05-01" or relative like "last_30_days",
  // "last_4_weeks", "this_month", "last_week", "previous_4_weeks".
  if (!range) return null;
  if (typeof range !== 'string') return null;
  const dashSplit = range.split('..');
  if (dashSplit.length === 2) {
    return { from: dashSplit[0], to: dashSplit[1] };
  }
  const now = new Date();
  const days = (n) => new Date(now.getTime() - n * 86400_000).toISOString().slice(0, 10);
  switch (range) {
    case 'today':
      return { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    case 'last_7_days':
    case 'last_week':
      return { from: days(7), to: days(0) };
    case 'last_14_days':
      return { from: days(14), to: days(0) };
    case 'last_30_days':
    case 'last_month':
      return { from: days(30), to: days(0) };
    case 'last_4_weeks':
      return { from: days(28), to: days(0) };
    case 'previous_4_weeks':
      return { from: days(56), to: days(28) };
    case 'last_90_days':
      return { from: days(90), to: days(0) };
    default:
      // Try ISO direct.
      if (/^\d{4}-\d{2}-\d{2}$/.test(range)) return { from: range, to: range };
      return null;
  }
}

// ----- read_client_data -----------------------------------------------------

const DATASET_FETCHERS = {
  async intake(admin, clientId) {
    const { data } = await admin
      .from('profiles')
      .select('id, name, email, plan, role, goal, baseline_metrics, intake, created_at')
      .eq('id', clientId)
      .maybeSingle();
    return { intake: data };
  },
  async program(admin, clientId) {
    const { data } = await admin
      .from('program_phases')
      .select('*')
      .eq('client_id', clientId)
      .order('starts_on', { ascending: false })
      .limit(3);
    return { program: data ?? [] };
  },
  async program_history(admin, clientId) {
    const { data } = await admin
      .from('program_phases')
      .select('id, name, phase_index, starts_on, ends_on, focus, notes')
      .eq('client_id', clientId)
      .order('starts_on', { ascending: false });
    return { program_history: data ?? [] };
  },
  async sessions(admin, clientId, range) {
    const r = parseDateRange(range) ?? { from: null, to: null };
    let q = admin
      .from('workout_sessions')
      .select('id, performed_at, exercises, notes, duration_minutes')
      .eq('client_id', clientId)
      .order('performed_at', { ascending: false })
      .limit(50);
    if (r.from) q = q.gte('performed_at', r.from);
    if (r.to) q = q.lte('performed_at', `${r.to}T23:59:59`);
    const { data } = await q;
    return { sessions: data ?? [] };
  },
  async meals(admin, clientId, range) {
    const r = parseDateRange(range) ?? { from: null, to: null };
    let q = admin
      .from('meals')
      .select('id, date, meal_type, items, macros, eaten, eaten_at')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(100);
    if (r.from) q = q.gte('date', r.from);
    if (r.to) q = q.lte('date', r.to);
    const { data } = await q;
    return { meals: data ?? [] };
  },
  async meal_adherence(admin, clientId, range) {
    const r = parseDateRange(range) ?? { from: null, to: null };
    let q = admin
      .from('meal_adherence')
      .select('*')
      .eq('client_id', clientId)
      .order('week_starting', { ascending: false })
      .limit(13);
    if (r.from) q = q.gte('week_starting', r.from);
    if (r.to) q = q.lte('week_starting', r.to);
    const { data } = await q;
    return { meal_adherence: data ?? [] };
  },
  async check_ins(admin, clientId, range) {
    const r = parseDateRange(range) ?? { from: null, to: null };
    let q = admin
      .from('check_ins')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(26);
    if (r.from) q = q.gte('date', r.from);
    if (r.to) q = q.lte('date', r.to);
    const { data } = await q;
    return { check_ins: data ?? [] };
  },
  async reviews(admin, clientId) {
    const { data } = await admin
      .from('reviews')
      .select('id, week_starting, body, coach_comment, generated_by, created_at')
      .eq('client_id', clientId)
      .order('week_starting', { ascending: false })
      .limit(12);
    return { reviews: data ?? [] };
  },
  async metrics(admin, clientId, range) {
    const r = parseDateRange(range) ?? { from: null, to: null };
    let q = admin
      .from('client_metrics')
      .select('*')
      .eq('client_id', clientId)
      .order('recorded_on', { ascending: false })
      .limit(200);
    if (r.from) q = q.gte('recorded_on', r.from);
    if (r.to) q = q.lte('recorded_on', r.to);
    const { data } = await q;
    return { metrics: data ?? [] };
  },
  async photos(admin, clientId) {
    const { data } = await admin
      .from('client_photos')
      .select('id, taken_on, storage_path, kind, notes')
      .eq('client_id', clientId)
      .order('taken_on', { ascending: false })
      .limit(40);
    return { photos: data ?? [] };
  },
  async notes(admin, clientId) {
    const { data } = await admin
      .from('client_notes')
      .select('id, type, title, body, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);
    return { notes: data ?? [] };
  },
  async tags(admin, clientId) {
    const { data } = await admin
      .from('client_tags')
      .select('tag')
      .eq('client_id', clientId);
    return { tags: (data ?? []).map((r) => r.tag) };
  },
  async nutrition_targets(admin, clientId) {
    const { data } = await admin
      .from('client_nutrition_targets')
      .select('*')
      .eq('client_id', clientId)
      .order('effective_from', { ascending: false })
      .limit(5);
    return { nutrition_targets: data ?? [] };
  },
  async habits(admin, clientId, range) {
    const r = parseDateRange(range) ?? { from: null, to: null };
    let q = admin
      .from('habit_completions')
      .select('habit, date, completed')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(120);
    if (r.from) q = q.gte('date', r.from);
    if (r.to) q = q.lte('date', r.to);
    const { data } = await q;
    return { habits: data ?? [] };
  },
  async dm_thread(admin, clientId) {
    const { data: thread } = await admin
      .from('dm_threads')
      .select('id, last_activity_at')
      .eq('client_id', clientId)
      .maybeSingle();
    if (!thread) return { dm_thread: { thread: null, messages: [] } };
    const { data: msgs } = await admin
      .from('dm_messages')
      .select('id, author_id, content, created_at, read_by_coach, read_by_client')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: false })
      .limit(50);
    return { dm_thread: { thread, messages: (msgs ?? []).reverse() } };
  },
};

function summarizeClient(data) {
  const intake = data.intake?.intake ?? data.intake;
  const name = intake?.name ?? data.intake?.name ?? 'Client';
  const plan = intake?.plan ?? data.intake?.plan ?? 'unknown';
  const sessionCount = data.sessions?.length ?? 0;
  const lastSession = data.sessions?.[0]?.performed_at ?? 'never';
  const lastCheckIn = data.check_ins?.[0]?.date ?? 'never';
  const noteCount = data.notes?.length ?? 0;
  const program = data.program?.[0];
  return (
    `${name} (${plan}). ` +
    (program ? `Current phase: ${program.name ?? 'unnamed'} (week ${program.phase_index ?? '?'}). ` : '') +
    `${sessionCount} session(s) tracked. Last session: ${lastSession}. ` +
    `Last check-in: ${lastCheckIn}. ${noteCount} note(s) on file.`
  );
}

export const read_client_data = {
  name: 'read_client_data',
  description:
    'High-level read of a client\'s data. The dataset parameter chooses the slice: program, program_history, ' +
    'sessions, meals, meal_adherence, check_ins, reviews, metrics, photos, notes, tags, nutrition_targets, habits, ' +
    'dm_thread, intake, or "all" for a composite. date_range accepts ISO ranges ("2026-04-01..2026-05-01") or ' +
    'relative ("last_7_days", "last_4_weeks", "previous_4_weeks", "this_month").',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      client_id: { type: 'string' },
      dataset: { type: 'string' },
      date_range: { type: 'string', description: 'Optional. ISO range or relative phrase.' },
    },
    required: ['client_id', 'dataset'],
  },
  async execute({ client_id, dataset, date_range }) {
    if (!client_id) return { error: 'client_id required' };
    if (!dataset) return { error: 'dataset required' };
    const admin = getAdminClient();
    const fetchers = Object.keys(DATASET_FETCHERS);
    const targets = dataset === 'all' ? fetchers : [dataset];
    const unknown = targets.filter((t) => !DATASET_FETCHERS[t]);
    if (unknown.length) {
      return { error: `unknown dataset(s): ${unknown.join(', ')}. Known: ${fetchers.join(', ')}` };
    }
    const data = {};
    for (const t of targets) {
      try {
        Object.assign(data, await DATASET_FETCHERS[t](admin, client_id, date_range));
      } catch (e) {
        data[`${t}_error`] = e?.message ?? String(e);
      }
    }
    const summary = dataset === 'all' ? summarizeClient(data) : `Read dataset "${dataset}" for client ${client_id}.`;
    return { data, summary };
  },
};

// ----- run_generator --------------------------------------------------------

const GENERATOR_ENDPOINTS = {
  workout: '/.netlify/functions/generate-workout',
  meal_plan: '/.netlify/functions/generate-meal-plan',
  weekly_review: '/.netlify/functions/generate-weekly-review',
  meal_photo: '/.netlify/functions/gemini-meal-photo',
  form_check: '/.netlify/functions/gemini-form-check',
};

// Per-generator approximate cost estimates (USD). Used for transparency in
// the confirmation prompt — not a charge.
const GENERATOR_COST = {
  workout: 0.04,
  meal_plan: 0.02,
  weekly_review: 0.10,
  meal_photo: 0.005,
  form_check: 0.05,
};

export const run_generator = {
  name: 'run_generator',
  description:
    'Trigger one of the existing generators for a specific client. Supported: workout, meal_plan, weekly_review, ' +
    'meal_photo (requires params.image_url), form_check (requires params.video_url). ' +
    'Output is NOT auto-saved — caller approves and writes via supabase_query_write or a dedicated save flow.',
  risk: RISK.MEDIUM,
  approval: 'medium',
  input_schema: {
    type: 'object',
    properties: {
      client_id: { type: 'string' },
      generator: { type: 'string', enum: Object.keys(GENERATOR_ENDPOINTS) },
      params: { type: 'object' },
    },
    required: ['client_id', 'generator'],
  },
  async execute({ client_id, generator, params = {} }, { internalBaseUrl, callerToken } = {}) {
    if (!client_id) return { error: 'client_id required' };
    const endpoint = GENERATOR_ENDPOINTS[generator];
    if (!endpoint) {
      return { error: `unknown generator "${generator}". Supported: ${Object.keys(GENERATOR_ENDPOINTS).join(', ')}` };
    }
    const base = internalBaseUrl ?? process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? 'http://localhost:8888';
    try {
      const res = await fetch(`${base}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(callerToken ? { Authorization: `Bearer ${callerToken}` } : {}),
          'X-Agent-Internal': 'true',
        },
        body: JSON.stringify({ client_id, ...params }),
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 4000) }; }
      if (!res.ok) {
        return { error: `${generator} failed (${res.status}): ${(typeof json === 'object' ? json.error ?? json.message ?? text : text).slice(0, 400)}` };
      }
      return {
        output: json,
        generation_id: json?.id ?? null,
        cost_estimate: GENERATOR_COST[generator] ?? null,
        summary: `Ran ${generator} for client ${client_id}.`,
      };
    } catch (e) {
      return { error: `run_generator failed: ${e?.message ?? String(e)}` };
    }
  },
};

// ----- compare_periods ------------------------------------------------------

function avgOrNull(arr) {
  const nums = arr.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
}

async function metricForRange(admin, clientId, metric, range) {
  const r = parseDateRange(range);
  if (!r) return { error: `unknown period: ${range}` };
  // Map common metrics. For "bench_strength" we look at workout_sessions for
  // exercises containing "bench" and pull top-set load if present.
  if (metric === 'weight' || metric === 'body_fat') {
    const { data } = await admin
      .from('check_ins')
      .select(metric)
      .eq('client_id', clientId)
      .gte('date', r.from)
      .lte('date', r.to);
    const values = (data ?? []).map((d) => Number(d[metric])).filter((n) => !Number.isNaN(n));
    return { avg: avgOrNull(values), count: values.length };
  }
  if (metric === 'compliance' || metric === 'compliance_rate') {
    const { data } = await admin
      .from('meal_adherence')
      .select('percent')
      .eq('client_id', clientId)
      .gte('week_starting', r.from)
      .lte('week_starting', r.to);
    const values = (data ?? []).map((d) => Number(d.percent)).filter((n) => !Number.isNaN(n));
    return { avg: avgOrNull(values), count: values.length };
  }
  if (metric === 'sessions_logged' || metric === 'session_count') {
    const { count } = await admin
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('performed_at', r.from)
      .lte('performed_at', `${r.to}T23:59:59`);
    return { count: count ?? 0 };
  }
  // Generic strength lookup: scan exercises for keyword match, take max load.
  const keyword = metric.replace(/_strength|_1rm|_load/i, '').toLowerCase();
  const { data } = await admin
    .from('workout_sessions')
    .select('id, performed_at, exercises')
    .eq('client_id', clientId)
    .gte('performed_at', r.from)
    .lte('performed_at', `${r.to}T23:59:59`)
    .limit(60);
  let topLoad = null;
  let sessionCount = 0;
  let rpeSum = 0, rpeN = 0;
  for (const s of data ?? []) {
    const arr = Array.isArray(s.exercises) ? s.exercises : [];
    let matched = false;
    for (const ex of arr) {
      const name = typeof ex === 'string' ? ex : (ex?.name ?? ex?.exercise ?? '');
      if (typeof name === 'string' && name.toLowerCase().includes(keyword)) {
        matched = true;
        const load = typeof ex === 'object' ? Number(ex.top_load ?? ex.load ?? ex.weight) : null;
        if (load && (topLoad == null || load > topLoad)) topLoad = load;
        const rpe = typeof ex === 'object' ? Number(ex.rpe) : null;
        if (rpe) { rpeSum += rpe; rpeN += 1; }
      }
    }
    if (matched) sessionCount += 1;
  }
  return {
    top_load: topLoad,
    session_count: sessionCount,
    avg_rpe: rpeN ? Math.round((rpeSum / rpeN) * 10) / 10 : null,
  };
}

export const compare_periods = {
  name: 'compare_periods',
  description:
    'Compare a single metric between two periods for one client. Metric examples: weight, body_fat, compliance, ' +
    'sessions_logged, bench_strength, squat_strength. Periods: ISO range or relative phrase ("last_4_weeks", ' +
    '"previous_4_weeks", etc.). Returns numeric delta + plain-English summary.',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      client_id: { type: 'string' },
      metric: { type: 'string' },
      period_a: { type: 'string' },
      period_b: { type: 'string' },
    },
    required: ['client_id', 'metric', 'period_a', 'period_b'],
  },
  async execute({ client_id, metric, period_a, period_b }) {
    if (!client_id || !metric || !period_a || !period_b) {
      return { error: 'client_id, metric, period_a, period_b are all required' };
    }
    const admin = getAdminClient();
    const a = await metricForRange(admin, client_id, metric, period_a);
    const b = await metricForRange(admin, client_id, metric, period_b);
    const delta = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (typeof a[k] === 'number' && typeof b[k] === 'number') {
        const d = a[k] - b[k];
        delta[k] = { period_a: a[k], period_b: b[k], delta: Math.round(d * 100) / 100 };
      } else {
        delta[k] = { period_a: a[k], period_b: b[k] };
      }
    }
    const summary = `Comparing ${metric} for client ${client_id}: ${period_a} vs ${period_b}. ` +
      Object.entries(delta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).slice(0, 4).join('; ');
    return { delta, summary };
  },
};

// ----- aggregate_clients ----------------------------------------------------

export const aggregate_clients = {
  name: 'aggregate_clients',
  description:
    'Cross-client queries. Filter examples: { status: "active", no_check_in_days: ">7" }, ' +
    '{ tier: "tier1", acquired_within_days: 30 }, { compliance: "<60%", period: "last_4_weeks" }, ' +
    '{ tag: "bulking" }, { sort: "mrr_contribution", limit: 10 }.',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      filter: { type: 'object' },
    },
    required: ['filter'],
  },
  async execute({ filter = {} }) {
    const admin = getAdminClient();
    // Start broad, then narrow client-side.
    let q = admin.from('profiles').select('id, name, email, plan, role, created_at, status, last_seen_at');

    if (filter.tier) q = q.eq('plan', filter.tier);
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.acquired_within_days) {
      const from = new Date(Date.now() - Number(filter.acquired_within_days) * 86400_000).toISOString();
      q = q.gte('created_at', from);
    }
    q = q.limit(500);
    const { data: profs, error } = await q;
    if (error) return { error: error.message };
    let clients = (profs ?? []).filter((p) => p.role === 'client' || !p.role);

    if (filter.tag) {
      const { data: tagged } = await admin.from('client_tags').select('client_id').eq('tag', filter.tag);
      const tagSet = new Set((tagged ?? []).map((r) => r.client_id));
      clients = clients.filter((c) => tagSet.has(c.id));
    }

    if (filter.no_check_in_days) {
      const threshold = parseInt(String(filter.no_check_in_days).replace(/[^\d]/g, ''), 10);
      const since = new Date(Date.now() - threshold * 86400_000).toISOString().slice(0, 10);
      const ids = clients.map((c) => c.id);
      if (ids.length) {
        const { data: ci } = await admin
          .from('check_ins')
          .select('client_id, date')
          .in('client_id', ids)
          .gte('date', since);
        const checkedIn = new Set((ci ?? []).map((r) => r.client_id));
        clients = clients.filter((c) => !checkedIn.has(c.id));
      }
    }

    if (filter.sort === 'mrr_contribution') {
      const order = { tier3: 3, tier2: 2, tier1: 1 };
      clients.sort((a, b) => (order[b.plan] ?? 0) - (order[a.plan] ?? 0));
    }
    if (filter.limit) clients = clients.slice(0, Number(filter.limit));

    return {
      clients,
      count: clients.length,
      summary: `Filter matched ${clients.length} client(s).`,
    };
  },
};
