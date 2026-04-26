import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getAnthropic, loadPrompt } from './_shared/anthropic.js';
import { resolveModelAndKey } from './_shared/tier.js';
import { checkRateLimit } from './_shared/rate-limit.js';

function startOfWeek(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getUTCDay();
  const diff = (day + 6) % 7; // week starts Monday
  copy.setUTCDate(copy.getUTCDate() - diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, role } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');
    const targetClientId = body.clientId ?? user.id;
    if (targetClientId !== user.id && role !== 'coach' && role !== 'owner') {
      return jsonResponse(403, { error: 'Not permitted' });
    }

    const limit = role === 'owner' ? { allowed: true } : await checkRateLimit({
      userId: user.id,
      bucket: 'generate-weekly-review',
      max: 5,
      windowSec: 3600,
    });
    if (!limit.allowed) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfterSec ?? 60) },
        body: JSON.stringify({ error: `Rate limit. Wait ${limit.retryAfterSec ?? 60}s.` }),
      };
    }

    const admin = getAdminClient();
    const weekStart = startOfWeek();
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: profile },
      { data: checkIns },
      { data: programs },
      { data: habits },
      { data: sessions },
      { data: priorReview },
    ] = await Promise.all([
      admin.from('profiles').select('*').eq('id', targetClientId).maybeSingle(),
      admin
        .from('check_ins')
        .select('*')
        .eq('client_id', targetClientId)
        .gte('created_at', sevenDaysAgoIso)
        .order('date', { ascending: true }),
      admin
        .from('programs')
        .select('*')
        .eq('client_id', targetClientId)
        .gte('created_at', sevenDaysAgoIso),
      admin
        .from('habits')
        .select('*')
        .eq('client_id', targetClientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('workout_sessions')
        .select('performed_at,duration_min,rpe_avg,notes')
        .eq('client_id', targetClientId)
        .gte('performed_at', sevenDaysAgoIso)
        .order('performed_at', { ascending: true }),
      admin
        .from('reviews')
        .select('week_starting,summary,constraints,adjustments,adjustments_state,metrics,coach_comment')
        .eq('client_id', targetClientId)
        .lt('week_starting', weekStart.toISOString().slice(0, 10))
        .order('week_starting', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const habitRow = habits?.data ?? habits ?? null;
    const habitList = habitRow?.habit_list ?? [];
    const habitHistory = habitRow?.check_history ?? {};

    const input = {
      profile: profile
        ? { goal: profile.plan, plan: profile.plan, loop_stage: profile.loop_stage }
        : {},
      check_ins: checkIns ?? [],
      programs: programs ?? [],
      sessions: sessions ?? [],
      habit_list: habitList,
      habit_history: habitHistory,
      week_starting: weekStart.toISOString().slice(0, 10),
      prior_review: priorReview
        ? (() => {
            const adj = priorReview.adjustments ?? [];
            const state = priorReview.adjustments_state ?? {};
            const installed = adj
              .map((text, i) => (state?.[i] ? text : null))
              .filter(Boolean);
            const skipped = adj
              .map((text, i) => (state?.[i] ? null : text))
              .filter(Boolean);
            return {
              week_starting: priorReview.week_starting,
              summary: priorReview.summary,
              constraints: priorReview.constraints,
              adjustments: adj,
              adjustments_installed: installed,
              adjustments_skipped: skipped,
              metrics: priorReview.metrics,
              coach_comment: priorReview.coach_comment ?? null,
            };
          })()
        : null,
    };

    const system = loadPrompt('pkfit-system.md') + '\n\n' + loadPrompt('weekly-review.md');
    const { model, apiKeyOverride } = resolveModelAndKey(profile, role);
    const anthropic = getAnthropic(apiKeyOverride);
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    });

    const text = resp.content?.[0]?.text ?? '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!parsed) return jsonResponse(502, { error: 'AI returned unparseable review' });

    const { data: saved, error } = await admin
      .from('reviews')
      .upsert(
        {
          client_id: targetClientId,
          week_starting: input.week_starting,
          summary: parsed.summary ?? '',
          constraints: parsed.constraints ?? [],
          adjustments: parsed.adjustments ?? [],
          metrics: parsed.metrics ?? {},
        },
        { onConflict: 'client_id,week_starting' },
      )
      .select()
      .maybeSingle();
    if (error) return jsonResponse(500, { error: error.message });

    return jsonResponse(200, { review: saved });
  } catch (e) {
    return errorResponse(e);
  }
};
