// generate_image + voice_tts
//
// generate_image proxies to the existing /generate-image endpoint logic
// (fal.ai). For Phase 1 we re-invoke the existing function's core: do an
// HTTPS POST to fal.ai with the FAL_API_KEY.
//
// voice_tts uses OpenAI tts-1-hd with voice "onyx" by default. Requires
// OPENAI_API_KEY.

import { RISK } from '../risk.js';

const FAL_DEFAULT_MODEL = 'fal-ai/flux/schnell';

export const generate_image = {
  name: 'generate_image',
  description:
    'Generate an image via fal.ai (Flux schnell by default). Returns a URL and credit cost estimate. ' +
    'Aspect can be "1:1", "9:16", "16:9", "3:4", "4:3", "21:9".',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      aspect: { type: 'string' },
      model: { type: 'string', description: 'Optional fal.ai model id (default fal-ai/flux/schnell).' },
    },
    required: ['prompt'],
  },
  async execute({ prompt, aspect = '1:1', model = FAL_DEFAULT_MODEL }) {
    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) return { error: 'generate_image not configured — set FAL_API_KEY in env.' };
    try {
      const res = await fetch(`https://fal.run/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: String(prompt).slice(0, 2000),
          image_size: aspectToFalSize(aspect),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { error: `fal.ai error ${res.status}: ${errText.slice(0, 400)}` };
      }
      const data = await res.json();
      const url = data?.images?.[0]?.url ?? data?.image?.url ?? null;
      return {
        url,
        model,
        aspect,
        cost_credits: estimateFalCost(model),
        summary: url ? `Image generated (${model}, ${aspect}).` : 'fal.ai returned no image.',
      };
    } catch (e) {
      return { error: `generate_image failed: ${e?.message ?? String(e)}` };
    }
  },
};

function aspectToFalSize(aspect) {
  switch (aspect) {
    case '9:16': return 'portrait_16_9';
    case '16:9': return 'landscape_16_9';
    case '3:4': return 'portrait_4_3';
    case '4:3': return 'landscape_4_3';
    case '21:9': return 'landscape_16_9';
    case '1:1':
    default: return 'square_hd';
  }
}

function estimateFalCost(model) {
  if (model.includes('schnell')) return 0.003;
  if (model.includes('dev')) return 0.025;
  if (model.includes('pro')) return 0.05;
  return 0.01;
}

export const voice_tts = {
  name: 'voice_tts',
  description:
    'Synthesize speech from text via OpenAI tts-1-hd. Default voice is "onyx". ' +
    'Returns an audio URL (base64 data URL by default since we have no storage bucket wired).',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      voice: { type: 'string', description: 'onyx | alloy | echo | fable | nova | shimmer' },
      speed: { type: 'number', description: '0.25 to 4.0; default 1.0.' },
      format: { type: 'string', enum: ['mp3', 'opus', 'aac', 'flac'], description: 'Default mp3.' },
    },
    required: ['text'],
  },
  async execute({ text, voice = 'onyx', speed = 1.0, format = 'mp3' }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { error: 'voice_tts not configured — set OPENAI_API_KEY in env.' };
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          input: String(text).slice(0, 4000),
          voice,
          speed: Math.max(0.25, Math.min(4.0, speed)),
          response_format: format,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { error: `OpenAI tts error ${res.status}: ${errText.slice(0, 400)}` };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const dataUrl = `data:audio/${format};base64,${buf.toString('base64')}`;
      const approxSeconds = Math.round((String(text).length / 15) * 10) / 10;
      return {
        audio_url: dataUrl,
        duration_seconds: approxSeconds,
        bytes: buf.byteLength,
        voice,
        format,
        summary: `TTS rendered (${voice}, ${approxSeconds}s, ${buf.byteLength} bytes).`,
      };
    } catch (e) {
      return { error: `voice_tts failed: ${e?.message ?? String(e)}` };
    }
  },
};
