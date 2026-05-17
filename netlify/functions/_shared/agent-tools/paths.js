// Filesystem allowlist + denylist for read_file / write_file tools.
//
// Allowlist: paths under any of these prefixes are accessible.
// Denylist: even if under an allowed prefix, these patterns are rejected.
//
// On the Netlify Lambda runtime, the host filesystem isn't Percy's machine —
// it's an ephemeral container. read_file / write_file are functional only
// when the function is running locally (dev mode) or when targeted at a
// path bundled into /var/task (e.g. read-only access to repo files via
// included_files).
//
// In production we expose two extra prefixes:
//   - /var/task/ for the bundled function's own files
//   - /tmp/ for scratch writes (ephemeral, but allows the agent to draft a
//     file and then upload/email it elsewhere)
//
// Audit: every read/write logs path + byte count (not content).

import { resolve, normalize } from 'node:path';

const HOME = process.env.HOME ?? '/Users/percystewart';

const ALLOWLIST_PREFIXES = [
  `${HOME}/Documents/PKFIT/`,
  `${HOME}/Documents/PKFIT1/`,
  `${HOME}/dev/PKFIT-architect-/`,
  `${HOME}/dev/lauren-site/`,
  `${HOME}/dev/pkfit-ios-showcase/`,
  '/var/task/',
  '/tmp/',
];

// Patterns that are denied even within an allowed prefix.
const DENYLIST_GLOBS = [
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.gpg$/i,
  /\.asc$/i,
  /(^|\/)\.ssh(\/|$)/,
  /(^|\/)\.aws(\/|$)/,
  /(^|\/)\.gnupg(\/|$)/,
  /(^|\/)\.netrc$/,
  /id_rsa(\.pub)?$/,
  /id_ed25519(\.pub)?$/,
];

// Additional system directories that are always denied regardless of allowlist.
const ABSOLUTE_DENYLIST_PREFIXES = [
  `${HOME}/Library/`,
  `${HOME}/.ssh/`,
  `${HOME}/.aws/`,
  `${HOME}/.gnupg/`,
  '/etc/',
  '/private/etc/',
  '/usr/',
  '/System/',
  '/Library/',
];

export function normalizePath(p) {
  if (typeof p !== 'string' || !p) return null;
  // Resolve ~ to $HOME.
  let s = p.trim();
  if (s.startsWith('~/')) s = `${HOME}/${s.slice(2)}`;
  if (s === '~') s = HOME;
  // Resolve relative paths against cwd to absolute.
  const abs = resolve(s);
  return normalize(abs);
}

// Validate a path against allowlist + denylist. Returns { ok: boolean,
// reason?: string }.
export function validatePath(p, { writeIntent = false } = {}) {
  const abs = normalizePath(p);
  if (!abs) return { ok: false, reason: 'empty path' };

  for (const denied of ABSOLUTE_DENYLIST_PREFIXES) {
    if (abs.startsWith(denied)) {
      return { ok: false, reason: `denied: under ${denied}` };
    }
  }

  for (const re of DENYLIST_GLOBS) {
    if (re.test(abs)) return { ok: false, reason: `denied: matches ${re}` };
  }

  for (const prefix of ALLOWLIST_PREFIXES) {
    if (abs === prefix.replace(/\/$/, '') || abs.startsWith(prefix)) {
      // Writing to /var/task is read-only in Lambda; reject write attempts
      // there with a clearer message than a permission error.
      if (writeIntent && abs.startsWith('/var/task/')) {
        return { ok: false, reason: '/var/task is read-only in the Netlify runtime' };
      }
      return { ok: true, normalized: abs };
    }
  }

  return {
    ok: false,
    reason: `outside allowlist. Allowed prefixes: ${ALLOWLIST_PREFIXES.join(', ')}`,
  };
}
