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
  l.school_id AS "schoolId",
  s.title AS "schoolTitle",
  l.calculated_price AS "calculatedPrice"
`;

const LESSON_WRITE_RETURNING = `
  id,
  student_name AS "studentName",
  date::text AS date,
  duration,
  comment,
  created_at AS "createdAt",
  lesson_type_id AS "lessonTypeId",
  school_id AS "schoolId",
  calculated_price AS "calculatedPrice"
`;

function mapLessonRow(row) {
  return {
    ...row,
    calculatedPrice:
      row.calculatedPrice == null ? null : Math.round(Number(row.calculatedPrice) * 100) / 100,
  };
}

function withLessonAssociations(row, lessonType, school) {
  return {
    ...mapLessonRow(row),
    lessonTypeName: lessonType.name,
    schoolTitle: school.title,
  };
}

async function resolveLessonPricing(pool, lessonTypeId, durationInt) {
  const lessonType = await findLessonType(pool, lessonTypeId);
  if (!lessonType) return { error: 'lessonTypeId is invalid' };
  return {
    lessonType,
    calculatedPrice: calculateSessionPrice(
      durationInt,
      Number(lessonType.baseDurationMinutes),
      Number(lessonType.basePrice)
    ),
  };
}

function parseLessonBody(body) {
  const studentName = typeof body.studentName === 'string' ? body.studentName.trim() : '';
  const dateStr = typeof body.date === 'string' ? body.date.trim() : '';
  const duration = typeof body.duration === 'number' ? body.duration : Number(body.duration);
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const lessonTypeId = typeof body.lessonTypeId === 'string' ? body.lessonTypeId.trim() : '';
  const schoolId = typeof body.schoolId === 'string' ? body.schoolId.trim() : '';

  const date = new Date(dateStr);
  const durationInt = Number.isInteger(duration) ? duration : Math.floor(duration);

  if (!studentName) return { error: 'studentName is required' };
  if (!dateStr || Number.isNaN(date.getTime())) return { error: 'date is invalid' };
  if (!Number.isInteger(durationInt) || durationInt < 1 || durationInt > 9999) {
    return { error: 'duration must be an integer between 1 and 9999' };
  }
  if (!lessonTypeId) return { error: 'lessonTypeId is required' };
  if (!schoolId) return { error: 'schoolId is required' };

  return { studentName, dateStr, durationInt, comment, lessonTypeId, schoolId };
}

async function findLessonType(pool, lessonTypeId) {
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
  return typeResult.rows[0] ?? null;
}

async function findSchool(pool, schoolId) {
  const schoolResult = await pool.query(
    `
      SELECT id, title
      FROM schools
      WHERE id = $1
    `,
    [schoolId]
  );
  return schoolResult.rows[0] ?? null;
}

async function resolveLessonWrite(pool, parsed) {
  const [priced, school] = await Promise.all([
    resolveLessonPricing(pool, parsed.lessonTypeId, parsed.durationInt),
    findSchool(pool, parsed.schoolId),
  ]);
  if (priced.error) return { error: priced.error };
  if (!school) return { error: 'schoolId is invalid' };
  return { priced, school };
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
        LEFT JOIN schools s ON s.id = l.school_id
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
    const parsed = parseLessonBody(req.body ?? {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const id = crypto.randomUUID();
    const createdAt = Date.now();

    try {
      const resolved = await resolveLessonWrite(pool, parsed);
      if (resolved.error) return res.status(400).json({ error: resolved.error });
      const { priced, school } = resolved;

      const { rows } = await pool.query(
        `
          INSERT INTO lessons (
            id, student_name, date, duration, comment, created_at, lesson_type_id, calculated_price, school_id
          )
          VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9)
          RETURNING ${LESSON_WRITE_RETURNING}
        `,
        [
          id,
          parsed.studentName,
          parsed.dateStr,
          parsed.durationInt,
          parsed.comment,
          createdAt,
          parsed.lessonTypeId,
          priced.calculatedPrice,
          parsed.schoolId,
        ]
      );

      res.status(201).json(withLessonAssociations(rows[0], priced.lessonType, school));
    } catch (err) {
      console.error('[lesson-tracker] Failed to create lesson:', err);
      res.status(500).json({ ok: false, error: 'failed to create lesson' });
    }
  });

  router.put('/:id', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const parsed = parseLessonBody(req.body ?? {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    try {
      const resolved = await resolveLessonWrite(pool, parsed);
      if (resolved.error) return res.status(400).json({ error: resolved.error });
      const { priced, school } = resolved;

      const { rows } = await pool.query(
        `
          UPDATE lessons
          SET
            student_name = $2,
            date = $3::date,
            duration = $4,
            comment = $5,
            lesson_type_id = $6,
            calculated_price = $7,
            school_id = $8
          WHERE id = $1
          RETURNING ${LESSON_WRITE_RETURNING}
        `,
        [
          id,
          parsed.studentName,
          parsed.dateStr,
          parsed.durationInt,
          parsed.comment,
          parsed.lessonTypeId,
          priced.calculatedPrice,
          parsed.schoolId,
        ]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'lesson not found' });

      res.json(withLessonAssociations(rows[0], priced.lessonType, school));
    } catch (err) {
      console.error('[lesson-tracker] Failed to update lesson:', err);
      res.status(500).json({ ok: false, error: 'failed to update lesson' });
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
