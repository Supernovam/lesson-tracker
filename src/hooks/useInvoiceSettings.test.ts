import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInvoiceSettings } from './useInvoiceSettings';
import { apiFetch } from '../api/config';
import { FAKE_INVOICE_SETTINGS } from '../test/invoiceFixtures';

// Only the network call is faked; error and abort helpers stay real.
vi.mock('../api/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/config')>()),
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('useInvoiceSettings', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads invoice settings on mount', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse(FAKE_INVOICE_SETTINGS));

    const { result } = renderHook(() => useInvoiceSettings());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.settings).toEqual(FAKE_INVOICE_SETTINGS);
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/invoice-settings', expect.any(Object));
  });

  it('marks settings as missing when the API returns 404', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ error: 'invoice settings not found' }, { ok: false, status: 404 }));

    const { result } = renderHook(() => useInvoiceSettings());

    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.settings).toBeNull();
  });
});
