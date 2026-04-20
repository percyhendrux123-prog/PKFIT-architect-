import { getAnonClient, getAdminClient } from './supabase-admin.js';

export async function requireUser(event) {
  const header = event.headers?.authorization || event.headers?.Authorization;
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

  const admin = getAdminClient();
  const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  return { user: data.user, profile, role: profile?.role ?? 'client' };
}

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function errorResponse(e) {
  const statusCode = e?.statusCode ?? 500;
  return jsonResponse(statusCode, { error: e?.message ?? 'Unknown error' });
}
