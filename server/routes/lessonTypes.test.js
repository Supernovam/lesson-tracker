import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createLessonTypesRouter } from './lessonTypes.js';
import { createFakePool, createTestApp, failingPool, queryFor } from './testHelpers.js';

function appFor(pool, options = {}) {
  const router = createLessonTypesRouter({ pool, isDbReady: options.isDbReady ?? (() => true) });
  return createTestApp(router, { mountPath: '/api/lesson-types', user: options.user });
}

function typeRow(fields) {
  return { lessonCount: 0, createdAt: 1, ...fields, basePrice: String(fields.basePrice) };
}

/**
 * Echoes INSERT/UPDATE params back the way Postgres would, with numeric as a string.
 * `storedUnit` is what a PUT without a unit reads back for the existing type.
 */
function writePool(storedUnit = 'minutes') {
  return createFakePool((sql, params) => {
    if (sql.includes('INSERT INTO lesson_types')) {
      const [id, name, basePrice, baseDurationMinutes, durationUnit, createdAt, updatedAt] = params;
      return {
        rows: [typeRow({ id, name, basePrice, baseDurationMinutes, durationUnit, createdAt, updatedAt })],
      };
    }
    if (sql.includes('UPDATE lesson_types')) {
      const [id, name, basePrice, baseDurationMinutes, durationUnit, updatedAt] = params;
      return { rows: [typeRow({ id, name, basePrice, baseDurationMinutes, durationUnit, updatedAt })] };
    }
    if (sql.includes('SELECT duration_unit')) return { rows: [{ durationUnit: storedUnit }] };
    return { rows: [] };
  });
}

const validBody = { name: 'Private Course', basePrice: 28, baseDurationMinutes: 45 };

