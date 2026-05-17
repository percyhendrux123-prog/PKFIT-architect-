// spawn_code_task / send_message_to_task / read_task_transcript.
//
// The tools use HOME to find the Cowork inbound + registry. We don't override
// HOME (touching it could break other tests in the suite), but we DO write
// only via tool calls — the test cleans up after itself.

import { describe, it, expect, afterAll } from 'vitest';
import { rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const HOME = process.env.HOME ?? '/Users/percystewart';
const REG_DIR = `${HOME}/.config/cowork/agent-tasks`;

const idsCreated = [];

afterAll(async () => {
  for (const id of idsCreated) {
    await rm(resolve(REG_DIR, `${id}.json`), { force: true });
    await rm(resolve(REG_DIR, `${id}.transcript.jsonl`), { force: true });
  }
});

describe('spawn_code_task', () => {
  it('spawns a task and returns session_id', async () => {
    const { spawn_code_task } = await import('../netlify/functions/_shared/agent-tools/tools/code-task.js');
    const res = await spawn_code_task.execute({
      title: 'Vitest spawn check',
      cwd: HOME + '/dev/PKFIT-architect-',
      prompt: 'no-op',
    });
    expect(res.error).toBeUndefined();
    expect(res.session_id).toMatch(/^local_/);
    idsCreated.push(res.session_id);
    // task json should exist
    const s = await stat(resolve(REG_DIR, `${res.session_id}.json`));
    expect(s.isFile()).toBe(true);
  });

  it('rejects cwd outside allowlist', async () => {
    const { spawn_code_task } = await import('../netlify/functions/_shared/agent-tools/tools/code-task.js');
    const res = await spawn_code_task.execute({
      title: 'bad',
      cwd: '/etc',
      prompt: 'nope',
    });
    expect(res.error).toMatch(/denied/);
  });
});

describe('send_message_to_task / read_task_transcript', () => {
  it('round-trips a message through the transcript', async () => {
    const { spawn_code_task, send_message_to_task, read_task_transcript } =
      await import('../netlify/functions/_shared/agent-tools/tools/code-task.js');
    const spawn = await spawn_code_task.execute({
      title: 'Round trip',
      cwd: HOME + '/dev/PKFIT-architect-',
      prompt: 'first',
    });
    idsCreated.push(spawn.session_id);

    const sent = await send_message_to_task.execute({
      session_id: spawn.session_id,
      message: 'hello there',
    });
    expect(sent.delivered).toBe(true);

    const tx = await read_task_transcript.execute({ session_id: spawn.session_id });
    expect(tx.entry_count).toBe(1);
    expect(tx.transcript).toContain('hello there');
  });

  it('errors when session does not exist', async () => {
    const { send_message_to_task, read_task_transcript } =
      await import('../netlify/functions/_shared/agent-tools/tools/code-task.js');
    const a = await send_message_to_task.execute({ session_id: 'nonexistent', message: 'x' });
    expect(a.error).toMatch(/not found/);
    const b = await read_task_transcript.execute({ session_id: 'nonexistent' });
    expect(b.error).toMatch(/not found/);
  });
});
