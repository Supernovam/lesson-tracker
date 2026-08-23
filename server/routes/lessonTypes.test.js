import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createLessonTypesRouter } from './lessonTypes.js';
import { createFakePool, createTestApp, queryFor } from './testHelpers.js';

function appFor(pool, options = {}) {
  const router = createLessonTypesRouter({ pool, isDbReady: options.isDbReady ?? (() => true) });
  return createTestApp(router, { mountPath: '/api/lesson-types', user: options.user });
}

/** Echoes INSERT/UPDATE params back the way Postgres would, with numeric as a string. */
function writePool() {
  return createFakePool((sql, params) => {
    if (sql.includes('INSERT INTO lesson_types')) {
      const [id, name, basePrice, baseDurationMinutes, createdAt, updatedAt] = params;
      return {
        rows: [
          { id, name, basePrice: String(basePrice), baseDurationMinutes, createdAt, updatedAt },
        ],
      };
    }
    if (sql.includes('UPDATE lesson_types')) {
      const [id, name, basePrice, baseDurationMinutes, updatedAt] = params;
      return {
        rows: [
          { id, name, basePrice: String(basePrice), baseDurationMinutes, createdAt: 1, updatedAt },
        ],
      };
    }
    return { rows: [] };
  });
}

function failingPool(code) {
  return createFakePool(() => {
    const err = new Error('constraint violation');
    err.code = code;
    throw err;
  });
}

const validBody = { name: 'Private Course', basePrice: 19, baseDurationMinutes: 45 };

describe('GET /api/lesson-types', () => {
  it('returns types ordered by name with a numeric price', async () => {
    const pool = createFakePool(() => ({
      rows: [
        {
          id: 'type-1',
          name: 'Private Course',
          basePrice: '19.00',
          baseDurationMinutes: 45,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    }));

    const res = await request(appFor(pool)).get('/api/lesson-types');

    expect(res.status).toBe(200);
    expect(res.body[0].basePrice).toBe(19);
    expect(queryFor(pool, 'ORDER BY name ASC')).toBeDefined();
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
      basePrice: 19,
      baseDurationMinutes: 45,
    });
    expect(res.body.createdAt).toBe(res.body.updatedAt);
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
    ['a price with too many decimals', { basePrice: 19.999 }, /at most 2 decimal places/],
    ['a zero duration', { baseDurationMinutes: 0 }, /baseDurationMinutes must be an integer/],
    ['an out-of-range duration', { baseDurationMinutes: 10000 }, /baseDurationMinutes must be an integer/],
  ])('rejects %s', async (_label, override, expected) => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .post('/api/lesson-types')
      .send({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(expected);
    expect(queryFor(pool, 'INSERT INTO lesson_types')).toBeUndefined();
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
      .send({ name: 'Private Course', basePrice: 21.5, baseDurationMinutes: 60 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ basePrice: 21.5, baseDurationMinutes: 60 });
    expect(res.body.updatedAt).toBeGreaterThan(res.body.createdAt);
  });

  it('returns 404 when the type is gone', async () => {
    const pool = createFakePool(() => ({ rows: [] }));

    const res = await request(appFor(pool)).put('/api/lesson-types/missing').send(validBody);

    expect(res.status).toBe(404);
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
