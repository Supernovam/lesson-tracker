import express from 'express';

/**
 * Minimal `pg` Pool stand-in. `handler(sql, params)` returns the result for each
 * query, or `undefined` to fall back to an empty result set.
 */
export function createFakePool(handler) {
  const calls = [];
  const query = async (sql, params) => {
    calls.push({ sql, params });
    const result = await handler?.(sql, params);
    return result ?? { rows: [] };
  };
  const pool = {
    calls,
    released: 0,
    query,
    // Checked-out clients share `calls`, so transaction statements show up in order.
    connect: async () => ({
      query,
      release: () => {
        pool.released += 1;
      },
    }),
  };
  return pool;
}

/**
 * Mounts a router with a signed-in session so `requireAuth` passes.
 * Pass `user: null` to exercise the unauthenticated path.
 */
export function createTestApp(router, { mountPath, user = { email: 'teacher@example.com' } } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use(mountPath, router);
  return app;
}

/** A pool whose every query fails, with a Postgres error `code` such as '23505'. */
export function failingPool(code) {
  return createFakePool(() => {
    const err = new Error('query failed');
    err.code = code;
    throw err;
  });
}

export function queryFor(pool, fragment) {
  return pool.calls.find((call) => call.sql.includes(fragment));
}
