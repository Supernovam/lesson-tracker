import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { calculateSessionPrice } from '../pricing.js';

const LESSON_RETURNING = `
  l.id,
  l.student_name AS "studentName",
  l.date::text AS date,
  l.duration,
  l.comment,
  l.created_at AS "createdAt",
  l.lesson_type_id AS "lessonTypeId",
  lt.name AS "lessonTypeName",
  l.calculated_price AS "calculatedPrice"
`;

function mapLessonRow(row) {
  return {
    ...row,
    calculatedPrice:
      row.calculatedPrice == null ? null : Math.round(Number(row.calculatedPrice) * 100) / 100,
  };
}

export function createLessonsRouter({ pool, isDbReady }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    try {
      const { rows } = await pool.query(`
        SELECT ${LESSON_RETURNING}
        FROM lessons l
        LEFT JOIN lesson_types lt ON lt.id = l.lesson_type_id
        ORDER BY l.date ASC, l.created_at ASC
      `);

      res.json(rows.map(mapLessonRow));
    } catch (err) {
      console.error('[lesson-tracker] Failed to load lessons:', err);
      res.status(500).json({ ok: false, error: 'failed to load lessons' });
    }
  });

  router.post('/', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const body = req.body ?? {};
    const studentName = typeof body.studentName === 'string' ? body.studentName.trim() : '';
    const dateStr = typeof body.date === 'string' ? body.date.trim() : '';
    const duration = typeof body.duration === 'number' ? body.duration : Number(body.duration);
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    const lessonTypeId = typeof body.lessonTypeId === 'string' ? body.lessonTypeId.trim() : '';

    const date = new Date(dateStr);
    const durationInt = Number.isInteger(duration) ? duration : Math.floor(duration);

    if (!studentName) return res.status(400).json({ error: 'studentName is required' });
    if (!dateStr || Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date is invalid' });
    if (!Number.isInteger(durationInt) || durationInt < 1 || durationInt > 9999) {
      return res
        .status(400)
        .json({ error: 'duration must be an integer between 1 and 9999' });
    }
    if (!lessonTypeId) return res.status(400).json({ error: 'lessonTypeId is required' });

    const id = crypto.randomUUID();
    const createdAt = Date.now();

    try {
      const typeResult = await pool.query(
        `
          SELECT
            id,
            name,
            base_price AS "basePrice",
            base_duration_minutes AS "baseDurationMinutes"
          FROM lesson_types
          WHERE id = $1
        `,
        [lessonTypeId]
      );
      const lessonType = typeResult.rows[0];
      if (!lessonType) return res.status(400).json({ error: 'lessonTypeId is invalid' });

      const calculatedPrice = calculateSessionPrice(
        durationInt,
        Number(lessonType.baseDurationMinutes),
        Number(lessonType.basePrice)
      );

      const { rows } = await pool.query(
        `
          INSERT INTO lessons (
            id, student_name, date, duration, comment, created_at, lesson_type_id, calculated_price
          )
          VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8)
          RETURNING
            id,
            student_name AS "studentName",
            date::text AS date,
            duration,
            comment,
            created_at AS "createdAt",
            lesson_type_id AS "lessonTypeId",
            calculated_price AS "calculatedPrice"
        `,
        [id, studentName, dateStr, durationInt, comment, createdAt, lessonTypeId, calculatedPrice]
      );

      res.status(201).json({
        ...mapLessonRow(rows[0]),
        lessonTypeName: lessonType.name,
      });
    } catch (err) {
      console.error('[lesson-tracker] Failed to create lesson:', err);
      res.status(500).json({ ok: false, error: 'failed to create lesson' });
    }
  });

  router.delete('/:id', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      await pool.query('DELETE FROM lessons WHERE id = $1', [id]);
      res.status(204).end();
    } catch (err) {
      console.error('[lesson-tracker] Failed to delete lesson:', err);
      res.status(500).json({ ok: false, error: 'failed to delete lesson' });
    }
  });

  return router;
}
