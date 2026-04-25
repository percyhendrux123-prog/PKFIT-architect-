// Lightweight chainable mock for the supabase-js client. Every chained
// call returns `this`, and the chain "resolves" when awaited or when
// `.maybeSingle()` / `.single()` is invoked. Tests preconfigure responses
// via `client.__setNext({ data, error })` (queue) or `client.__setHandler(fn)`
// for full control.

import { vi } from 'vitest';

export function createSupabaseMock() {
  const responseQueue = [];
  let handler = null;
  const calls = []; // ordered list of every method invocation

  const recordCall = (method, args) => {
    calls.push({ method, args });
  };

  const nextResponse = (table, op, args) => {
    if (handler) {
      const res = handler({ table, op, args });
      if (res !== undefined) return res;
    }
    if (responseQueue.length > 0) return responseQueue.shift();
    return { data: null, error: null };
  };

  function makeBuilder(table) {
    let op = 'select';
    let args = {};

    const builder = {
      // every method is chainable
      select: vi.fn(function (cols) {
        op = op === 'select' ? 'select' : op;
        args.select = cols;
        recordCall(`${table}.select`, [cols]);
        return builder;
      }),
      insert: vi.fn(function (rows) {
        op = 'insert';
        args.rows = rows;
        recordCall(`${table}.insert`, [rows]);
        return builder;
      }),
      update: vi.fn(function (vals) {
        op = 'update';
        args.update = vals;
        recordCall(`${table}.update`, [vals]);
        return builder;
      }),
      upsert: vi.fn(function (row, opts) {
        op = 'upsert';
        args.row = row;
        args.opts = opts;
        recordCall(`${table}.upsert`, [row, opts]);
        return builder;
      }),
      delete: vi.fn(function () {
        op = 'delete';
        recordCall(`${table}.delete`, []);
        return builder;
      }),
      eq: vi.fn(function (col, val) {
        args.eq = args.eq ?? [];
        args.eq.push([col, val]);
        recordCall(`${table}.eq`, [col, val]);
        return builder;
      }),
      gte: vi.fn(function (col, val) {
        args.gte = [col, val];
        recordCall(`${table}.gte`, [col, val]);
        return builder;
      }),
      lt: vi.fn(function (col, val) {
        args.lt = [col, val];
        recordCall(`${table}.lt`, [col, val]);
        return builder;
      }),
      order: vi.fn(function () {
        return builder;
      }),
      limit: vi.fn(function () {
        return builder;
      }),
      maybeSingle: vi.fn(function () {
        return Promise.resolve(nextResponse(table, op, args));
      }),
      single: vi.fn(function () {
        return Promise.resolve(nextResponse(table, op, args));
      }),
      // awaiting the builder resolves the query
      then: function (resolve, reject) {
        try {
          const res = nextResponse(table, op, args);
          // Promise.resolve so chains like .then() work
          return Promise.resolve(res).then(resolve, reject);
        } catch (e) {
          return reject ? reject(e) : Promise.reject(e);
        }
      },
    };

    return builder;
  }

  const client = {
    from: vi.fn((table) => makeBuilder(table)),
    auth: {
      getUser: vi.fn(),
    },
    __calls: calls,
    __setNext(res) {
      responseQueue.push(res);
    },
    __setHandler(fn) {
      handler = fn;
    },
    __reset() {
      responseQueue.length = 0;
      handler = null;
      calls.length = 0;
    },
  };

  return client;
}
