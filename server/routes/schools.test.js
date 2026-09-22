import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createSchoolsRouter } from './schools.js';
import { createFakePool, createTestApp, queryFor } from './testHelpers.js';

function appFor(pool, options = {}) {
  const router = createSchoolsRouter({ pool, isDbReady: options.isDbReady ?? (() => true) });
  return createTestApp(router, { mountPath: '/api/schools', user: options.user });
}

function writePool() {
  return createFakePool((sql, params) => {
    if (sql.includes('INSERT INTO schools')) {
      const [id, title, billingName, address, createdAt, updatedAt] = params;
      return { rows: [{ id, title, billingName, address, createdAt, updatedAt }] };
    }
    if (sql.includes('UPDATE schools')) {
      const [id, title, billingName, address, updatedAt] = params;
      return { rows: [{ id, title, billingName, address, createdAt: 1, updatedAt }] };
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

const validBody = {
  title: 'East Campus',
  billingName: 'East Campus GmbH',
  address: 'Main St\n10115 Berlin',
};

describe('GET /api/schools', () => {
  it('returns schools ordered by title', async () => {
    const pool = createFakePool(() => ({
      rows: [
        {
          id: 'school-1',
          title: 'East Campus',
          billingName: 'East Campus GmbH',
          address: 'Main St',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    }));

    const res = await request(appFor(pool)).get('/api/schools');

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('East Campus');
    expect(queryFor(pool, 'ORDER BY title ASC')).toBeDefined();
  });

  it('requires authentication', async () => {
    const res = await request(appFor(createFakePool(), { user: null })).get('/api/schools');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/schools', () => {
  it('creates a school and trims the title, billing name, and address', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .post('/api/schools')
      .send({
        title: '  East Campus  ',
        billingName: '  East Campus GmbH  ',
        address: '  Main St\n10115 Berlin  ',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'East Campus',
      billingName: 'East Campus GmbH',
      address: 'Main St\n10115 Berlin',
    });
    expect(res.body.createdAt).toBe(res.body.updatedAt);
  });

  it.each([
    ['a blank title', { title: '   ' }, /title is required/],
    ['a blank billing name', { billingName: '   ' }, /billingName is required/],
    ['a blank address', { address: '  \n  ' }, /address is required/],
  ])('rejects %s', async (_label, override, expected) => {
    const pool = writePool();

    const res = await request(appFor(pool)).post('/api/schools').send({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(expected);
    expect(queryFor(pool, 'INSERT INTO schools')).toBeUndefined();
  });

  it('reports a conflict for a duplicate title', async () => {
    const res = await request(appFor(failingPool('23505'))).post('/api/schools').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });
});

describe('PUT /api/schools/:id', () => {
  it('updates the school', async () => {
    const pool = writePool();

    const res = await request(appFor(pool))
      .put('/api/schools/school-1')
      .send({ title: 'West Campus', billingName: 'West Campus GmbH', address: 'Side St' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'school-1',
      title: 'West Campus',
      billingName: 'West Campus GmbH',
      address: 'Side St',
    });
  });

  it('returns 404 when the school is gone', async () => {
    const res = await request(appFor(createFakePool(() => ({ rows: [] }))))
      .put('/api/schools/missing')
      .send(validBody);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/schools/:id', () => {
  it('deletes an unused school', async () => {
    const pool = createFakePool(() => ({ rows: [] }));

    const res = await request(appFor(pool)).delete('/api/schools/school-1');

    expect(res.status).toBe(204);
    expect(queryFor(pool, 'DELETE FROM schools').params).toEqual(['school-1']);
  });

  it('refuses to delete a school still used by lessons', async () => {
    const res = await request(appFor(failingPool('23503'))).delete('/api/schools/school-1');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/used by existing lessons/);
  });
});
