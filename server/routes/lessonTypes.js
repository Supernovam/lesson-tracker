import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../auth.js';

const LESSON_TYPE_RETURNING = `
  id,
  name,
  base_price AS "basePrice",
  base_duration_minutes AS "baseDurationMinutes",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function mapLessonTypeRow(row) {
  return {
    ...row,
    basePrice: Math.round(Number(row.basePrice) * 100) / 100,
  };
}

function isUniqueViolation(err) {
  return Boolean(err && err.code === '23505');
}

function parseLessonTypeBody(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const basePriceRaw = typeof body.basePrice === 'number' ? body.basePrice : Number(body.basePrice);
  const durationRaw =
    typeof body.baseDurationMinutes === 'number'
      ? body.baseDurationMinutes
      : Number(body.baseDurationMinutes);
  const durationInt = Number.isInteger(durationRaw) ? durationRaw : Math.floor(durationRaw);

  if (!name) return { error: 'name is required' };
  if (!Number.isFinite(basePriceRaw) || basePriceRaw < 0) {
    return { error: 'basePrice must be a number greater than or equal to 0' };
  }
  const basePrice = Math.round(basePriceRaw * 100) / 100;
  if (Math.abs(basePriceRaw - basePrice) > 1e-8) {
    return { error: 'basePrice must have at most 2 decimal places' };
  }
  if (!Number.isInteger(durationInt) || durationInt < 1 || durationInt > 9999) {
    return { error: 'baseDurationMinutes must be an integer between 1 and 9999' };
  }

  return { name, basePrice, baseDurationMinutes: durationInt };
}

export function createLessonTypesRouter({ pool, isDbReady }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    try {
      const { rows } = await pool.query(`
        SELECT ${LESSON_TYPE_RETURNING}
        FROM lesson_types
        ORDER BY name ASC
      `);
      res.json(rows.map(mapLessonTypeRow));
    } catch (err) {
      console.error('[lesson-tracker] Failed to load lesson types:', err);
      res.status(500).json({ ok: false, error: 'failed to load lesson types' });
    }
  });

  router.post('/', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const parsed = parseLessonTypeBody(req.body ?? {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const id = crypto.randomUUID();
    const now = Date.now();

    try {
      const { rows } = await pool.query(
        `
          INSERT INTO lesson_types (id, name, base_price, base_duration_minutes, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING ${LESSON_TYPE_RETURNING}
        `,
        [id, parsed.name, parsed.basePrice, parsed.baseDurationMinutes, now, now]
      );
      res.status(201).json(mapLessonTypeRow(rows[0]));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ error: 'A lesson type with this name already exists' });
      }
      console.error('[lesson-tracker] Failed to create lesson type:', err);
      res.status(500).json({ ok: false, error: 'failed to create lesson type' });
    }
  });

  router.put('/:id', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const parsed = parseLessonTypeBody(req.body ?? {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const updatedAt = Date.now();

    try {
      const { rows } = await pool.query(
        `
          UPDATE lesson_types
          SET name = $2, base_price = $3, base_duration_minutes = $4, updated_at = $5
          WHERE id = $1
          RETURNING ${LESSON_TYPE_RETURNING}
        `,
        [id, parsed.name, parsed.basePrice, parsed.baseDurationMinutes, updatedAt]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'lesson type not found' });
      res.json(mapLessonTypeRow(rows[0]));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ error: 'A lesson type with this name already exists' });
      }
      console.error('[lesson-tracker] Failed to update lesson type:', err);
      res.status(500).json({ ok: false, error: 'failed to update lesson type' });
    }
  });

  router.delete('/:id', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      await pool.query('DELETE FROM lesson_types WHERE id = $1', [id]);
      res.status(204).end();
    } catch (err) {
      console.error('[lesson-tracker] Failed to delete lesson type:', err);
      res.status(500).json({ ok: false, error: 'failed to delete lesson type' });
    }
  });

  return router;
}
