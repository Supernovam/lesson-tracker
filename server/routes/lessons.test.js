import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createLessonsRouter } from './lessons.js';
import { createFakePool, createTestApp, queryFor } from './testHelpers.js';

const privateCourse = {
  id: 'type-private',
  name: 'Private Course',
  basePrice: '19.00',
  baseDurationMinutes: 45,
};

/** Resolves the lesson-type lookup, then echoes the INSERT back like Postgres would. */
function pricingPool(lessonType = privateCourse) {
  return createFakePool((sql, params) => {
    if (sql.includes('FROM lesson_types')) {
      return { rows: lessonType ? [lessonType] : [] };
    }
    if (sql.includes('INSERT INTO lessons')) {
      const [id, studentName, date, duration, comment, createdAt, lessonTypeId, calculatedPrice] =
        params;
      return {
        rows: [
          {
            id,
            studentName,
            date,
            duration,
            comment,
            createdAt,
            lessonTypeId,
            calculatedPrice: String(calculatedPrice),
          },
        ],
      };
    }
    if (sql.includes('UPDATE lessons')) {
      const [id, studentName, date, duration, comment, lessonTypeId, calculatedPrice] = params;
      return {
        rows: [
          {
            id,
            studentName,
            date,
            duration,
            comment,
            createdAt: 1,
            lessonTypeId,
            calculatedPrice: String(calculatedPrice),
          },
        ],
      };
    }
    return { rows: [] };
  });
}

function appFor(pool, options = {}) {
  const router = createLessonsRouter({ pool, isDbReady: options.isDbReady ?? (() => true) });
  return createTestApp(router, { mountPath: '/api/lessons', user: options.user });
}

const validBody = {
  studentName: 'Alex',
  date: '2026-03-08',
  duration: 60,
  comment: 'Good session',
  lessonTypeId: 'type-private',
};

describe('GET /api/lessons', () => {
  it('returns the lesson type name and a numeric price', async () => {
    const pool = createFakePool(() => ({
      rows: [
        {
          id: 'lesson-1',
          studentName: 'Alex',
          date: '2026-03-08',
          duration: 60,
          comment: '',
          createdAt: 1,
          lessonTypeId: 'type-private',
          lessonTypeName: 'Private Course',
          calculatedPrice: '25.33',
        },
      ],
    }));

    const res = await request(appFor(pool)).get('/api/lessons');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      lessonTypeId: 'type-private',
      lessonTypeName: 'Private Course',
      calculatedPrice: 25.33,
    });
  });

  it('joins lesson_types so lessons without a type still load', async () => {
    const pool = createFakePool(() => ({
      rows: [
        {
          id: 'legacy',
          studentName: 'Old',
          date: '2026-01-01',
          duration: 150,
          comment: '',
          createdAt: 1,
          lessonTypeId: null,
          lessonTypeName: null,
          calculatedPrice: null,
        },
      ],
    }));

    const res = await request(appFor(pool)).get('/api/lessons');

    expect(res.body[0].calculatedPrice).toBeNull();
    expect(queryFor(pool, 'LEFT JOIN lesson_types')).toBeDefined();
  });

  it('requires authentication', async () => {
    const res = await request(appFor(createFakePool(), { user: null })).get('/api/lessons');
    expect(res.status).toBe(401);
  });

  it('reports 503 while the database is still connecting', async () => {
    const res = await request(appFor(createFakePool(), { isDbReady: () => false })).get(
      '/api/lessons'
    );
    expect(res.status).toBe(503);
  });
});

