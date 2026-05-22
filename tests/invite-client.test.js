// invite-client
//
// Coverage targets:
//   1. Non-POST returns 405
//   2. Missing auth header → 401 (requireUser throws)
//   3. Authed client (non-coach) → 403
//   4. Missing / malformed email → 400
//   5. Happy path: createUser succeeds, generateLink resolves, Resend mock
//      fires, response carries email_id + auth_user_id
//   6. createUser returns "already registered" → still generates link (no throw)
//   7. RESEND_API_KEY unset → 500 with magic_url surfaced so Percy can
//      hand it off out-of-band
//
// Resend is mocked via global.fetch. No real network.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const adminAuth = {
  createUser: vi.fn(),
  generateLink: vi.fn(),
};
const adminClient = { auth: { admin: adminAuth } };

const anonAuth = {
  getUser: vi.fn(),
};
const anonClient = { auth: anonAuth };

const profileQuery = {
  data: null,
  select: vi.fn(function () { return this; }),
  eq: vi.fn(function () { return this; }),
  maybeSingle: vi.fn(function () { return Promise.resolve({ data: this.data, error: null }); }),
  __setProfile(p) { this.data = p; return this; },
};

// Build a mock that returns a fresh chainable profileQuery per call so tests
// can pre-set the profile shape. requireUser ultimately calls
// admin.from('profiles').select('*').eq('id', userId).maybeSingle().
const adminFrom = vi.fn(() => profileQuery);
adminClient.from = adminFrom;

vi.mock('../netlify/functions/_shared/supabase-admin.js', () => ({
  getAdminClient: () => adminClient,
  getAnonClient: () => anonClient,
}));

vi.mock('../netlify/functions/_shared/owner.js', () => ({
  isOwnerEmail: (email) => email === 'owner@pkfit.app',
}));

vi.mock('../netlify/functions/_shared/anthropic.js', () => ({
  loadPrompt: () =>
    'SUBJECT: Your PKFIT app is ready\n\n---\n\n{{first_name}},\n\n{{magic_url}}\n\n— Percy\n',
}));

const originalFetch = global.fetch;

beforeEach(() => {
  adminAuth.createUser.mockReset();
  adminAuth.generateLink.mockReset();
  anonAuth.getUser.mockReset();
  adminFrom.mockClear();
  profileQuery.data = null;

  // default: a coach makes the call
  anonAuth.getUser.mockResolvedValue({
    data: { user: { id: 'coach-1', email: 'percy@pkfit.app' } },
    error: null,
  });
  profileQuery.__setProfile({ id: 'coach-1', role: 'coach' });

  adminAuth.createUser.mockResolvedValue({
    data: { user: { id: 'new-user-1' } },
    error: null,
  });
  adminAuth.generateLink.mockResolvedValue({
    data: { properties: { action_link: 'https://app.pkfit.app/magic#token=abc' } },
    error: null,
  });

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ id: 'em_42' }),
    text: () => Promise.resolve(''),
  });

  process.env.RESEND_API_KEY = 'test-key';
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon';
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.RESEND_API_KEY;
});

function makeEvent({ method = 'POST', body = { email: 'darryl@example.com', name: 'Darryl Garner' }, auth = 'Bearer good-token' } = {}) {
  return {
    httpMethod: method,
    headers: { authorization: auth },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

async function loadHandler() {
  const mod = await import('../netlify/functions/invite-client.js');
  return mod.handler;
}

describe('invite-client', () => {
  it('rejects non-POST with 405', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ method: 'GET' }));
    expect(res.statusCode).toBe(405);
  });

  it('rejects unauthenticated calls with 401', async () => {
    anonAuth.getUser.mockResolvedValue({ data: null, error: { message: 'bad jwt' } });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-coach callers with 403', async () => {
    profileQuery.__setProfile({ id: 'coach-1', role: 'client' });
    anonAuth.getUser.mockResolvedValue({
      data: { user: { id: 'coach-1', email: 'random@example.com' } },
      error: null,
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(403);
  });

  it('rejects missing email with 400', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { name: 'no email' } }));
    expect(res.statusCode).toBe(400);
  });

  it('happy path: creates user, generates magic link, sends Resend email', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.ok).toBe(true);
    expect(payload.email).toBe('darryl@example.com');
    expect(payload.email_id).toBe('em_42');
    expect(adminAuth.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'darryl@example.com',
      email_confirm: true,
      user_metadata: { name: 'Darryl Garner' },
    }));
    expect(adminAuth.generateLink).toHaveBeenCalledWith(expect.objectContaining({
      type: 'magiclink',
      email: 'darryl@example.com',
    }));
    const fetchArgs = global.fetch.mock.calls[0];
    expect(fetchArgs[0]).toBe('https://api.resend.com/emails');
    const sentBody = JSON.parse(fetchArgs[1].body);
    expect(sentBody.from).toContain('coach@operatefitness.app');
    expect(sentBody.reply_to).toBe('percyhendrux123@gmail.com');
    expect(sentBody.subject).toBe('Your PKFIT app is ready');
    expect(sentBody.text).toContain('Darryl,');
    expect(sentBody.text).toContain('https://app.pkfit.app/magic#token=abc');
  });

  it('treats "already registered" from createUser as a soft success', async () => {
    adminAuth.createUser.mockResolvedValue({
      data: null,
      error: { message: 'A user with this email address has already been registered' },
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.ok).toBe(true);
    expect(payload.auth_user_id).toBeNull();
  });

  it('surfaces magic_url when RESEND_API_KEY is unset (500)', async () => {
    delete process.env.RESEND_API_KEY;
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(500);
    const payload = JSON.parse(res.body);
    expect(payload.error).toMatch(/RESEND_API_KEY/);
    expect(payload.magic_url).toBe('https://app.pkfit.app/magic#token=abc');
  });
});
