import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createInvoiceSettingsRouter } from './invoiceSettings.js';
import { createFakePool, createTestApp, queryFor } from './testHelpers.js';

const FAKE_INVOICE_SETTINGS = {
  issuerName: 'Jane Issuer',
  issuerStreet: 'Example Str. 1',
  issuerPostalCode: '12345',
  issuerCity: 'Example City',
  issuerPhone: '00490000000000',
  issuerEmail: 'issuer@example.com',
  issuerTaxNumber: '00/ 000/ 00000',
  issuerIban: 'DE00 0000 0000 0000 0000 00',
  issuerBic: 'EXAMPLXX',
};

function appFor(pool, options = {}) {
  const router = createInvoiceSettingsRouter({ pool, isDbReady: options.isDbReady ?? (() => true) });
  return createTestApp(router, { mountPath: '/api/invoice-settings', user: options.user });
}

describe('GET /api/invoice-settings', () => {
  it('returns the seeded settings row', async () => {
    const pool = createFakePool(() => ({ rows: [FAKE_INVOICE_SETTINGS] }));

    const res = await request(appFor(pool)).get('/api/invoice-settings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(FAKE_INVOICE_SETTINGS);
    expect(res.body.clientName).toBeUndefined();
    const query = queryFor(pool, "id = 'default'");
    expect(query).toBeDefined();
    expect(query.sql).not.toMatch(/client_name/);
  });

  it('returns 404 when no settings have been seeded', async () => {
    const res = await request(appFor(createFakePool(() => ({ rows: [] })))).get(
      '/api/invoice-settings'
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });

  it('requires authentication', async () => {
    const res = await request(appFor(createFakePool(), { user: null })).get(
      '/api/invoice-settings'
    );
    expect(res.status).toBe(401);
  });

  it('reports 503 while the database is still connecting', async () => {
    const res = await request(appFor(createFakePool(), { isDbReady: () => false })).get(
      '/api/invoice-settings'
    );
    expect(res.status).toBe(503);
  });
});
