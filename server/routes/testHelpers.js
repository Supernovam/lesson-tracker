import express from 'express';

/**
 * Minimal `pg` Pool stand-in. `handler(sql, params)` returns the result for each
 * query, or `undefined` to fall back to an empty result set.
 */
export function createFakePool(handler) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      const result = await handler?.(sql, params);
      return result ?? { rows: [] };
    },
  };
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

export function queryFor(pool, fragment) {
  return pool.calls.find((call) => call.sql.includes(fragment));
}
