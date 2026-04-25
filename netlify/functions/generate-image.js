import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { checkRateLimit } from './_shared/rate-limit.js';

// fal.ai FLUX models — endpoint suffix + per-image cost in USD.
// Kept in code (not env) so cost-logging stays accurate even if pricing
// drifts; update this table when fal.ai changes prices.
const FAL_MODELS = {
  'flux-schnell': { endpoint: 'fal-ai/flux/schnell', costUsd: 0.003 },
  'flux-dev':     { endpoint: 'fal-ai/flux/dev',     costUsd: 0.025 },
  'flux-pro':     { endpoint: 'fal-ai/flux/pro',     costUsd: 0.05  },
};

const ALLOWED_ASPECTS = new Set(['1:1', '16:9', '9:16', '1080:1350']);

// ATLAS canon — premium intelligence-group brand aesthetic. Default style
// for any agent calling this function without an explicit style_prompt.
// Future agents producing Axiom marketing visuals get on-brand output by
// default; PKFIT exercise demos override via style_prompt.
const ATLAS_STYLE_PROMPT =
  'Premium intelligence-group brand aesthetic. Dark canvas (#0F1318), ' +
  'cream accents (#F5F1E8), hair-thin lines, editorial typography mood, ' +
  'mechanism-first composition, no hype, no stock iconography, no people ' +
  'unless requested.';

function aspectToSize(aspect) {
  switch (aspect) {
    case '1:1':       return { width: 1024, height: 1024 };
    case '16:9':      return { width: 1280, height: 720  };
    case '9:16':      return { width: 720,  height: 1280 };
    case '1080:1350': return { width: 1080, height: 1350 };
    default:          return { width: 1024, height: 1024 };
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return jsonResponse(400, { error: 'prompt required' });

    const modelKey = body.model ?? 'flux-schnell';
    const modelDef = FAL_MODELS[modelKey];
    if (!modelDef) return jsonResponse(400, { error: `unknown model: ${modelKey}` });

    const aspect = body.aspect_ratio ?? '1:1';
    if (!ALLOWED_ASPECTS.has(aspect)) {
      return jsonResponse(400, { error: `unsupported aspect_ratio: ${aspect}` });
    }

    const numImages = Math.min(Math.max(Number(body.num_images ?? 1), 1), 4);
    const stylePrompt = typeof body.style_prompt === 'string' && body.style_prompt.trim()
      ? body.style_prompt.trim()
      : ATLAS_STYLE_PROMPT;

    // Auth-gated endpoint — per-user limiter is stricter than per-IP because
    // a user can rotate IPs but not identities. 10 req/min keeps fal.ai spend
    // bounded per user while leaving room for normal iteration.
    const limit = await checkRateLimit({
      userId: user.id,
      bucket: 'generate-image',
      max: 10,
      windowSec: 60,
    });
    if (!limit.allowed) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfterSec ?? 60) },
        body: JSON.stringify({ error: `Rate limit. Wait ${limit.retryAfterSec ?? 60}s.` }),
      };
    }

    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'FAL_API_KEY missing' });

    const { width, height } = aspectToSize(aspect);
    const fullPrompt = `${prompt}\n\nStyle: ${stylePrompt}`;

    const falUrl = `https://fal.run/${modelDef.endpoint}`;
    const startedAt = Date.now();
    const falResp = await fetch(falUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        image_size: { width, height },
        num_images: numImages,
        enable_safety_checker: true,
      }),
    });

    if (!falResp.ok) {
      const text = await falResp.text();
      return jsonResponse(502, {
        status: 'error',
        error: `fal.ai ${falResp.status}: ${text.slice(0, 500)}`,
      });
    }

    const falData = await falResp.json();
    const elapsedMs = Date.now() - startedAt;

    // fal.ai returns { images: [{url, width, height, content_type}], ... }
    const images = (falData.images ?? []).map((img) => ({
      url: img.url,
      width: img.width ?? width,
      height: img.height ?? height,
    }));

    const costUsd = Number((modelDef.costUsd * images.length).toFixed(4));

    // Best-effort usage log. Failure to log MUST NOT block the user response —
    // the image was already generated and the user paid the API cost.
    try {
      const admin = getAdminClient();
      await admin.from('fal_usage').insert({
        user_id: user.id,
        model: modelKey,
        num_images: images.length,
        cost_usd: costUsd,
        prompt_chars: fullPrompt.length,
        latency_ms: elapsedMs,
        aspect_ratio: aspect,
      });
    } catch (logErr) {
      console.error('fal_usage log failed:', logErr?.message ?? logErr);
    }

    return jsonResponse(200, {
      status: 'ok',
      images,
      usage: { cost_usd: costUsd, model: modelKey },
    });
  } catch (e) {
    return errorResponse(e);
  }
};
