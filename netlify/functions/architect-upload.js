// architect-upload — Operator → Architect file upload endpoint.
//
// POST multipart/form-data with a single `file` field. Accepts images
// (image/*) and documents (PDF, DOCX, XLSX, MD, TXT). Optional
// `context_tag` form field for routing hints ("form-check", etc).
//
// Auth: operator session (Bearer token, same as agent-assistant.js).
// Storage: writes to private `architect-uploads` bucket via service role.
// Metadata: row in public.architect_upload with 30d expiry.
//
// Returns:
//   { upload_id, signed_url, expires_at, storage_path, bytes, mime, kind }
//
// The signed URL is valid for 1 hour. The Architect's tools call
// read_operator_upload / analyze_image / analyze_document with the
// upload_id to fetch fresh signed URLs and inspect content.

import { randomUUID } from 'node:crypto';
import { getAdminClient, getAnonClient } from './_shared/supabase-admin.js';
import { isOwnerEmail } from './_shared/owner.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const BUCKET = 'architect-uploads';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_DOC_BYTES = 32 * 1024 * 1024;   // 32MB — PDF/DOCX/XLSX can be heavier
const SIGNED_URL_TTL_SEC = 60 * 60;  // 1 hour

const IMAGE_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const DOC_MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

function classifyMime(mime, filename = '') {
  if (!mime) {
    // Some browsers send '' for txt/md — fall back to extension sniff.
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'md') return { kind: 'document', ext: 'md', normalizedMime: 'text/markdown' };
    if (ext === 'txt') return { kind: 'document', ext: 'txt', normalizedMime: 'text/plain' };
    if (ext === 'csv') return { kind: 'document', ext: 'csv', normalizedMime: 'text/csv' };
    return null;
  }
  if (mime.startsWith('image/')) {
    const ext = IMAGE_MIME_TO_EXT[mime];
    if (!ext) return null;
    return { kind: 'image', ext, normalizedMime: mime };
  }
  const docExt = DOC_MIME_TO_EXT[mime];
  if (docExt) return { kind: 'document', ext: docExt, normalizedMime: mime };
  return null;
}

function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

async function authenticate(req) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    const err = new Error('Missing Authorization bearer token');
    err.statusCode = 401;
    throw err;
  }
  const token = header.slice('Bearer '.length).trim();
  const anon = getAnonClient();
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Invalid session');
    err.statusCode = 401;
    throw err;
  }
  return data.user;
}

function yyyymmdd(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let user;
  try {
    user = await authenticate(req);
  } catch (e) {
    return jsonResponse(e.statusCode ?? 401, { error: e.message });
  }

  // Gate: same surface as agent-assistant — owner or tier4_agent_owner.
  const admin = getAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('tier4_agent_owner')
    .eq('id', user.id)
    .maybeSingle();
  const isOwner = isOwnerEmail(user.email);
  const isTier4 = profile?.tier4_agent_owner === true;
  if (!isOwner && !isTier4) {
    return jsonResponse(403, {
      error: 'agent_gate',
      message: 'Architect uploads are owner-only at this time.',
    });
  }

  // Parse multipart body.
  let form;
  try {
    form = await req.formData();
  } catch (e) {
    return jsonResponse(400, { error: 'invalid_form', message: e?.message ?? 'Invalid multipart body' });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return jsonResponse(400, { error: 'file required' });
  }

  const rawMime = file.type || '';
  const filename = (typeof file.name === 'string' && file.name) || 'upload';
  const classification = classifyMime(rawMime, filename);
  if (!classification) {
    return jsonResponse(415, {
      error: 'unsupported_mime',
      message: `Unsupported file type ${rawMime || 'unknown'}. Accepted: images (jpg/png/webp/gif/heic), PDF, DOCX, XLSX, MD, TXT, CSV.`,
    });
  }
  const { kind, ext, normalizedMime: mime } = classification;
  const sizeCap = kind === 'image' ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
  const bytes = file.size ?? 0;
  if (!bytes) {
    return jsonResponse(400, { error: 'empty_file' });
  }
  if (bytes > sizeCap) {
    return jsonResponse(413, { error: 'too_large', message: `Max ${sizeCap} bytes for ${kind} (got ${bytes}).` });
  }

  const contextTag = (() => {
    const raw = form.get('context_tag');
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().slice(0, 64);
    return trimmed || null;
  })();

  const uploadId = randomUUID();
  const objectName = `${randomUUID()}.${ext}`;
  const storagePath = `${user.id}/${yyyymmdd(new Date())}/${objectName}`;

  // Upload binary via service role.
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mime,
      cacheControl: '3600',
      upsert: false,
    });
  if (uploadErr) {
    return jsonResponse(500, { error: 'upload_failed', message: uploadErr.message });
  }

  // Insert metadata row.
  const { data: row, error: insertErr } = await admin
    .from('architect_upload')
    .insert({
      id: uploadId,
      operator_id: user.id,
      storage_path: storagePath,
      mime,
      bytes,
      context_tag: contextTag,
    })
    .select('id, expires_at, storage_path, mime, bytes, context_tag, created_at')
    .single();
  if (insertErr) {
    // Best-effort cleanup of the uploaded object if the metadata insert fails.
    await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return jsonResponse(500, { error: 'metadata_insert_failed', message: insertErr.message });
  }

  // Mint a fresh signed URL for the immediate client response.
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);
  if (signErr) {
    return jsonResponse(500, { error: 'sign_failed', message: signErr.message });
  }

  return jsonResponse(200, {
    upload_id: row.id,
    storage_path: row.storage_path,
    mime: row.mime,
    bytes: row.bytes,
    kind,
    context_tag: row.context_tag,
    created_at: row.created_at,
    expires_at: row.expires_at,
    signed_url: signed.signedUrl,
    signed_url_expires_in_sec: SIGNED_URL_TTL_SEC,
  });
};
