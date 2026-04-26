// Owner identity check. Server-only — the OWNER_EMAILS env var is the source
// of truth and must NEVER be inferred from client state. Client-side hints
// (VITE_OWNER_EMAILS) only control UI visibility; every privileged action
// is gated server-side via this helper.

function parseList(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email) {
  if (!email) return false;
  const list = parseList(process.env.OWNER_EMAILS);
  return list.includes(String(email).trim().toLowerCase());
}
