import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { requireDbReady } from './routeHelpers.js';
import { calculateLessonPrice } from '../pricing.js';
import { durationRangeError, normalizeDuration } from '../durationUnit.js';

const LESSON_RETURNING = `
  l.id,
  l.student_name AS "studentName",
  l.date::text AS date,
  l.duration,
  l.duration_unit AS "durationUnit",
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
  duration_unit AS "durationUnit",
  comment,
  created_at AS "createdAt",
  lesson_type_id AS "lessonTypeId",
  school_id AS "schoolId",
  calculated_price AS "calculatedPrice"
`;

function mapLessonRow(row) {
  return {
    ...row,
    // numeric(7, 2) comes back from pg as a string.
    duration: Number(row.duration),
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

/** Validates the duration in the lesson type's unit, then prices it. */
async function resolveLessonPricing(pool, lessonTypeId, rawDuration) {
  const lessonType = await findLessonType(pool, lessonTypeId);
  if (!lessonType) return { error: 'lessonTypeId is invalid' };
  const { durationUnit } = lessonType;
  const duration = normalizeDuration(rawDuration, durationUnit);
  if (duration == null) return { error: durationRangeError(durationUnit) };
  return {
    lessonType,
    duration,
    calculatedPrice: calculateLessonPrice(duration, durationUnit, {
      baseDurationMinutes: Number(lessonType.baseDurationMinutes),
      basePrice: Number(lessonType.basePrice),
    }),
  };
}

function parseLessonBody(body) {
  // Optional, but must be sent as a string so a malformed update cannot silently clear it.
  if (typeof body.studentName !== 'string') return { error: 'studentName must be a string' };
  const studentName = body.studentName.trim();
  const dateStr = typeof body.date === 'string' ? body.date.trim() : '';
  // Only numbers and numeric strings count: `Number()` would turn null, '' or true into 0 or 1.
  const duration =
    typeof body.duration === 'number' || (typeof body.duration === 'string' && body.duration.trim())
      ? Number(body.duration)
      : Number.NaN;
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  const lessonTypeId = typeof body.lessonTypeId === 'string' ? body.lessonTypeId.trim() : '';
  const schoolId = typeof body.schoolId === 'string' ? body.schoolId.trim() : '';

  const date = new Date(dateStr);

  if (!dateStr || Number.isNaN(date.getTime())) return { error: 'date is invalid' };
  // The allowed range depends on the lesson type's unit, checked once the type is loaded.
  if (!Number.isFinite(duration)) return { error: 'duration must be a number' };
  if (!lessonTypeId) return { error: 'lessonTypeId is required' };
  if (!schoolId) return { error: 'schoolId is required' };

  return { studentName, dateStr, duration, comment, lessonTypeId, schoolId };
}

async function findLessonType(pool, lessonTypeId) {
  const typeResult = await pool.query(
    `
      SELECT
        id,
        name,
        base_price AS "basePrice",
        base_duration_minutes AS "baseDurationMinutes",
        duration_unit AS "durationUnit"
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
    resolveLessonPricing(pool, parsed.lessonTypeId, parsed.duration),
    findSchool(pool, parsed.schoolId),
  ]);
  if (priced.error) return { error: priced.error };
  if (!school) return { error: 'schoolId is invalid' };
  return { priced, school };
}

export function createLessonsRouter({ pool, isDbReady }) {
  const router = Router();
  router.use(requireAuth);
  router.use(requireDbReady(isDbReady));

  router.get('/', async (_req, res) => {
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
            id, student_name, date, duration, comment, created_at, lesson_type_id, calculated_price, school_id,
            duration_unit
          )
          VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10)
          RETURNING ${LESSON_WRITE_RETURNING}
        `,
        [
          id,
          parsed.studentName,
          parsed.dateStr,
          priced.duration,
          parsed.comment,
          createdAt,
          parsed.lessonTypeId,
          priced.calculatedPrice,
          parsed.schoolId,
          priced.lessonType.durationUnit,
        ]
      );

      res.status(201).json(withLessonAssociations(rows[0], priced.lessonType, school));
    } catch (err) {
      console.error('[lesson-tracker] Failed to create lesson:', err);
      res.status(500).json({ ok: false, error: 'failed to create lesson' });
    }
  });

  router.put('/:id', async (req, res) => {
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
            school_id = $8,
            duration_unit = $9
          WHERE id = $1
          RETURNING ${LESSON_WRITE_RETURNING}
        `,
        [
          id,
          parsed.studentName,
          parsed.dateStr,
          priced.duration,
          parsed.comment,
          parsed.lessonTypeId,
          priced.calculatedPrice,
          parsed.schoolId,
          priced.lessonType.durationUnit,
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
