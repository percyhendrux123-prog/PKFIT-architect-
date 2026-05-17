// spawn_code_task / send_message_to_task / read_task_transcript
//
// Per Percy's call: when spawned from inside the app, the task notification
// should also land in the Cowork task tray on the host. We do this by writing
// to a shared registry file the Cowork host watches:
//
//   ~/.config/cowork/inbound-tasks.jsonl
//
// Each line is a JSON record: { id, title, cwd, prompt, source, created_at }.
// Cowork is expected to tail this file and surface the row in its task list.
// If Cowork isn't installed or the file isn't writable, we still log the task
// to agent_actions and return a session id derived from a uuid — the task
// just won't be visible in the Cowork UI.
//
// In Phase 2 this should be replaced with a proper IPC mechanism (a local
// HTTP daemon on Cowork's side, or a Supabase channel).

import { writeFile, mkdir, readFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { RISK } from '../risk.js';
import { validatePath } from '../paths.js';

const HOME = process.env.HOME ?? '/Users/percystewart';
const COWORK_INBOUND = `${HOME}/.config/cowork/inbound-tasks.jsonl`;
const TASK_REGISTRY_DIR = `${HOME}/.config/cowork/agent-tasks`;

async function writeToCoworkTray(record) {
  try {
    await mkdir(dirname(COWORK_INBOUND), { recursive: true });
    await appendFile(COWORK_INBOUND, JSON.stringify(record) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function persistTask(record) {
  try {
    await mkdir(TASK_REGISTRY_DIR, { recursive: true });
    await writeFile(
      resolve(TASK_REGISTRY_DIR, `${record.id}.json`),
      JSON.stringify(record, null, 2),
      'utf8',
    );
    return true;
  } catch {
    return false;
  }
}

async function loadTask(sessionId) {
  try {
    const raw = await readFile(resolve(TASK_REGISTRY_DIR, `${sessionId}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function appendTaskMessage(sessionId, role, content) {
  try {
    await mkdir(TASK_REGISTRY_DIR, { recursive: true });
    await appendFile(
      resolve(TASK_REGISTRY_DIR, `${sessionId}.transcript.jsonl`),
      JSON.stringify({ role, content, at: new Date().toISOString() }) + '\n',
      'utf8',
    );
    return true;
  } catch {
    return false;
  }
}

async function readTranscript(sessionId) {
  try {
    const path = resolve(TASK_REGISTRY_DIR, `${sessionId}.transcript.jsonl`);
    const raw = await readFile(path, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export const spawn_code_task = {
  name: 'spawn_code_task',
  description:
    'Spawn a Cowork-style Code task against the host filesystem in the specified cwd. ' +
    "Mirrors Cowork's start_code_task contract. cwd must be under an allowlisted directory. " +
    'Returns a session_id that can be used with send_message_to_task and read_task_transcript. ' +
    'The task notification is written to ~/.config/cowork/inbound-tasks.jsonl for the Cowork host to surface.',
  risk: RISK.MEDIUM,
  approval: 'medium',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short title for the task (shown in Cowork tray).' },
      cwd: { type: 'string', description: 'Working directory for the task. Must be under allowlist.' },
      prompt: { type: 'string', description: 'Initial prompt the spawned Code agent receives.' },
    },
    required: ['title', 'cwd', 'prompt'],
  },
  async execute({ title, cwd, prompt }) {
    const check = validatePath(cwd);
    if (!check.ok) return { error: `cwd denied: ${check.reason}` };
    const id = `local_${randomUUID()}`;
    const record = {
      id,
      title: String(title).slice(0, 200),
      cwd: check.normalized,
      prompt: String(prompt).slice(0, 32_000),
      source: 'pkfit-architect/owner-agentic',
      created_at: new Date().toISOString(),
      status: 'pending',
    };
    const persisted = await persistTask(record);
    const trayed = await writeToCoworkTray(record);
    return {
      session_id: id,
      title: record.title,
      cwd: record.cwd,
      cowork_tray_notified: trayed,
      persisted,
      summary: `Spawned Code task "${record.title}" in ${record.cwd}. Session: ${id}.`,
    };
  },
};

export const send_message_to_task = {
  name: 'send_message_to_task',
  description:
    'Send a follow-up message to a running Code task. The message is appended to the transcript and ' +
    'available for the task agent to read on its next poll.',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      message: { type: 'string' },
    },
    required: ['session_id', 'message'],
  },
  async execute({ session_id, message }) {
    const task = await loadTask(session_id);
    if (!task) return { error: `task not found: ${session_id}` };
    const ok = await appendTaskMessage(session_id, 'user', String(message).slice(0, 32_000));
    return {
      delivered: ok,
      session_id,
      summary: ok ? `Message delivered to ${session_id}.` : `Could not deliver message (write failed).`,
    };
  },
};

export const read_task_transcript = {
  name: 'read_task_transcript',
  description:
    'Read the transcript of a Code task. Returns the full message history (user + assistant turns) and ' +
    'the current status (running | idle).',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      format: { type: 'string', enum: ['auto', 'full'] },
      max_wait_seconds: { type: 'integer', description: 'Ignored in Phase 1.' },
    },
    required: ['session_id'],
  },
  async execute({ session_id, format = 'auto' }) {
    const task = await loadTask(session_id);
    if (!task) return { error: `task not found: ${session_id}` };
    const entries = await readTranscript(session_id);
    const transcript = entries
      .map((e) => `[${e.role}] ${e.content}`)
      .join('\n\n');
    return {
      transcript: format === 'auto' ? transcript.slice(-12_000) : transcript,
      entry_count: entries.length,
      status: task.status ?? 'pending',
      task,
      summary: `Transcript for ${session_id}: ${entries.length} message(s), status ${task.status ?? 'pending'}.`,
    };
  },
};
