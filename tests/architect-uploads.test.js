// Tests for the Architect upload tools (read_operator_upload + analyze_image)
// and the architect-upload-purge cron function. The upload endpoint itself
// is covered by an integration-style request test using a stubbed FormData.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Shared fakes ───────────────────────────────────────────────────────
function makeAdminFake({ row, downloadBlob, signError, downloadError }) {
  const calls = { remove: [], deleteIn: [] };
  const fromTable = (table) => {
    if (table !== 'architect_upload') throw new Error(`unexpected table ${table}`);
    return {
      select() { return this; },
      eq() { return this; },
      lt(_col, val) { calls.lt = val; return this; },
      limit() { return Promise.resolve({ data: row ? [row] : [], error: null }); },
      in(col, vals) { calls.deleteIn.push({ col, vals }); return Promise.resolve({ error: null }); },
      delete() { return this; },
      insert(values) { return { select: () => ({ single: async () => ({ data: { ...row, ...values }, error: null }) }) }; },
      maybeSingle: async () => ({ data: row, error: null }),
    };
  };
  return {
    from: (table) => fromTable(table),
    storage: {
      from: () => ({
        createSignedUrl: async () => signError
          ? { data: null, error: { message: signError } }
          : { data: { signedUrl: 'https://signed/x' }, error: null },
        download: async () => downloadError
          ? { data: null, error: { message: downloadError } }
          : { data: downloadBlob, error: null },
        remove: async (paths) => { calls.remove.push(paths); return { error: null }; },
        upload: async () => ({ error: null }),
      }),
    },
    __calls: calls,
  };
}

function mockAnthropic(textResponse = 'looks good') {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: textResponse }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })),
    },
  };
}

const OPERATOR_ID = 'op-1';
const validRow = {
  id: 'upl-1',
  operator_id: OPERATOR_ID,
  storage_path: `${OPERATOR_ID}/2026-05-22/abc.jpg`,
  mime: 'image/jpeg',
  bytes: 12345,
  context_tag: null,
  created_at: '2026-05-22T00:00:00Z',
  expires_at: '2099-01-01T00:00:00Z',
};
const expiredRow = { ...validRow, id: 'upl-2', expires_at: '2020-01-01T00:00:00Z' };

// ─── read_operator_upload ───────────────────────────────────────────────
describe('read_operator_upload', () => {
  let adminFake;
  beforeEach(() => { vi.resetModules(); });

  it('returns signed URL + metadata for a valid, non-expired upload', async () => {
    adminFake = makeAdminFake({ row: validRow });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    const { read_operator_upload } = await import('../netlify/functions/_shared/agent-tools/tools/architect-uploads.js');
    const res = await read_operator_upload.execute({ upload_id: 'upl-1' }, { userId: OPERATOR_ID });
    expect(res.signed_url).toBe('https://signed/x');
    expect(res.mime).toBe('image/jpeg');
    expect(res.error).toBeUndefined();
  });

  it('returns "expired" error (410-equivalent) for an expired upload', async () => {
    adminFake = makeAdminFake({ row: expiredRow });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    const { read_operator_upload } = await import('../netlify/functions/_shared/agent-tools/tools/architect-uploads.js');
    const res = await read_operator_upload.execute({ upload_id: 'upl-2' }, { userId: OPERATOR_ID });
    expect(res.expired).toBe(true);
    expect(res.error).toMatch(/expired/i);
    expect(res.signed_url).toBeUndefined();
  });

  it('rejects cross-operator access', async () => {
    adminFake = makeAdminFake({ row: validRow });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    const { read_operator_upload } = await import('../netlify/functions/_shared/agent-tools/tools/architect-uploads.js');
    const res = await read_operator_upload.execute({ upload_id: 'upl-1' }, { userId: 'someone-else' });
    expect(res.error).toMatch(/does not belong/i);
  });

  it('requires upload_id', async () => {
    adminFake = makeAdminFake({ row: validRow });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    const { read_operator_upload } = await import('../netlify/functions/_shared/agent-tools/tools/architect-uploads.js');
    const res = await read_operator_upload.execute({}, { userId: OPERATOR_ID });
    expect(res.error).toMatch(/upload_id required/);
  });
});

