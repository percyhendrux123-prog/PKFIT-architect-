#!/usr/bin/env node
//
// One-shot generator for the cinematic landing trailer.
//
// Calls fal.ai's video model with a PKFIT brand prompt, polls for completion,
// downloads the resulting mp4 to public/trailer/pkfit-intro.mp4. Re-run to
// regenerate; the runtime never calls fal.ai for the trailer — the static
// asset is served directly from /trailer/pkfit-intro.mp4.
//
// Usage:
//   FAL_KEY=fal_xxx node scripts/generate-trailer.js
//
// Optional overrides:
//   FAL_VIDEO_MODEL=fal-ai/veo3        # default
//   TRAILER_PROMPT="..."               # override the default brand prompt

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(PROJECT_ROOT, 'public', 'trailer');
const OUT_FILE = resolve(OUT_DIR, 'pkfit-intro.mp4');

const DEFAULT_PROMPT = [
  'Cinematic 8-second intro for the PKFIT coaching brand.',
  'Pure black background. A single bar of warm gold (#C9A84C) pulses once,',
  'expanding into the wordmark "PKFIT" rendered in Bebas Neue, all caps,',
  'high contrast, slight grain. Beneath it, the line "Powered by /operate/axiom"',
  'fades in in monospace. Slow dolly forward, depth of field, no people, no logos.',
  'Tone: surgical, restrained, premium. No emoji. No motion blur. No text glitches.',
].join(' ');

async function main() {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    console.error('FAL_KEY env var is required.');
    process.exit(1);
  }
  const model = process.env.FAL_VIDEO_MODEL || 'fal-ai/veo3';
  const prompt = process.env.TRAILER_PROMPT || DEFAULT_PROMPT;

  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  console.log(`[trailer] submitting to ${model}...`);
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, duration: 8, aspect_ratio: '16:9' }),
  });
  if (!submit.ok) {
    console.error(`[trailer] submit failed: ${submit.status} ${await submit.text()}`);
    process.exit(2);
  }
  const submitJson = await submit.json();
  const requestId = submitJson.request_id;
  if (!requestId) {
    console.error(`[trailer] no request_id in response: ${JSON.stringify(submitJson)}`);
    process.exit(2);
  }

  const statusUrl = `https://queue.fal.run/${model}/requests/${requestId}/status`;
  const resultUrl = `https://queue.fal.run/${model}/requests/${requestId}`;

  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await fetch(statusUrl, { headers: { Authorization: `Key ${apiKey}` } });
    const sj = await s.json();
    console.log(`[trailer] status: ${sj.status}`);
    if (sj.status === 'COMPLETED') break;
    if (sj.status === 'FAILED' || sj.status === 'ERROR') {
      console.error(`[trailer] generation failed: ${JSON.stringify(sj)}`);
      process.exit(3);
    }
  }

  const r = await fetch(resultUrl, { headers: { Authorization: `Key ${apiKey}` } });
  const result = await r.json();
  const videoUrl = result?.video?.url ?? result?.output?.video?.url ?? result?.url;
  if (!videoUrl) {
    console.error(`[trailer] no video URL in result: ${JSON.stringify(result)}`);
    process.exit(4);
  }

  console.log(`[trailer] downloading from ${videoUrl}`);
  const v = await fetch(videoUrl);
  if (!v.ok) {
    console.error(`[trailer] download failed: ${v.status}`);
    process.exit(5);
  }
  const buf = Buffer.from(await v.arrayBuffer());
  await writeFile(OUT_FILE, buf);
  console.log(`[trailer] wrote ${OUT_FILE} (${buf.length} bytes)`);
  console.log('[trailer] commit public/trailer/pkfit-intro.mp4 to ship the asset.');
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
