// read_file / write_file — uses /tmp for I/O so it runs cleanly in CI.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm, mkdir, writeFile } from 'node:fs/promises';

const TMPROOT = `/tmp/pkfit-agent-tools-test-${Date.now()}`;

beforeAll(async () => {
  await mkdir(TMPROOT, { recursive: true });
});

afterAll(async () => {
  await rm(TMPROOT, { recursive: true, force: true });
});

describe('read_file', () => {
  it('reads UTF-8 content and reports mime + size', async () => {
    const { read_file } = await import('../netlify/functions/_shared/agent-tools/tools/files.js');
    const path = `${TMPROOT}/hello.md`;
    await writeFile(path, '# Hello world\n', 'utf8');
    const res = await read_file.execute({ path });
    expect(res.error).toBeUndefined();
    expect(res.content).toContain('Hello world');
    expect(res.mime).toBe('text/markdown');
    expect(res.size_bytes).toBeGreaterThan(0);
  });

  it('denies paths outside allowlist', async () => {
    const { read_file } = await import('../netlify/functions/_shared/agent-tools/tools/files.js');
    const res = await read_file.execute({ path: '/etc/passwd' });
    expect(res.error).toMatch(/denied/);
  });

  it('denies sensitive file types even under allowlist', async () => {
    const { read_file } = await import('../netlify/functions/_shared/agent-tools/tools/files.js');
    const res = await read_file.execute({ path: '/tmp/something.pem' });
    expect(res.error).toMatch(/denied/);
  });

  it('returns ENOENT-style error for missing files', async () => {
    const { read_file } = await import('../netlify/functions/_shared/agent-tools/tools/files.js');
    const res = await read_file.execute({ path: `${TMPROOT}/nope.txt` });
    expect(res.error).toMatch(/not found/);
  });
});

describe('write_file', () => {
  it('writes a new file with a summary', async () => {
    const { write_file } = await import('../netlify/functions/_shared/agent-tools/tools/files.js');
    const path = `${TMPROOT}/out.txt`;
    const res = await write_file.execute({ path, content: 'hello', summary: 'test write' });
    expect(res.error).toBeUndefined();
    expect(res.bytes_written).toBe(5);
    expect(res.summary).toContain('test write');
  });

  it('rejects denylisted file types', async () => {
    const { write_file } = await import('../netlify/functions/_shared/agent-tools/tools/files.js');
    const res = await write_file.execute({
      path: `${TMPROOT}/secret.key`,
      content: 'irrelevant',
      summary: 'should fail',
    });
    expect(res.error).toMatch(/denied/);
  });

  it('captures prior bytes when overwriting', async () => {
    const { write_file } = await import('../netlify/functions/_shared/agent-tools/tools/files.js');
    const path = `${TMPROOT}/over.txt`;
    await writeFile(path, 'abcdef', 'utf8');
    const res = await write_file.execute({ path, content: 'xy', summary: 'overwrite' });
    expect(res.prior_bytes).toBe(6);
    expect(res.bytes_written).toBe(2);
  });
});