describe('GET /api/lesson-types', () => {
  it('returns types ordered by name with a numeric price', async () => {
    const pool = createFakePool(() => ({
      rows: [
        {
          id: 'type-1',
          name: 'Private Course',
          basePrice: '28.00',
          baseDurationMinutes: 45,
          durationUnit: 'teaching_units',
          lessonCount: 3,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    }));

    const res = await request(appFor(pool)).get('/api/lesson-types');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ basePrice: 28, durationUnit: 'teaching_units', lessonCount: 3 });
    const select = queryFor(pool, 'ORDER BY name ASC');
    expect(select.sql).toContain('duration_unit AS "durationUnit"');
    expect(select.sql).toMatch(/SELECT count\(\*\) FROM lessons WHERE lessons\.lesson_type_id = lesson_types\.id\)::int AS "lessonCount"/);
  });

  it('requires authentication', async () => {
    const res = await request(appFor(createFakePool(), { user: null })).get('/api/lesson-types');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/lesson-types', () => {
  it('creates a type and returns it', async () => {
    const pool = writePool();

    const res = await request(appFor(pool)).post('/api/lesson-types').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Private Course',
      basePrice: 28,
      baseDurationMinutes: 45,
    });
    expect(res.body.createdAt).toBe(res.body.updatedAt);
  });

  it('bills by the minute when no unit is sent', async () => {
    const pool = writePool();

    const res = await request(appFor(pool)).post('/api/lesson-types').send(validBody);

    expect(res.body.durationUnit).toBe('minutes');
    expect(queryFor(pool, 'INSERT INTO lesson_types').params[4]).toBe('minutes');
  });

  it('creates a minutes type when the unit is sent explicitly', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .post('/api/lesson-types')
      .send({ ...validBody, durationUnit: 'minutes', baseDurationMinutes: 90 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ durationUnit: 'minutes', baseDurationMinutes: 90 });
  });

  it('creates a teaching-unit type with a base duration of one 45-minute unit', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .post('/api/lesson-types')
      .send({ name: 'Group Course', basePrice: 32, durationUnit: 'teaching_units', baseDurationMinutes: 60 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Group Course',
      basePrice: 32,
      baseDurationMinutes: 45,
      durationUnit: 'teaching_units',
      lessonCount: 0,
    });
    expect(queryFor(pool, 'INSERT INTO lesson_types').params.slice(1, 5)).toEqual([
      'Group Course',
      32,
      45,
      'teaching_units',
    ]);
  });

  it('does not require a base duration for a teaching-unit type', async () => {
    const res = await request(appFor(writePool()))
      .post('/api/lesson-types')
      .send({ name: 'Group Course', basePrice: 32, durationUnit: 'teaching_units' });

    expect(res.status).toBe(201);
    expect(res.body.baseDurationMinutes).toBe(45);
  });

  it('still validates the price of a teaching-unit type', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .post('/api/lesson-types')
      .send({ name: 'Group Course', basePrice: -1, durationUnit: 'teaching_units' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/basePrice must be a number/);
    expect(queryFor(pool, 'INSERT INTO lesson_types')).toBeUndefined();
  });

  it('trims the name', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .post('/api/lesson-types')
      .send({ ...validBody, name: '  Present Course  ' });

    expect(res.body.name).toBe('Present Course');
  });

  it.each([
    ['a blank name', { name: '   ' }, /name is required/],
    ['a negative price', { basePrice: -1 }, /basePrice must be a number/],
    ['a price with too many decimals', { basePrice: 28.999 }, /at most 2 decimal places/],
    ['a zero duration', { baseDurationMinutes: 0 }, /baseDurationMinutes must be an integer/],
    ['an out-of-range duration', { baseDurationMinutes: 10000 }, /baseDurationMinutes must be an integer/],
    ['an unknown unit', { durationUnit: 'hours' }, /durationUnit must be "minutes" or "teaching_units"/],
    ['a null unit', { durationUnit: null }, /durationUnit must be/],
  ])('rejects %s', async (_label, override, expected) => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .post('/api/lesson-types')
      .send({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(expected);
    expect(queryFor(pool, 'INSERT INTO lesson_types')).toBeUndefined();
  });

  it('rejects a name that is not a string', async () => {
    const res = await request(appFor(writePool()))
      .post('/api/lesson-types')
      .send({ ...validBody, name: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/);
  });

  it('accepts a price sent as a string', async () => {
    const res = await request(appFor(writePool()))
      .post('/api/lesson-types')
      .send({ ...validBody, basePrice: '28.50' });

    expect(res.status).toBe(201);
    expect(res.body.basePrice).toBe(28.5);
  });

  it('accepts a zero price', async () => {
    const res = await request(appFor(writePool()))
      .post('/api/lesson-types')
      .send({ ...validBody, basePrice: 0 });

    expect(res.status).toBe(201);
    expect(res.body.basePrice).toBe(0);
  });

  it('reports a conflict for a duplicate name', async () => {
    const res = await request(appFor(failingPool('23505')))
      .post('/api/lesson-types')
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });
});

