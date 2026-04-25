// Helper for stubbing the auth/Supabase layer that requireUser() and the
// rate limiter both depend on. Returns a single supabase mock that satisfies
// all the function-internal calls.

import { vi } from 'vitest';

export function stubAuthenticatedUser(supabaseMock, { userId = 'user-123', role = 'client', profile = null } = {}) {
  supabaseMock.auth.getUser = vi.fn(async () => ({
    data: { user: { id: userId, email: 'u@example.com' } },
    error: null,
  }));

  // Default handler: profiles lookup returns the requested role/profile,
  // rate_limits returns no existing row (so the limit allows), all other
  // tables return data:null,error:null.
  const profileRow = profile ?? { id: userId, role };
  supabaseMock.__setHandler(({ table, op }) => {
    if (table === 'profiles' && op === 'select') {
      return { data: profileRow, error: null };
    }
    if (table === 'rate_limits' && op === 'select') {
      return { data: null, error: null };
    }
    return undefined; // fall through to queue or default
  });

  return profileRow;
}

export function stubInvalidUser(supabaseMock) {
  supabaseMock.auth.getUser = vi.fn(async () => ({
    data: null,
    error: { message: 'invalid' },
  }));
}
