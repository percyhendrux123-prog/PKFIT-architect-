// read_file + write_file
//
// Allowlist + denylist enforced via paths.js. On the Netlify Lambda runtime,
// only /var/task (bundled function code) and /tmp (scratch) are reachable;
// the host filesystem paths are accessible only in local dev. In production
// these tools will return ENOENT for host paths, which is the right behavior
// — the agent should fall back to spawn_code_task for filesystem work.

import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { RISK } from '../risk.js';
import { validatePath } from '../paths.js';

function detectMime(path) {
  const ext = (path.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  switch (ext) {
    case 'md':
    case 'markdown': return 'text/markdown';
    case 'json': return 'application/json';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs': return 'application/javascript';
    case 'ts':
    case 'tsx': return 'application/typescript';
    case 'css': return 'text/css';
    case 'html':
    case 'htm': return 'text/html';
    case 'sql': return 'application/sql';
    case 'yaml':
    case 'yml': return 'application/x-yaml';
    case 'sh':
    case 'bash': return 'application/x-sh';
    case 'txt':
    case 'log': return 'text/plain';
    case 'csv': return 'text/csv';
    case 'env': return 'text/plain';
    default: return 'application/octet-stream';
  }
}

export const read_file = {
  name: 'read_file',
  description:
    "Read a file from Percy's workspace. Paths are validated against the allowlist (PKFIT docs, PKFIT-architect-, " +
    "lauren-site, pkfit-ios-showcase, /tmp, /var/task). Returns content, mime type, and size in bytes.",
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the file.' },
      max_bytes: { type: 'integer', description: 'Optional max bytes to return (default 200_000).' },
    },
    required: ['path'],
  },
  async execute({ path, max_bytes = 200_000 }) {
    const check = validatePath(path);
    if (!check.ok) return { error: `read denied: ${check.reason}` };
    try {
      const buf = await readFile(check.normalized);
      const size_bytes = buf.byteLength;
      const slice = buf.subarray(0, Math.min(max_bytes, size_bytes));
      // Try UTF-8 decoding. If it looks binary (high count of replacement
      // chars), return base64 instead.
      const text = slice.toString('utf8');
      const replacementCount = (text.match(/�/g) || []).length;
      const isBinary = replacementCount > slice.length * 0.05;
      if (isBinary) {
        return {
          content: slice.toString('base64'),
          encoding: 'base64',
          mime: detectMime(check.normalized),
          size_bytes,
          truncated: size_bytes > max_bytes,
          summary: `Read ${size_bytes} bytes from ${check.normalized} (binary).`,
        };
      }
      return {
        content: text,
        encoding: 'utf-8',
        mime: detectMime(check.normalized),
        size_bytes,
        truncated: size_bytes > max_bytes,
        summary: `Read ${size_bytes} bytes from ${check.normalized}.`,
      };
    } catch (e) {
      if (e?.code === 'ENOENT') return { error: `not found: ${check.normalized}` };
      if (e?.code === 'EACCES') return { error: `permission denied: ${check.normalized}` };
      if (e?.code === 'EISDIR') return { error: `is a directory: ${check.normalized}` };
      return { error: `read failed: ${e?.message ?? String(e)}` };
    }
  },
};

export const write_file = {
  name: 'write_file',
  description:
    "Write a file to Percy's workspace. Validated against the allowlist + denylist (no .pem/.key/dotfiles in " +
    '~/.ssh/, etc.). The summary parameter is a one-line description shown to Percy at confirmation time. ' +
    'Returns bytes_written. Parent directories are created if missing.',
  risk: RISK.MEDIUM,
  approval: 'medium',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the file.' },
      content: { type: 'string', description: 'File content (UTF-8).' },
      summary: {
        type: 'string',
        description: 'One-line description of why this file is being written (shown at confirmation).',
      },
      encoding: { type: 'string', enum: ['utf-8', 'base64'], description: 'Encoding of content (default utf-8).' },
    },
    required: ['path', 'content', 'summary'],
  },
  async execute({ path, content, summary, encoding = 'utf-8' }) {
    const check = validatePath(path, { writeIntent: true });
    if (!check.ok) return { error: `write denied: ${check.reason}` };
    if (typeof content !== 'string') return { error: 'content must be a string' };
    try {
      // Capture previous content for diff (best-effort).
      let priorBytes = null;
      try {
        const s = await stat(check.normalized);
        priorBytes = s.size;
      } catch {
        // File didn't exist — fine.
      }
      await mkdir(dirname(check.normalized), { recursive: true });
      const buf = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
      await writeFile(check.normalized, buf);
      return {
        bytes_written: buf.byteLength,
        path: check.normalized,
        prior_bytes: priorBytes,
        summary: `${summary} — wrote ${buf.byteLength} bytes to ${check.normalized}${priorBytes != null ? ` (was ${priorBytes})` : ' (new file)'}.`,
      };
    } catch (e) {
      if (e?.code === 'EACCES') return { error: `permission denied: ${check.normalized}` };
      if (e?.code === 'EROFS') return { error: `read-only filesystem (likely production runtime): ${check.normalized}` };
      return { error: `write failed: ${e?.message ?? String(e)}` };
    }
  },
};
