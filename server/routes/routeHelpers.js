/** Answers 503 until the schema is in place, so handlers can assume a ready database. */
export function requireDbReady(isDbReady) {
  return (_req, res, next) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    return next();
  };
}

export function isUniqueViolation(err) {
  return Boolean(err && err.code === '23505');
}

export function isForeignKeyViolation(err) {
  return Boolean(err && err.code === '23503');
}
