import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getAnthropic, loadPrompt, MODEL_BY_TIER } from './_shared/anthropic.js';
import { resolveModelAndKey } from './_shared/tier.js';
import { checkRateLimit } from './_shared/rate-limit.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, profile, role } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');

    const targetClientId = body.clientId ?? user.id;
    if (targetClientId !== user.id && role !== 'coach' && role !== 'owner') {
      return jsonResponse(403, { error: 'Not permitted' });
    }

    const limit = role === 'owner' ? { allowed: true } : await checkRateLimit({
      userId: user.id,
      bucket: 'generate-meal-plan',
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

    const system = loadPrompt('pkfit-system.md') + '\n\n' + loadPrompt('meal-generator.md');
    const input = {
      goal: body.goal ?? 'recomp',
      kcal_target: Number(body.kcal_target ?? 2400),
      protein_g: Number(body.protein_g ?? 180),
      style: body.style ?? 'flexible',
      allergies: body.allergies ?? '',
      dislikes: body.dislikes ?? '',
      profile: body.profile ?? null,
    };

    // Meal plans are structured JSON and consistently exceed Sonnet/Opus
    // wall-time budgets inside Netlify v1's 26 s ceiling. Haiku 4.5 produces
    // a valid 7-day plan in ~17 s at max_tokens=8000. Pin the model here
    // regardless of tier; we still pass the tier-resolved BYO key.
    const { apiKeyOverride } = resolveModelAndKey(profile, role);
    const model = MODEL_BY_TIER.tier1;  // claude-haiku-4-5-20251001
    const anthropic = getAnthropic(apiKeyOverride);
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    });

    const text = resp.content?.[0]?.text ?? '';
    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      plan = match ? JSON.parse(match[0]) : null;
    }
    if (!plan?.days) return jsonResponse(502, { error: 'AI returned unparseable meal plan' });

    // Persist as rows (one per meal) so Meals.jsx can render history cleanly.
    const admin = getAdminClient();
    const rows = [];
    const baseDate = new Date();
    plan.days.forEach((d, dayIdx) => {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + dayIdx);
      (d.meals ?? []).forEach((m) => {
        rows.push({
          client_id: targetClientId,
          day: d.day ?? `Day ${dayIdx + 1}`,
          meal_type: m.meal_type ?? 'meal',
          items: m.items ?? [],
          macros: m.macros ?? {},
          date: date.toISOString().slice(0, 10),
        });
      });
    });
    if (rows.length) {
      const { error } = await admin.from('meals').insert(rows);
      if (error) return jsonResponse(500, { error: error.message });
    }

    return jsonResponse(200, { plan });
  } catch (e) {
    return errorResponse(e);
  }
};
