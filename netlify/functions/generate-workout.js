import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getAnthropic, loadPrompt } from './_shared/anthropic.js';
import { resolveModelAndKey } from './_shared/tier.js';
import { checkRateLimit } from './_shared/rate-limit.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, profile, role } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');

    const targetClientId = body.clientId ?? user.id;
    // Only the client themself, a coach, or the owner can generate for a client.
    if (targetClientId !== user.id && role !== 'coach' && role !== 'owner') {
      return jsonResponse(403, { error: 'Not permitted' });
    }

    const limit = role === 'owner' ? { allowed: true } : await checkRateLimit({
      userId: user.id,
      bucket: 'generate-workout',
      max: 10,
      windowSec: 3600,
    });
    if (!limit.allowed) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfterSec ?? 60) },
        body: JSON.stringify({ error: `Rate limit. Wait ${limit.retryAfterSec ?? 60}s.` }),
      };
    }

    const system = loadPrompt('pkfit-system.md') + '\n\n' + loadPrompt('workout-generator.md');
    const input = {
      goal: body.goal ?? 'recomp',
      training_days: Number(body.training_days ?? 4),
      experience: body.experience ?? 'intermediate',
      equipment: body.equipment ?? 'full_gym',
      constraint: body.constraint ?? '',
      profile: body.profile ?? null,
    };

    const { model, apiKeyOverride } = resolveModelAndKey(profile, role);
    const anthropic = getAnthropic(apiKeyOverride);
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    });

    const text = resp.content?.[0]?.text ?? '';
    let program;
    try {
      program = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      program = match ? JSON.parse(match[0]) : null;
    }
    if (!program) return jsonResponse(502, { error: 'AI returned unparseable program' });

    const admin = getAdminClient();

    // Archive any currently-active programs for this client — keep the roster
    // clean: one active program at a time.
    await admin
      .from('programs')
      .update({ status: 'archived' })
      .eq('client_id', targetClientId)
      .eq('status', 'active');

    const { data: inserted, error } = await admin
      .from('programs')
      .insert({
        client_id: targetClientId,
        week_number: program.week_number ?? 1,
        schedule: program.schedule ?? { title: program.title },
        exercises: program.exercises ?? [],
        status: 'active',
      })
      .select()
      .maybeSingle();
    if (error) return jsonResponse(500, { error: error.message });

    return jsonResponse(200, { program: { ...inserted, title: program.title } });
  } catch (e) {
    return errorResponse(e);
  }
};
