# fal.ai integration — `generate-image`

Server-side image generation via fal.ai's FLUX models, exposed as a Netlify
function. Auth-gated, rate-limited, cost-logged. Built so future agents (Axiom
marketing, PKFIT exercise demos, anyone else) can request visuals without each
re-implementing the wiring.

## Endpoint

```
POST /.netlify/functions/generate-image
Authorization: Bearer <supabase access token>
Content-Type: application/json
```

### Request body

```json
{
  "prompt": "A close-up of a tactical compass on dark slate",
  "model": "flux-schnell",
  "aspect_ratio": "1:1",
  "style_prompt": "...optional override...",
  "num_images": 1
}
```

| Field          | Type    | Required | Default        | Notes |
|----------------|---------|----------|----------------|-------|
| `prompt`       | string  | yes      | —              | The user / agent intent. |
| `model`        | string  | no       | `flux-schnell` | One of the keys in the model table below. |
| `aspect_ratio` | string  | no       | `1:1`          | One of `1:1`, `16:9`, `9:16`, `1080:1350`. |
| `style_prompt` | string  | no       | ATLAS canon    | See "Style prompts" below. |
| `num_images`   | integer | no       | `1`            | Clamped to `1..4`. |

### Response (200 OK)

```json
{
  "status": "ok",
  "images": [
    { "url": "https://fal.media/files/...png", "width": 1024, "height": 1024 }
  ],
  "usage": { "cost_usd": 0.003, "model": "flux-schnell" }
}
```

### Errors

| Status | Meaning |
|--------|---------|
| 400    | Bad request (missing prompt, unknown model, unsupported aspect_ratio). |
| 401    | Missing or invalid Supabase bearer token. |
| 405    | Non-POST method. |
| 429    | Per-user rate limit hit. `Retry-After` header set in seconds. |
| 500    | `FAL_API_KEY` env var missing. |
| 502    | Upstream fal.ai error. The body includes the upstream status + first 500 chars. |

## Models and price points

Pricing is hard-coded in the function (`FAL_MODELS` table) so cost-logging
stays accurate even as fal.ai rotates rates. Update the table when fal.ai
publishes new prices.

| Model key       | fal.ai endpoint            | Cost / image | Speed     | Use when |
|-----------------|----------------------------|--------------|-----------|----------|
| `flux-schnell`  | `fal-ai/flux/schnell`      | $0.003       | ~1–2s     | Default. Iteration, drafts, internal previews. |
| `flux-dev`      | `fal-ai/flux/dev`          | $0.025       | ~5–8s     | Mid-tier — better adherence than schnell at ~10x cost. |
| `flux-pro`      | `fal-ai/flux/pro`          | $0.05        | ~10–15s   | Marketing-quality finals. Use sparingly. |

## Style prompts

### Default — ATLAS canon

If `style_prompt` is not provided, the function appends this string to every
prompt it sends fal.ai:

> Premium intelligence-group brand aesthetic. Dark canvas (#0F1318), cream
> accents (#F5F1E8), hair-thin lines, editorial typography mood,
> mechanism-first composition, no hype, no stock iconography, no people
> unless requested.

This is the ATLAS canon prompt. Any agent producing Axiom marketing visuals
inherits the brand look without re-stating it.

### Overrides — per use case

For non-Axiom contexts, pass an explicit `style_prompt` to override.

**PKFIT exercise demos** — clean, instructional, anatomy-clear:

```json
{
  "prompt": "Person performing a barbell back squat, side profile",
  "style_prompt": "Clean instructional photography, neutral gym backdrop, even soft lighting, anatomically clear posture, no motion blur, no text overlays."
}
```

**PKFIT meal photography** — appetizing, top-down, neutral surface:

```json
{
  "prompt": "A high-protein chicken-and-rice bowl with broccoli",
  "style_prompt": "Top-down food photography, natural daylight, neutral wood surface, shallow depth of field, no garnish-fakery, no hands."
}
```

The override fully replaces the ATLAS prompt — it does not concatenate. If you
want both, include the ATLAS string in your override.

## Rate limit

- **Bucket:** `generate-image`
- **Limit:** 10 requests per user per 60 seconds (fixed window)
- **Storage:** the existing `rate_limits` table (`_shared/rate-limit.js`)
- **Behavior on exceed:** `429` with `Retry-After: <seconds>` header

The brief calls for "per-IP" limiting; we use **per-user** instead because the
endpoint is auth-gated and a user cannot rotate identities the way they can
rotate IPs. Stricter for the same scraping-cost defense, and it reuses the
already-deployed primitive.

## Cost logging

Each successful call inserts one row into `public.fal_usage`. The insert is
best-effort — if the log write fails, the user response is unaffected (the
image already generated and we already paid the API cost).

Schema (see `supabase/migrations/0022_fal_usage.sql`):

```sql
create table public.fal_usage (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  model         text not null,
  num_images    integer not null default 1,
  cost_usd      numeric(10,4) not null default 0,
  prompt_chars  integer not null default 0,
  latency_ms    integer,
  aspect_ratio  text,
  created_at    timestamptz not null default now()
);
```

RLS is enabled with no client policies — only the service role reads/writes.

## Env vars

| Name          | Where set       | Notes |
|---------------|-----------------|-------|
| `FAL_API_KEY` | Netlify env     | Already set by Percy. Read at runtime, never bundled. |

## Calling from an agent — example

```bash
curl -sS -X POST "$SITE_URL/.netlify/functions/generate-image" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A precision compass needle laid across a topographic map fragment",
    "model": "flux-schnell",
    "aspect_ratio": "16:9"
  }'
```

For `node` / browser callers, same shape: POST JSON, read `images[].url` from
the response, surface `usage.cost_usd` if you care about budgeting.

## Future expansion

The current function is image-only. Same pattern (auth → rate-limit → fal.ai
fetch → log) extends cleanly to:

- `generate-video` — fal.ai endpoints `fal-ai/runway-gen3/turbo`, `fal-ai/kling-video`
- `generate-audio` — `fal-ai/stable-audio`, `fal-ai/elevenlabs`

Add a `fal_usage.kind` column (default `'image'`) before the first non-image
function ships so all media generation logs into one table.
