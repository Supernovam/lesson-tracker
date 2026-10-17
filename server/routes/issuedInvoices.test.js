import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createIssuedInvoicesRouter } from './issuedInvoices.js';
import { createFakePool, createTestApp } from './testHelpers.js';

/** In-memory stand-in for `issued_invoices`, enough for the statements the router runs. */
function createIssuedInvoicesPool(initialRows = [], { knownSchools = ['school-alpha', 'school-beta'] } = {}) {
  const table = initialRows.map((row) => ({ ...row }));
  const select = (from, to, schoolIds) =>
    table
      .filter((row) => row.from === from && row.to === to && (!schoolIds || schoolIds.includes(row.schoolId)))
      .sort((a, b) => a.year - b.year || a.number - b.number)
      .map(({ schoolId, from: f, to: t, year, number, issuedOn }) => ({
        schoolId,
        from: f,
        to: t,
        year,
        number,
        issuedOn,
      }));

  const pool = createFakePool((sql, params) => {
    if (sql.includes('MAX(number)')) {
      const numbers = table.filter((row) => row.year === params[0]).map((row) => row.number);
      return { rows: [{ nextNumber: Math.max(0, ...numbers) + 1 }] };
    }
    if (sql.includes('INSERT INTO issued_invoices')) {
      const [, schoolId, from, to, year, number, issuedOn] = params;
      if (!knownSchools.includes(schoolId)) throw Object.assign(new Error('fk'), { code: '23503' });
      table.push({ schoolId, from, to, year, number, issuedOn });
      return { rows: [] };
    }
    if (sql.includes('FROM issued_invoices')) {
      return { rows: select(params[0], params[1], params[2]) };
    }
    return undefined;
  });
  return { pool, table };
}

function appFor(pool, options = {}) {
  const router = createIssuedInvoicesRouter({ pool, isDbReady: options.isDbReady ?? (() => true) });
  return createTestApp(router, { mountPath: '/api/issued-invoices', user: options.user });
}

const period = { from: '2026-09-01', to: '2026-09-30' };

