import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../auth.js';

const SCHOOL_RETURNING = `
  id,
  title,
  billing_name AS "billingName",
  address,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function isUniqueViolation(err) {
  return Boolean(err && err.code === '23505');
}

function isForeignKeyViolation(err) {
  return Boolean(err && err.code === '23503');
}

function parseSchoolBody(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const billingName = typeof body.billingName === 'string' ? body.billingName.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';

  if (!title) return { error: 'title is required' };
  if (!billingName) return { error: 'billingName is required' };
  if (!address) return { error: 'address is required' };

  return { title, billingName, address };
}

export function createSchoolsRouter({ pool, isDbReady }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    try {
      const { rows } = await pool.query(`
        SELECT ${SCHOOL_RETURNING}
        FROM schools
        ORDER BY title ASC
      `);
      res.json(rows);
    } catch (err) {
      console.error('[lesson-tracker] Failed to load schools:', err);
      res.status(500).json({ ok: false, error: 'failed to load schools' });
    }
  });

  router.post('/', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const parsed = parseSchoolBody(req.body ?? {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const id = crypto.randomUUID();
    const now = Date.now();

    try {
      const { rows } = await pool.query(
        `
          INSERT INTO schools (id, title, billing_name, address, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING ${SCHOOL_RETURNING}
        `,
        [id, parsed.title, parsed.billingName, parsed.address, now, now]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ error: 'A school with this title already exists' });
      }
      console.error('[lesson-tracker] Failed to create school:', err);
      res.status(500).json({ ok: false, error: 'failed to create school' });
    }
  });

  router.put('/:id', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const parsed = parseSchoolBody(req.body ?? {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const updatedAt = Date.now();

    try {
      const { rows } = await pool.query(
        `
          UPDATE schools
          SET title = $2, billing_name = $3, address = $4, updated_at = $5
          WHERE id = $1
          RETURNING ${SCHOOL_RETURNING}
        `,
        [id, parsed.title, parsed.billingName, parsed.address, updatedAt]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'school not found' });
      res.json(rows[0]);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ error: 'A school with this title already exists' });
      }
      console.error('[lesson-tracker] Failed to update school:', err);
      res.status(500).json({ ok: false, error: 'failed to update school' });
    }
  });

  router.delete('/:id', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      await pool.query('DELETE FROM schools WHERE id = $1', [id]);
      res.status(204).end();
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        return res.status(409).json({
          error: 'This school is used by existing lessons and cannot be deleted',
        });
      }
      console.error('[lesson-tracker] Failed to delete school:', err);
      res.status(500).json({ ok: false, error: 'failed to delete school' });
    }
  });

  return router;
}
