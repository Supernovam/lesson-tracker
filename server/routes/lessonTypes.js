import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { requireDbReady, isUniqueViolation, isForeignKeyViolation } from './routeHelpers.js';
import { DURATION_LIMITS, TEACHING_UNIT_MINUTES, isDurationUnit } from '../durationUnit.js';

const LESSON_TYPE_RETURNING = `
  id,
  name,
  base_price AS "basePrice",
  base_duration_minutes AS "baseDurationMinutes",
  duration_unit AS "durationUnit",
  (SELECT count(*) FROM lessons WHERE lessons.lesson_type_id = lesson_types.id)::int AS "lessonCount",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function mapLessonTypeRow(row) {
  return {
    ...row,
    basePrice: Math.round(Number(row.basePrice) * 100) / 100,
  };
}

/** `fallbackUnit` applies when the body has no unit, as from clients that predate teaching units. */
function parseLessonTypeBody(body, fallbackUnit = 'minutes') {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const durationUnit = body.durationUnit === undefined ? fallbackUnit : body.durationUnit;
  const basePriceRaw = typeof body.basePrice === 'number' ? body.basePrice : Number(body.basePrice);
  const durationRaw =
    typeof body.baseDurationMinutes === 'number'
      ? body.baseDurationMinutes
      : Number(body.baseDurationMinutes);
  const durationInt = Number.isInteger(durationRaw) ? durationRaw : Math.floor(durationRaw);

  if (!name) return { error: 'name is required' };
  if (!isDurationUnit(durationUnit)) {
    return { error: 'durationUnit must be "minutes" or "teaching_units"' };
  }
  if (!Number.isFinite(basePriceRaw) || basePriceRaw < 0) {
    return { error: 'basePrice must be a number greater than or equal to 0' };
  }
  const basePrice = Math.round(basePriceRaw * 100) / 100;
  if (Math.abs(basePriceRaw - basePrice) > 1e-8) {
    return { error: 'basePrice must have at most 2 decimal places' };
  }
  const { min, max } = DURATION_LIMITS.minutes;
  if (
    durationUnit === 'minutes' &&
    (!Number.isInteger(durationInt) || durationInt < min || durationInt > max)
  ) {
    return { error: `baseDurationMinutes must be an integer between ${min} and ${max}` };
  }

  // A teaching-unit type is priced per UE; its base duration just records the unit's length.
  const baseDurationMinutes = durationUnit === 'teaching_units' ? TEACHING_UNIT_MINUTES : durationInt;
  return { name, basePrice, baseDurationMinutes, durationUnit };
}

export function createLessonTypesRouter({ pool, isDbReady }) {
  const router = Router();
  router.use(requireAuth);
  router.use(requireDbReady(isDbReady));

  router.get('/', async (_req, res) => {
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
    const parsed = parseLessonTypeBody(req.body ?? {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const id = crypto.randomUUID();
    const now = Date.now();

    try {
      const { rows } = await pool.query(
        `
          INSERT INTO lesson_types (
            id, name, base_price, base_duration_minutes, duration_unit, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING ${LESSON_TYPE_RETURNING}
        `,
        [id, parsed.name, parsed.basePrice, parsed.baseDurationMinutes, parsed.durationUnit, now, now]
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
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const body = req.body ?? {};
    const updatedAt = Date.now();

    try {
      // Without a unit in the body, keep the stored one rather than resetting it to minutes.
      let fallbackUnit;
      if (body.durationUnit === undefined) {
        const current = await pool.query(
          'SELECT duration_unit AS "durationUnit" FROM lesson_types WHERE id = $1',
          [id]
        );
        if (current.rows.length === 0) return res.status(404).json({ error: 'lesson type not found' });
        fallbackUnit = current.rows[0].durationUnit;
      }

      const parsed = parseLessonTypeBody(body, fallbackUnit);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const { rows } = await pool.query(
        `
          UPDATE lesson_types
          SET name = $2, base_price = $3, base_duration_minutes = $4, duration_unit = $5, updated_at = $6
          WHERE id = $1
            AND (
              duration_unit = $5
              OR NOT EXISTS (SELECT 1 FROM lessons WHERE lessons.lesson_type_id = $1)
            )
          RETURNING ${LESSON_TYPE_RETURNING}
        `,
        [
          id,
          parsed.name,
          parsed.basePrice,
          parsed.baseDurationMinutes,
          parsed.durationUnit,
          updatedAt,
        ]
      );
      if (rows.length === 0) {
        // The guarded UPDATE matched nothing: either the type is gone or its unit is locked.
        const existing = await pool.query('SELECT 1 FROM lesson_types WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
          return res.status(404).json({ error: 'lesson type not found' });
        }
        return res.status(409).json({
          error:
            'The duration unit cannot change while lessons use this lesson type. Create a new lesson type instead.',
        });
      }
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
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      await pool.query('DELETE FROM lesson_types WHERE id = $1', [id]);
      res.status(204).end();
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        return res.status(409).json({
          error: 'This lesson type is used by existing lessons and cannot be deleted',
        });
      }
      console.error('[lesson-tracker] Failed to delete lesson type:', err);
      res.status(500).json({ ok: false, error: 'failed to delete lesson type' });
    }
  });

  return router;
}
