// read_operator_upload + analyze_image
//
// Both tools target the architect_upload table + architect-uploads bucket
// created in migration 0053. The operator uploads via the /architect-upload
// endpoint; the Architect then calls these tools by upload_id.
//
// read_operator_upload  → metadata + a fresh 1-hour signed URL.
// analyze_image         → runs Claude vision against the uploaded image.
//
// Both LOW risk: the operator owns the data and uploaded it intentionally.
// expires_at gates access; if expired, both tools return a 410-style error.

import { RISK } from '../risk.js';
import { getAdminClient } from '../../supabase-admin.js';
import { getAnthropic } from '../../anthropic.js';

const BUCKET = 'architect-uploads';
const SIGNED_URL_TTL_SEC = 60 * 60;
const VISION_MODEL = 'claude-sonnet-4-6';
const SUPPORTED_VISION_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

async function fetchUploadRow(uploadId, operatorId) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('architect_upload')
    .select('id, operator_id, storage_path, mime, bytes, context_tag, created_at, expires_at')
    .eq('id', uploadId)
    .maybeSingle();
  if (error) return { error: `lookup failed: ${error.message}` };
  if (!data) return { error: `upload_id ${uploadId} not found` };
  if (data.operator_id !== operatorId) {
    return { error: 'upload does not belong to this operator' };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { error: 'upload expired (410)', expired: true, expires_at: data.expires_at };
  }
  return { row: data };
}

export const read_operator_upload = {
  name: 'read_operator_upload',
  description:
    'Read metadata for an operator-uploaded image. Returns a fresh 1-hour signed URL, mime, size, context_tag, and timestamps. ' +
    'Use this when the operator has attached an image and you want to inspect metadata or hand a URL to another tool. ' +
    'For actually viewing the image content, call analyze_image instead.',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      upload_id: { type: 'string', description: 'The upload_id from the [image attached: …] context marker.' },
    },
    required: ['upload_id'],
  },
  async execute({ upload_id }, ctx) {
    if (!upload_id || typeof upload_id !== 'string') {
      return { error: 'upload_id required' };
    }
    const lookup = await fetchUploadRow(upload_id, ctx.userId);
    if (lookup.error) return lookup;
    const { row } = lookup;

    const admin = getAdminClient();
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SEC);
    if (signErr) return { error: `sign failed: ${signErr.message}` };

    return {
      upload_id: row.id,
      mime: row.mime,
      bytes: row.bytes,
      context_tag: row.context_tag,
      created_at: row.created_at,
      expires_at: row.expires_at,
      signed_url: signed.signedUrl,
      signed_url_expires_in_sec: SIGNED_URL_TTL_SEC,
      summary: `upload ${row.id.slice(0, 8)}… (${row.mime}, ${row.bytes} bytes, expires ${row.expires_at}).`,
    };
  },
};

export const analyze_image = {
  name: 'analyze_image',
  description:
    'Run Claude vision on an operator-uploaded image. Pass the upload_id and a question/prompt; returns the model\'s response. ' +
    'Use for form-check breakdowns, progress-photo reads, screenshot interpretation. Costs ~$0.003–0.015 per call.',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      upload_id: { type: 'string', description: 'The upload_id from the [image attached: …] context marker.' },
      prompt: {
        type: 'string',
        description: 'What to ask about the image, e.g. "describe form breakdown on this squat" or "what does this screenshot show".',
      },
    },
    required: ['upload_id', 'prompt'],
  },
  async execute({ upload_id, prompt }, ctx) {
    if (!upload_id || typeof upload_id !== 'string') return { error: 'upload_id required' };
    if (!prompt || typeof prompt !== 'string') return { error: 'prompt required' };

    const lookup = await fetchUploadRow(upload_id, ctx.userId);
    if (lookup.error) return lookup;
    const { row } = lookup;

    if (!SUPPORTED_VISION_MIME.has(row.mime)) {
      return {
        error: `vision not supported for mime ${row.mime}. Re-upload as JPEG/PNG/WebP/GIF.`,
      };
    }

    const admin = getAdminClient();
    const { data: blob, error: downloadErr } = await admin.storage
      .from(BUCKET)
      .download(row.storage_path);
    if (downloadErr) return { error: `download failed: ${downloadErr.message}` };

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    try {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: VISION_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: row.mime,
                  data: base64,
                },
              },
              { type: 'text', text: prompt.slice(0, 2000) },
            ],
          },
        ],
      });
      const text = (response.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      return {
        upload_id: row.id,
        model: VISION_MODEL,
        prompt: prompt.slice(0, 200),
        response: text || '(empty response)',
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        summary: `vision on ${row.id.slice(0, 8)}…: ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`,
      };
    } catch (e) {
      return { error: `vision call failed: ${e?.message ?? String(e)}` };
    }
  },
};