describe('GET /api/issued-invoices', () => {
  it('returns issued numbers for the period and the next number for the year', async () => {
    const { pool } = createIssuedInvoicesPool([
      { schoolId: 'school-alpha', ...period, year: 2026, number: 13, issuedOn: '2026-10-01' },
      { schoolId: 'school-alpha', from: '2026-08-01', to: '2026-08-31', year: 2026, number: 12, issuedOn: '2026-09-01' },
    ]);

    const res = await request(appFor(pool)).get('/api/issued-invoices').query({ ...period, year: 2026 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      invoices: [{ schoolId: 'school-alpha', ...period, year: 2026, number: 13, issuedOn: '2026-10-01' }],
      nextNumber: 14,
    });
  });

  it('rejects an invalid period', async () => {
    const { pool } = createIssuedInvoicesPool();
    const res = await request(appFor(pool))
      .get('/api/issued-invoices')
      .query({ from: '2026-09-30', to: '2026-09-01', year: 2026 });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const { pool } = createIssuedInvoicesPool();
    const res = await request(appFor(pool, { user: null })).get('/api/issued-invoices').query({ ...period, year: 2026 });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/issued-invoices', () => {
  it('assigns consecutive numbers in the given school order inside a locked transaction', async () => {
    const { pool } = createIssuedInvoicesPool([
      { schoolId: 'school-alpha', from: '2026-08-01', to: '2026-08-31', year: 2026, number: 12, issuedOn: '2026-09-01' },
    ]);

    const res = await request(appFor(pool))
      .post('/api/issued-invoices')
      .send({ ...period, issuedOn: '2026-10-17', schoolIds: ['school-alpha', 'school-beta'] });

    expect(res.status).toBe(201);
    expect(res.body.map((row) => [row.schoolId, row.number, row.year])).toEqual([
      ['school-alpha', 13, 2026],
      ['school-beta', 14, 2026],
    ]);
    const statements = pool.calls.map((call) => call.sql.trim().split(/\s+/).slice(0, 2).join(' '));
    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toBe('LOCK TABLE');
    expect(statements.at(-1)).toBe('COMMIT');
    expect(pool.released).toBe(1);
  });

  it('starts 2026 at 12, then counts up by one per issued invoice', async () => {
    const { pool } = createIssuedInvoicesPool();
    const app = appFor(pool);

    const first = await request(app)
      .post('/api/issued-invoices')
      .send({ ...period, issuedOn: '2026-10-17', schoolIds: ['school-alpha'] });
    const second = await request(app)
      .post('/api/issued-invoices')
      .send({ from: '2026-10-01', to: '2026-10-31', issuedOn: '2026-11-02', schoolIds: ['school-alpha', 'school-beta'] });
    const next = await request(app).get('/api/issued-invoices').query({ ...period, year: 2026 });

    expect(first.body.map((row) => row.number)).toEqual([12]);
    expect(second.body.map((row) => row.number)).toEqual([13, 14]);
    expect(next.body.nextNumber).toBe(15);
  });

  it('starts 2027 at 1 even when no 2026 invoice was issued in the app', async () => {
    const { pool } = createIssuedInvoicesPool();

    const res = await request(appFor(pool))
      .post('/api/issued-invoices')
      .send({ from: '2026-12-01', to: '2026-12-31', issuedOn: '2027-01-01', schoolIds: ['school-alpha'] });

    expect(res.body).toEqual([
      { schoolId: 'school-alpha', from: '2026-12-01', to: '2026-12-31', year: 2027, number: 1, issuedOn: '2027-01-01' },
    ]);
  });

  it('starts again at 1 in a new calendar year', async () => {
    const { pool } = createIssuedInvoicesPool([
      { schoolId: 'school-alpha', from: '2026-11-01', to: '2026-11-30', year: 2026, number: 12, issuedOn: '2026-12-01' },
    ]);

    const res = await request(appFor(pool))
      .post('/api/issued-invoices')
      .send({ from: '2026-12-01', to: '2026-12-31', issuedOn: '2027-01-02', schoolIds: ['school-alpha'] });

    expect(res.status).toBe(201);
    expect(res.body).toEqual([
      { schoolId: 'school-alpha', from: '2026-12-01', to: '2026-12-31', year: 2027, number: 1, issuedOn: '2027-01-02' },
    ]);
  });

  it('keeps the existing number when a school was already issued for the period', async () => {
    const { pool, table } = createIssuedInvoicesPool([
      { schoolId: 'school-alpha', ...period, year: 2026, number: 12, issuedOn: '2026-10-01' },
    ]);

    const res = await request(appFor(pool))
      .post('/api/issued-invoices')
      .send({ ...period, issuedOn: '2026-10-17', schoolIds: ['school-alpha', 'school-beta'] });

    expect(res.status).toBe(201);
    expect(res.body.map((row) => [row.schoolId, row.number])).toEqual([
      ['school-alpha', 12],
      ['school-beta', 13],
    ]);
    expect(table).toHaveLength(2);
  });

  it('rolls back and reports an unknown school without consuming a number', async () => {
    const { pool, table } = createIssuedInvoicesPool();

    const res = await request(appFor(pool))
      .post('/api/issued-invoices')
      .send({ ...period, issuedOn: '2026-10-17', schoolIds: ['school-gone'] });

    expect(res.status).toBe(400);
    expect(pool.calls.some((call) => call.sql === 'ROLLBACK')).toBe(true);
    expect(pool.calls.some((call) => call.sql === 'COMMIT')).toBe(false);
    expect(pool.released).toBe(1);
    expect(table).toHaveLength(0);
  });

  it.each([
    [{ ...period, issuedOn: '2026-10-17', schoolIds: [] }, /schoolIds/],
    [{ ...period, issuedOn: '2026-10-17', schoolIds: ['a', 'a'] }, /unique/],
    [{ ...period, issuedOn: 'today', schoolIds: ['a'] }, /issuedOn/],
    [{ from: '2026-09-30', to: '2026-09-01', issuedOn: '2026-10-17', schoolIds: ['a'] }, /after/],
  ])('rejects invalid body %#', async (body, message) => {
    const { pool } = createIssuedInvoicesPool();
    const res = await request(appFor(pool)).post('/api/issued-invoices').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(pool.calls).toHaveLength(0);
  });

  it('reports 503 while the database is still connecting', async () => {
    const { pool } = createIssuedInvoicesPool();
    const res = await request(appFor(pool, { isDbReady: () => false }))
      .post('/api/issued-invoices')
      .send({ ...period, issuedOn: '2026-10-17', schoolIds: ['school-alpha'] });
    expect(res.status).toBe(503);
  });
});