// ─── analyze_image ──────────────────────────────────────────────────────
describe('analyze_image', () => {
  beforeEach(() => { vi.resetModules(); });

  it('downloads the image and calls Claude vision', async () => {
    const blob = { arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer };
    const adminFake = makeAdminFake({ row: validRow, downloadBlob: blob });
    const anthropic = mockAnthropic('Form looks acceptable. Keep your back flatter.');
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    vi.doMock('../netlify/functions/_shared/anthropic.js', () => ({
      getAnthropic: () => anthropic,
    }));
    const { analyze_image } = await import('../netlify/functions/_shared/agent-tools/tools/architect-uploads.js');
    const res = await analyze_image.execute(
      { upload_id: 'upl-1', prompt: 'describe form breakdown' },
      { userId: OPERATOR_ID },
    );
    expect(anthropic.messages.create).toHaveBeenCalledOnce();
    const callArgs = anthropic.messages.create.mock.calls[0][0];
    expect(callArgs.messages[0].content[0].type).toBe('image');
    expect(callArgs.messages[0].content[0].source.type).toBe('base64');
    expect(callArgs.messages[0].content[0].source.media_type).toBe('image/jpeg');
    expect(callArgs.messages[0].content[1].text).toBe('describe form breakdown');
    expect(res.response).toMatch(/Form looks acceptable/);
    expect(res.error).toBeUndefined();
  });

  it('returns expired error when the row has expired', async () => {
    const adminFake = makeAdminFake({ row: expiredRow });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    vi.doMock('../netlify/functions/_shared/anthropic.js', () => ({
      getAnthropic: () => mockAnthropic(),
    }));
    const { analyze_image } = await import('../netlify/functions/_shared/agent-tools/tools/architect-uploads.js');
    const res = await analyze_image.execute(
      { upload_id: 'upl-2', prompt: 'what is this' },
      { userId: OPERATOR_ID },
    );
    expect(res.expired).toBe(true);
    expect(res.error).toMatch(/expired/i);
  });

  it('rejects unsupported mime types', async () => {
    const adminFake = makeAdminFake({ row: { ...validRow, mime: 'image/heic' } });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    vi.doMock('../netlify/functions/_shared/anthropic.js', () => ({
      getAnthropic: () => mockAnthropic(),
    }));
    const { analyze_image } = await import('../netlify/functions/_shared/agent-tools/tools/architect-uploads.js');
    const res = await analyze_image.execute(
      { upload_id: 'upl-1', prompt: 'what' },
      { userId: OPERATOR_ID },
    );
    expect(res.error).toMatch(/vision not supported/i);
  });

  it('requires both upload_id and prompt', async () => {
    const adminFake = makeAdminFake({ row: validRow });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    vi.doMock('../netlify/functions/_shared/anthropic.js', () => ({
      getAnthropic: () => mockAnthropic(),
    }));
    const { analyze_image } = await import('../netlify/functions/_shared/agent-tools/tools/architect-uploads.js');
    expect((await analyze_image.execute({ prompt: 'x' }, { userId: OPERATOR_ID })).error).toMatch(/upload_id required/);
    expect((await analyze_image.execute({ upload_id: 'upl-1' }, { userId: OPERATOR_ID })).error).toMatch(/prompt required/);
  });
});

// ─── architect-upload-purge ─────────────────────────────────────────────
describe('architect-upload-purge', () => {
  beforeEach(() => { vi.resetModules(); });

  it('removes expired storage objects + rows and reports count', async () => {
    const adminFake = makeAdminFake({ row: expiredRow });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    const handler = (await import('../netlify/functions/architect-upload-purge.js')).default;
    const res = await handler();
    const body = await res.json();
    expect(body.purged).toBe(1);
    expect(adminFake.__calls.remove[0]).toContain(expiredRow.storage_path);
    expect(adminFake.__calls.deleteIn[0].vals).toContain(expiredRow.id);
  });

  it('reports purged=0 when nothing is expired', async () => {
    const adminFake = makeAdminFake({ row: null });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => adminFake,
      getAnonClient: () => adminFake,
    }));
    const handler = (await import('../netlify/functions/architect-upload-purge.js')).default;
    const res = await handler();
    const body = await res.json();
    expect(body.purged).toBe(0);
  });
});

