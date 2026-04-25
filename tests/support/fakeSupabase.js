// In-memory stand-in for the Supabase admin client. Implements the fluent
// query builder surface the importer actually uses — no more, no less. This
// lets the orchestrator test run hermetically (no Postgres, no network) and
// keeps the smoke script honest about what the importer touches.
//
// Surface covered:
//   from(table)
//     .select(cols).eq(col,val).maybeSingle()
//     .select(cols).eq(col,val)                    // returns array
//     .insert(row).select(cols).single()
//     .insert(row).select(cols).maybeSingle()
//     .insert(row)                                 // fire-and-forget shape
//     .update(patch).eq(col,val)
//   storage.from(bucket).upload(path, buffer, opts)
//   auth.admin.createUser({ email, ... })
//
// The surface is intentionally minimal. If the importer grows new query
// shapes, extend this fake — do not loosen the importer.

import { randomUUID } from 'node:crypto';

export function makeFakeAdmin(seed = {}) {
  const tables = {
    profiles: [],
    programs: [],
    workout_sessions: [],
    check_ins: [],
    meals: [],
    dm_threads: [],
    dm_messages: [],
    rate_limits: [],
    ...seed.tables,
  };
  const storage = { ...(seed.storage ?? {}) };

  function tableApi(name) {
    if (!tables[name]) tables[name] = [];
    return queryBuilder(tables[name], name);
  }

  function queryBuilder(rows, name) {
    const state = { filters: [], cols: '*' };
    const api = {};

    api.select = (cols) => { state.cols = cols ?? '*'; return api; };
    api.eq = (col, val) => { state.filters.push((r) => r[col] === val); return api; };
    api.in = (col, vals) => { const set = new Set(vals); state.filters.push((r) => set.has(r[col])); return api; };

    function applyFilters() {
      return rows.filter((r) => state.filters.every((f) => f(r)));
    }

    api.maybeSingle = async () => {
      const matched = applyFilters();
      return { data: matched[0] ?? null, error: null };
    };
    api.single = async () => {
      const matched = applyFilters();
      if (matched.length === 0) return { data: null, error: { message: 'No rows' } };
      return { data: matched[0], error: null };
    };

    // Awaiting the builder directly — Supabase client style — returns the
    // filtered set with no error. The importer relies on this for "list rows
    // by client_id".
    api.then = (resolve, reject) => {
      try {
        const matched = applyFilters();
        resolve({ data: matched, error: null });
      } catch (e) {
        reject(e);
      }
    };

    api.insert = (row) => {
      const inserted = Array.isArray(row)
        ? row.map((r) => ({ id: randomUUID(), ...r }))
        : [{ id: randomUUID(), ...row }];

      // Enforce the unique constraint we rely on for dm_threads.
      if (name === 'dm_threads') {
        const existing = rows.find((r) => r.client_id === inserted[0].client_id);
        if (existing) {
          // Mimic Supabase 23505. The importer treats this as a hard error.
          const err = { message: 'duplicate key value violates unique constraint "dm_threads_client_id_key"' };
          return chainAfterInsert(null, err);
        }
      }
      rows.push(...inserted);
      return chainAfterInsert(inserted, null);
    };

    function chainAfterInsert(inserted, error) {
      const insertChain = {
        select: () => insertChain,
        single: async () => ({
          data: error ? null : inserted[0],
          error,
        }),
        maybeSingle: async () => ({
          data: error ? null : inserted[0],
          error,
        }),
        // Awaiting after .insert() with no .select() returns ack-only.
        then: (resolve, reject) => {
          try { resolve({ data: error ? null : inserted, error }); }
          catch (e) { reject(e); }
        },
      };
      return insertChain;
    }

    api.update = (patch) => {
      const updateApi = {
        eq: (col, val) => {
          const matched = rows.filter((r) => r[col] === val);
          for (const r of matched) Object.assign(r, patch);
          return updateApi;
        },
        in: (col, vals) => {
          const set = new Set(vals);
          const matched = rows.filter((r) => set.has(r[col]));
          for (const r of matched) Object.assign(r, patch);
          return updateApi;
        },
        then: (resolve) => resolve({ data: null, error: null }),
      };
      return updateApi;
    };

    return api;
  }

  return {
    _tables: tables,
    _storage: storage,
    _countAllRows: () => Object.values(tables).reduce((acc, arr) => acc + arr.length, 0),

    from: tableApi,

    storage: {
      from: (bucket) => {
        if (!storage[bucket]) storage[bucket] = new Map();
        return {
          upload: async (path, buffer, opts) => {
            // upsert: true means same path overwrites; that's the importer's
            // idempotency guarantee for photos.
            storage[bucket].set(path, { buffer, contentType: opts?.contentType ?? null });
            return { data: { path }, error: null };
          },
        };
      },
    },

    auth: {
      admin: {
        createUser: async ({ email, user_metadata }) => {
          const existing = tables.profiles.find((p) => p.email === email);
          if (existing) {
            return { data: { user: { id: existing.id, email } }, error: null };
          }
          const id = randomUUID();
          tables.profiles.push({
            id,
            email,
            role: 'client',
            name: user_metadata?.name ?? '',
            created_at: new Date().toISOString(),
          });
          return { data: { user: { id, email } }, error: null };
        },
      },
    },
  };
}