describe('POST /api/lessons', () => {
  it('stores the lesson type and the proportional price', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool)).post('/api/lessons').send(validBody);

    expect(res.status).toBe(201);
    // 60 minutes against a 19.00 / 45 minute type.
    expect(res.body.calculatedPrice).toBe(25.33);
    expect(res.body.lessonTypeId).toBe('type-private');
    expect(res.body.lessonTypeName).toBe('Private Course');

    const insert = queryFor(pool, 'INSERT INTO lessons');
    expect(insert.params).toContain('type-private');
    expect(insert.params).toContain(25.33);
  });

  it('charges the base price when the duration matches the base duration', async () => {
    const pool = pricingPool({
      id: 'type-present',
      name: 'Present Course',
      basePrice: '63.00',
      baseDurationMinutes: 150,
    });

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, duration: 150, lessonTypeId: 'type-present' });

    expect(res.body.calculatedPrice).toBe(63);
  });

  it('rejects a missing lesson type', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, lessonTypeId: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lessonTypeId is required/);
    expect(queryFor(pool, 'INSERT INTO lessons')).toBeUndefined();
  });

  it('rejects a lesson type that does not exist', async () => {
    const pool = pricingPool(null);

    const res = await request(appFor(pool)).post('/api/lessons').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lessonTypeId is invalid/);
    expect(queryFor(pool, 'INSERT INTO lessons')).toBeUndefined();
  });

  it.each([
    ['studentName', { studentName: '  ' }, /studentName is required/],
    ['date', { date: 'not-a-date' }, /date is invalid/],
    ['duration', { duration: 0 }, /duration must be an integer/],
    ['duration', { duration: 10000 }, /duration must be an integer/],
  ])('rejects an invalid %s', async (_field, override, expected) => {
    const res = await request(appFor(pricingPool()))
      .post('/api/lessons')
      .send({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(expected);
  });

  it('requires authentication', async () => {
    const res = await request(appFor(createFakePool(), { user: null }))
      .post('/api/lessons')
      .send(validBody);
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/lessons/:id', () => {
  it('recalculates the price and keeps the original id', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .put('/api/lessons/lesson-1')
      .send({ ...validBody, duration: 90, studentName: 'Alex B' });

    expect(res.status).toBe(200);
    // 90 minutes against a 19.00 / 45 minute type.
    expect(res.body).toMatchObject({
      id: 'lesson-1',
      studentName: 'Alex B',
      duration: 90,
      lessonTypeId: 'type-private',
      lessonTypeName: 'Private Course',
      calculatedPrice: 38,
    });

    const update = queryFor(pool, 'UPDATE lessons');
    expect(update.params[0]).toBe('lesson-1');
    expect(update.params).toContain(38);
  });

  it('returns 404 when the lesson is gone', async () => {
    const pool = createFakePool((sql) => {
      if (sql.includes('FROM lesson_types')) return { rows: [privateCourse] };
      return { rows: [] };
    });

    const res = await request(appFor(pool)).put('/api/lessons/missing').send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/lesson not found/);
  });

  it('rejects a lesson type that does not exist', async () => {
    const pool = pricingPool(null);

    const res = await request(appFor(pool)).put('/api/lessons/lesson-1').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lessonTypeId is invalid/);
    expect(queryFor(pool, 'UPDATE lessons')).toBeUndefined();
  });

  it('validates the body like create does', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .put('/api/lessons/lesson-1')
      .send({ ...validBody, studentName: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/studentName is required/);
    expect(queryFor(pool, 'UPDATE lessons')).toBeUndefined();
  });

  it('requires authentication', async () => {
    const res = await request(appFor(createFakePool(), { user: null }))
      .put('/api/lessons/lesson-1')
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it('reports 503 while the database is still connecting', async () => {
    const res = await request(appFor(createFakePool(), { isDbReady: () => false }))
      .put('/api/lessons/lesson-1')
      .send(validBody);
    expect(res.status).toBe(503);
  });
});

describe('DELETE /api/lessons/:id', () => {
  it('deletes by id', async () => {
    const pool = createFakePool(() => ({ rows: [] }));

    const res = await request(appFor(pool)).delete('/api/lessons/lesson-1');

    expect(res.status).toBe(204);
    expect(queryFor(pool, 'DELETE FROM lessons').params).toEqual(['lesson-1']);
  });
});
