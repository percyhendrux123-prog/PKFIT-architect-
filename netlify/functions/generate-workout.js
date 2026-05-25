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
          // 4-6 day programs with 5-7 exercises x full notes easily exceed the old
      // 2048-token cap. Truncated JSON surfaces to the client as a generic
      // parse error mid-array (position ~4270 was the in-the-wild case).
      // 8000 gives comfortable headroom for the largest realistic program.
      const resp = await anthropic.messages.create({
              model,
              max_tokens: 8000,
              system,
              messages: [{ role: 'user', content: JSON.stringify(input) }],
      });

      const text = resp.content?.[0]?.text ?? '';

      // If Claude hit the output ceiling the JSON IS truncated - surface that
      // clearly instead of letting JSON.parse cough up "Expected ',' or ']' at
      // position N" which doesn't tell anyone what actually broke.
      if (resp.stop_reason === 'max_tokens') {
              return jsonResponse(502, {
                        error: 'workout response truncated - output cap reached',
                        stop_reason: resp.stop_reason,
                        chars: text.length,
              });
      }

      let program = null;
          try {
                  program = JSON.parse(text);
          } catch {
                  // Strip a leading ```json fence (some prompts get fenced even when told
            // not to wrap) before falling back to brace-extraction.
            const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                  if (fenced) {
                            try { program = JSON.parse(fenced[1]); } catch { /* try next */ }
                  }
                  if (!program) {
                            const match = text.match(/\{[\s\S]*\}/);
                            if (match) {
                                        try { program = JSON.parse(match[0]); } catch { /* fall through */ }
                            }
                  }
          }
          if (!program) {
                  return jsonResponse(502, {
                            error: 'AI returned unparseable program',
                            chars: text.length,
                            stop_reason: resp.stop_reason ?? null,
                  });
          }

      const admin = getAdminClient();

      // Archive any currently-active programs for this client - keep the roster
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