// ─── architect-upload endpoint (auth + validation) ──────────────────────
describe('architect-upload endpoint', () => {
  beforeEach(() => { vi.resetModules(); });

  function makeAuthAdminFake({ user, profile, insertedRow }) {
    return {
      from: (table) => {
        if (table === 'profiles') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle: async () => ({ data: profile, error: null }),
          };
        }
        if (table === 'architect_upload') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: insertedRow, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          createSignedUrl: async () => ({ data: { signedUrl: 'https://signed/y' }, error: null }),
          remove: async () => ({ error: null }),
        }),
      },
    };
  }

  it('rejects non-POST', async () => {
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({}),
      getAnonClient: () => ({}),
    }));
    vi.doMock('../netlify/functions/_shared/owner.js', () => ({ isOwnerEmail: () => false }));
    const handler = (await import('../netlify/functions/architect-upload.js')).default;
    const res = await handler(new Request('http://t/architect-upload', { method: 'GET' }));
    expect(res.status).toBe(405);
  });

  it('returns 401 without bearer', async () => {
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({}),
      getAnonClient: () => ({}),
    }));
    vi.doMock('../netlify/functions/_shared/owner.js', () => ({ isOwnerEmail: () => false }));
    const handler = (await import('../netlify/functions/architect-upload.js')).default;
    const res = await handler(new Request('http://t/architect-upload', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-owner non-tier4', async () => {
    const fake = makeAuthAdminFake({
      user: { id: 'u-1', email: 'civilian@x.com' },
      profile: { tier4_agent_owner: false },
    });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => fake,
      getAnonClient: () => fake,
    }));
    vi.doMock('../netlify/functions/_shared/owner.js', () => ({ isOwnerEmail: () => false }));
    const handler = (await import('../netlify/functions/architect-upload.js')).default;
    const headers = new Headers({ authorization: 'Bearer tok' });
    const res = await handler(new Request('http://t/architect-upload', { method: 'POST', headers, body: new FormData() }));
    expect(res.status).toBe(403);
  });

  it('happy-path: uploads image, inserts row, returns signed URL', async () => {
    const inserted = { ...validRow, id: 'inserted-1' };
    const fake = makeAuthAdminFake({
      user: { id: OPERATOR_ID, email: 'percy@x.com' },
      profile: { tier4_agent_owner: false },
      insertedRow: inserted,
    });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => fake,
      getAnonClient: () => fake,
    }));
    vi.doMock('../netlify/functions/_shared/owner.js', () => ({ isOwnerEmail: () => true }));
    const handler = (await import('../netlify/functions/architect-upload.js')).default;

    const form = new FormData();
    const fileBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
    const file = new File([fileBytes], 'squat.jpg', { type: 'image/jpeg' });
    form.append('file', file);

    const headers = new Headers({ authorization: 'Bearer tok' });
    const res = await handler(new Request('http://t/architect-upload', { method: 'POST', headers, body: form }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upload_id).toBe('inserted-1');
    expect(body.signed_url).toBe('https://signed/y');
    expect(body.mime).toBe('image/jpeg');
  });

  it('rejects non-image mime', async () => {
    const fake = makeAuthAdminFake({
      user: { id: OPERATOR_ID, email: 'percy@x.com' },
      profile: { tier4_agent_owner: false },
    });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => fake,
      getAnonClient: () => fake,
    }));
    vi.doMock('../netlify/functions/_shared/owner.js', () => ({ isOwnerEmail: () => true }));
    const handler = (await import('../netlify/functions/architect-upload.js')).default;

    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.pdf', { type: 'application/pdf' }));
    const headers = new Headers({ authorization: 'Bearer tok' });
    const res = await handler(new Request('http://t/architect-upload', { method: 'POST', headers, body: form }));
    expect(res.status).toBe(415);
  });

  it('rejects files larger than 20MB', async () => {
    const fake = makeAuthAdminFake({
      user: { id: OPERATOR_ID, email: 'percy@x.com' },
      profile: { tier4_agent_owner: false },
    });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => fake,
      getAnonClient: () => fake,
    }));
    vi.doMock('../netlify/functions/_shared/owner.js', () => ({ isOwnerEmail: () => true }));
    const handler = (await import('../netlify/functions/architect-upload.js')).default;

    // 20MB + 1 byte buffer.
    const big = new Uint8Array(20 * 1024 * 1024 + 1);
    const form = new FormData();
    form.append('file', new File([big], 'big.jpg', { type: 'image/jpeg' }));
    const headers = new Headers({ authorization: 'Bearer tok' });
    const res = await handler(new Request('http://t/architect-upload', { method: 'POST', headers, body: form }));
    expect(res.status).toBe(413);
  });
});