describe('PUT /api/lesson-types/:id', () => {
  it('updates the type and bumps updatedAt', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .put('/api/lesson-types/type-1')
      .send({ name: 'Private Course', basePrice: 23.5, baseDurationMinutes: 60 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ basePrice: 23.5, baseDurationMinutes: 60, durationUnit: 'minutes' });
    expect(res.body.updatedAt).toBeGreaterThan(res.body.createdAt);
  });

  it('keeps the stored unit when the body has none', async () => {
    const pool = writePool('teaching_units');

    const res = await request(appFor(pool))
      .put('/api/lesson-types/type-1')
      .send({ name: 'Group Course', basePrice: 34, baseDurationMinutes: 45 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ durationUnit: 'teaching_units', baseDurationMinutes: 45, basePrice: 34 });
    expect(queryFor(pool, 'SELECT duration_unit').params).toEqual(['type-1']);
    expect(queryFor(pool, 'UPDATE lesson_types').params[4]).toBe('teaching_units');
  });

  it('does not read the stored unit when the body names one', async () => {
    const pool = writePool();

    await request(appFor(pool))
      .put('/api/lesson-types/type-1')
      .send({ ...validBody, durationUnit: 'minutes' });

    expect(queryFor(pool, 'SELECT duration_unit')).toBeUndefined();
  });

  it('switches an unused type to teaching units', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .put('/api/lesson-types/type-1')
      .send({ name: 'Group Course', basePrice: 32, durationUnit: 'teaching_units' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ durationUnit: 'teaching_units', baseDurationMinutes: 45 });
    const update = queryFor(pool, 'UPDATE lesson_types');
    expect(update.params.slice(0, 5)).toEqual(['type-1', 'Group Course', 32, 45, 'teaching_units']);
  });

  it('only changes the unit while no lessons use the type', async () => {
    const pool = writePool();

    await request(appFor(pool)).put('/api/lesson-types/type-1').send(validBody);

    expect(queryFor(pool, 'UPDATE lesson_types').sql).toMatch(
      /duration_unit = \$5\s+OR NOT EXISTS \(SELECT 1 FROM lessons WHERE lessons\.lesson_type_id = \$1\)/
    );
  });

  it('refuses to change the unit of a type used by lessons', async () => {
    // The guarded UPDATE matches nothing, but the type still exists.
    const pool = createFakePool((sql) => {
      if (sql.includes('SELECT 1 FROM lesson_types')) return { rows: [{ '?column?': 1 }] };
      return { rows: [] };
    });

    const res = await request(appFor(pool))
      .put('/api/lesson-types/type-1')
      .send({ ...validBody, durationUnit: 'teaching_units' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/duration unit cannot change while lessons use this lesson type/);
    expect(queryFor(pool, 'SELECT 1 FROM lesson_types').params).toEqual(['type-1']);
  });

  it.each([
    ['without a unit', validBody, 'SELECT duration_unit'],
    ['with a unit', { ...validBody, durationUnit: 'minutes' }, 'SELECT 1 FROM lesson_types'],
  ])('returns 404 when the type is gone (%s)', async (_case, body, lookup) => {
    const pool = createFakePool(() => ({ rows: [] }));

    const res = await request(appFor(pool)).put('/api/lesson-types/missing').send(body);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/lesson type not found/);
    expect(queryFor(pool, lookup).params).toEqual(['missing']);
  });

  it('validates the unit like create does', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .put('/api/lesson-types/type-1')
      .send({ ...validBody, durationUnit: 'hours' });

    expect(res.status).toBe(400);
    expect(queryFor(pool, 'UPDATE lesson_types')).toBeUndefined();
  });

  it('reports a conflict when renaming onto an existing name', async () => {
    const res = await request(appFor(failingPool('23505')))
      .put('/api/lesson-types/type-1')
      .send(validBody);

    expect(res.status).toBe(409);
  });

  it('validates the body like create does', async () => {
    const res = await request(appFor(writePool()))
      .put('/api/lesson-types/type-1')
      .send({ ...validBody, basePrice: -5 });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/lesson-types/:id', () => {
  it('deletes an unused type', async () => {
    const pool = createFakePool(() => ({ rows: [] }));

    const res = await request(appFor(pool)).delete('/api/lesson-types/type-1');

    expect(res.status).toBe(204);
    expect(queryFor(pool, 'DELETE FROM lesson_types').params).toEqual(['type-1']);
  });

  it('refuses to delete a type still used by lessons', async () => {
    const res = await request(appFor(failingPool('23503'))).delete('/api/lesson-types/type-1');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/used by existing lessons/);
  });

});

describe('server errors', () => {
  it.each([
    ['GET', '/api/lesson-types', /failed to load lesson types/],
    ['POST', '/api/lesson-types', /failed to create lesson type/],
    ['PUT', '/api/lesson-types/type-1', /failed to update lesson type/],
    ['DELETE', '/api/lesson-types/type-1', /failed to delete lesson type/],
  ])('%s %s answers 500 when the query fails', async (method, path, expected) => {
    const res = await request(appFor(failingPool('XX000')))[method.toLowerCase()](path).send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(expected);
  });
});
