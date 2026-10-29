import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createLessonsRouter } from './lessons.js';
import { createFakePool, createTestApp, failingPool, queryFor } from './testHelpers.js';

const privateCourse = {
  id: 'type-private',
  name: 'Private Course',
  basePrice: '28.00',
  baseDurationMinutes: 45,
  durationUnit: 'minutes',
};

const groupCourse = {
  id: 'type-group',
  name: 'Group Course',
  basePrice: '32.00',
  baseDurationMinutes: 45,
  durationUnit: 'teaching_units',
};

const alphaCampus = {
  id: 'school-alpha',
  title: 'Alpha Campus',
};

/** Resolves the lesson-type and school lookups, then echoes writes back like Postgres would. */
function pricingPool(lessonType = privateCourse, school = alphaCampus) {
  return createFakePool((sql, params) => {
    if (sql.includes('FROM schools')) {
      return { rows: school ? [school] : [] };
    }
    if (sql.includes('FROM lesson_types')) {
      return { rows: lessonType ? [lessonType] : [] };
    }
    if (sql.includes('INSERT INTO lessons')) {
      const [
        id,
        studentName,
        date,
        duration,
        comment,
        createdAt,
        lessonTypeId,
        calculatedPrice,
        schoolId,
        durationUnit,
      ] = params;
      return {
        rows: [
          {
            id,
            studentName,
            date,
            duration: String(duration),
            durationUnit,
            comment,
            createdAt,
            lessonTypeId,
            schoolId,
            calculatedPrice: String(calculatedPrice),
          },
        ],
      };
    }
    if (sql.includes('UPDATE lessons')) {
      const [
        id,
        studentName,
        date,
        duration,
        comment,
        lessonTypeId,
        calculatedPrice,
        schoolId,
        durationUnit,
      ] = params;
      return {
        rows: [
          {
            id,
            studentName,
            date,
            duration: String(duration),
            durationUnit,
            comment,
            createdAt: 1,
            lessonTypeId,
            schoolId,
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
  schoolId: 'school-alpha',
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
          schoolId: 'school-alpha',
          schoolTitle: 'Alpha Campus',
          calculatedPrice: '37.33',
        },
      ],
    }));

    const res = await request(appFor(pool)).get('/api/lessons');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      lessonTypeId: 'type-private',
      lessonTypeName: 'Private Course',
      schoolId: 'school-alpha',
      schoolTitle: 'Alpha Campus',
      calculatedPrice: 37.33,
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
          schoolId: null,
          schoolTitle: null,
          calculatedPrice: null,
        },
      ],
    }));

    const res = await request(appFor(pool)).get('/api/lessons');

    expect(res.body[0].calculatedPrice).toBeNull();
    expect(res.body[0].schoolId).toBeNull();
    expect(queryFor(pool, 'LEFT JOIN lesson_types')).toBeDefined();
    expect(queryFor(pool, 'LEFT JOIN schools')).toBeDefined();
  });

  it('returns the duration unit and a numeric duration', async () => {
    const pool = createFakePool(() => ({
      rows: [
        {
          id: 'lesson-2',
          studentName: 'Sam',
          date: '2026-04-02',
          duration: '3.20',
          durationUnit: 'teaching_units',
          comment: '',
          createdAt: 1,
          lessonTypeId: 'type-group',
          lessonTypeName: 'Group Course',
          schoolId: 'school-alpha',
          schoolTitle: 'Alpha Campus',
          calculatedPrice: '102.40',
        },
      ],
    }));

    const res = await request(appFor(pool)).get('/api/lessons');

    expect(res.body[0]).toMatchObject({ duration: 3.2, durationUnit: 'teaching_units', calculatedPrice: 102.4 });
    expect(queryFor(pool, 'FROM lessons l').sql).toContain('l.duration_unit AS "durationUnit"');
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
    // 60 minutes against a 28.00 / 45 minute type.
    expect(res.body.calculatedPrice).toBe(37.33);
    expect(res.body.lessonTypeId).toBe('type-private');
    expect(res.body.lessonTypeName).toBe('Private Course');
    expect(res.body.schoolId).toBe('school-alpha');
    expect(res.body.schoolTitle).toBe('Alpha Campus');

    const insert = queryFor(pool, 'INSERT INTO lessons');
    expect(insert.params).toContain('type-private');
    expect(insert.params).toContain(37.33);
  });

  it('stores minute lessons in minutes', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool)).post('/api/lessons').send(validBody);

    expect(res.body).toMatchObject({ duration: 60, durationUnit: 'minutes' });
    const insert = queryFor(pool, 'INSERT INTO lessons');
    expect(insert.sql).toContain('duration_unit');
    expect(insert.params[3]).toBe(60);
    expect(insert.params[9]).toBe('minutes');
    expect(queryFor(pool, 'FROM lesson_types').sql).toContain('duration_unit AS "durationUnit"');
  });

  it('floors fractional minutes for a minutes type', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, duration: 60.9 });

    expect(res.status).toBe(201);
    expect(queryFor(pool, 'INSERT INTO lessons').params[3]).toBe(60);
  });

  it('stores a teaching-unit lesson in UE and charges the price per unit', async () => {
    const pool = pricingPool(groupCourse);

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, duration: 3.2, lessonTypeId: 'type-group' });

    expect(res.status).toBe(201);
    // 3.2 UE at 32.00 per UE.
    expect(res.body).toMatchObject({
      duration: 3.2,
      durationUnit: 'teaching_units',
      calculatedPrice: 102.4,
      lessonTypeName: 'Group Course',
    });
    const insert = queryFor(pool, 'INSERT INTO lessons');
    expect(insert.params[3]).toBe(3.2);
    expect(insert.params[7]).toBe(102.4);
    expect(insert.params[9]).toBe('teaching_units');
  });

  it('accepts a teaching-unit duration sent as a string', async () => {
    const pool = pricingPool(groupCourse);

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, duration: '1.75', lessonTypeId: 'type-group' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ duration: 1.75, calculatedPrice: 56 });
  });

  it.each([
    ['more than 2 decimals', 3.255],
    ['zero', 0],
    ['more than 20 units', 20.5],
  ])('rejects a teaching-unit duration with %s', async (_case, duration) => {
    const pool = pricingPool(groupCourse);

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, duration, lessonTypeId: 'type-group' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      'duration must be between 0.01 and 20 teaching units with at most 2 decimal places'
    );
    expect(queryFor(pool, 'INSERT INTO lessons')).toBeUndefined();
  });

  it.each([
    ['missing', undefined],
    ['not a number', 'abc'],
    ['null', null],
    ['an empty string', ''],
    ['a boolean', true],
  ])('rejects a duration that is %s before looking up the type', async (_case, duration) => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, duration });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('duration must be a number');
    expect(queryFor(pool, 'FROM lesson_types')).toBeUndefined();
  });

  it('charges the base price when the duration matches the base duration', async () => {
    const pool = pricingPool({
      id: 'type-present',
      name: 'Present Course',
      basePrice: '50.00',
      baseDurationMinutes: 150,
      durationUnit: 'minutes',
    });

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, duration: 150, lessonTypeId: 'type-present' });

    expect(res.body.calculatedPrice).toBe(50);
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

  it('rejects a missing school', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool)).post('/api/lessons').send({ ...validBody, schoolId: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/schoolId is required/);
    expect(queryFor(pool, 'INSERT INTO lessons')).toBeUndefined();
  });

  it('rejects a school that does not exist', async () => {
    const pool = pricingPool(privateCourse, null);

    const res = await request(appFor(pool)).post('/api/lessons').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/schoolId is invalid/);
    expect(queryFor(pool, 'INSERT INTO lessons')).toBeUndefined();
  });

  it.each([[''], ['   ']])('accepts a lesson without a student name (%j)', async (studentName) => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, studentName });

    expect(res.status).toBe(201);
    expect(queryFor(pool, 'INSERT INTO lessons').params[1]).toBe('');
  });

  it.each([
    ['missing', { studentName: undefined }],
    ['not a string', { studentName: 42 }],
  ])('rejects a student name that is %s', async (_case, override) => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/studentName must be a string/);
    expect(queryFor(pool, 'INSERT INTO lessons')).toBeUndefined();
  });

  it.each([
    ['date', { date: 'not-a-date' }, /date is invalid/],
    ['duration', { duration: 0 }, /duration must be an integer between 1 and 9999/],
    ['duration', { duration: 10000 }, /duration must be an integer between 1 and 9999/],
    ['duration', { duration: 0.5 }, /duration must be an integer between 1 and 9999/],
  ])('rejects an invalid %s', async (_field, override, expected) => {
    const res = await request(appFor(pricingPool()))
      .post('/api/lessons')
      .send({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(expected);
  });

  it.each([
    ['date', { date: 20260308 }, /date is invalid/],
    ['lessonTypeId', { lessonTypeId: 7 }, /lessonTypeId is required/],
    ['schoolId', { schoolId: 7 }, /schoolId is required/],
  ])('rejects a %s that is not a string', async (_field, override, expected) => {
    const res = await request(appFor(pricingPool()))
      .post('/api/lessons')
      .send({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(expected);
  });

  it('stores an empty comment when the comment is not a string', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .post('/api/lessons')
      .send({ ...validBody, comment: null });

    expect(res.status).toBe(201);
    expect(queryFor(pool, 'INSERT INTO lessons').params[4]).toBe('');
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
    // 90 minutes against a 28.00 / 45 minute type.
    expect(res.body).toMatchObject({
      id: 'lesson-1',
      studentName: 'Alex B',
      duration: 90,
      lessonTypeId: 'type-private',
      lessonTypeName: 'Private Course',
      schoolId: 'school-alpha',
      schoolTitle: 'Alpha Campus',
      calculatedPrice: 56,
    });

    const update = queryFor(pool, 'UPDATE lessons');
    expect(update.params[0]).toBe('lesson-1');
    expect(update.params).toContain(56);
  });

  it('updates a teaching-unit lesson and stores its unit', async () => {
    const pool = pricingPool(groupCourse);

    const res = await request(appFor(pool))
      .put('/api/lessons/lesson-1')
      .send({ ...validBody, duration: 2.5, lessonTypeId: 'type-group' });

    expect(res.status).toBe(200);
    // 2.5 UE at 32.00 per UE.
    expect(res.body).toMatchObject({ duration: 2.5, durationUnit: 'teaching_units', calculatedPrice: 80 });
    const update = queryFor(pool, 'UPDATE lessons');
    expect(update.sql).toContain('duration_unit = $9');
    expect(update.params[3]).toBe(2.5);
    expect(update.params[8]).toBe('teaching_units');
  });

  it('switches a lesson to the unit of its new lesson type', async () => {
    const pool = pricingPool(privateCourse);

    const res = await request(appFor(pool)).put('/api/lessons/lesson-1').send(validBody);

    expect(res.body.durationUnit).toBe('minutes');
    expect(queryFor(pool, 'UPDATE lessons').params[8]).toBe('minutes');
  });

  it('validates the duration against the unit of the lesson type', async () => {
    const pool = pricingPool(groupCourse);

    const res = await request(appFor(pool))
      .put('/api/lessons/lesson-1')
      .send({ ...validBody, duration: 60, lessonTypeId: 'type-group' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/between 0.01 and 20 teaching units/);
    expect(queryFor(pool, 'UPDATE lessons')).toBeUndefined();
  });

  it('returns 404 when the lesson is gone', async () => {
    const pool = createFakePool((sql) => {
      if (sql.includes('FROM lesson_types')) return { rows: [privateCourse] };
      if (sql.includes('FROM schools')) return { rows: [alphaCampus] };
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

  it('does not clear the student name when an update leaves it out', async () => {
    const pool = pricingPool();
    const withoutStudent = { ...validBody };
    delete withoutStudent.studentName;

    const res = await request(appFor(pool)).put('/api/lessons/lesson-1').send(withoutStudent);

    expect(res.status).toBe(400);
    expect(queryFor(pool, 'UPDATE lessons')).toBeUndefined();
  });

  it('validates the body like create does', async () => {
    const pool = pricingPool();

    const res = await request(appFor(pool))
      .put('/api/lessons/lesson-1')
      .send({ ...validBody, duration: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duration must be an integer between 1 and 9999/);
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

describe('server errors', () => {
  it.each([
    ['GET', '/api/lessons', /failed to load lessons/],
    ['POST', '/api/lessons', /failed to create lesson/],
    ['PUT', '/api/lessons/lesson-1', /failed to update lesson/],
    ['DELETE', '/api/lessons/lesson-1', /failed to delete lesson/],
  ])('%s %s answers 500 when the query fails', async (method, path, expected) => {
    const res = await request(appFor(failingPool()))[method.toLowerCase()](path).send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(expected);
  });
});
