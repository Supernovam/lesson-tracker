import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useIssuedInvoices } from './useIssuedInvoices';
import { apiFetch } from '../api/config';

vi.mock('../api/config', () => ({
  apiFetch: vi.fn(),
  isAbortError: (err: unknown) =>
    Boolean(err && typeof err === 'object' && 'name' in err && err.name === 'AbortError'),
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

const period = { from: '2026-09-01', to: '2026-09-30' };
const eastIssued = { schoolId: 'school-east', ...period, year: 2026, number: 10, issuedOn: '2026-10-17' };

describe('useIssuedInvoices', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it('loads issued numbers for the period and year', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ invoices: [eastIssued], nextNumber: 11 }));

    const { result } = renderHook(() => useIssuedInvoices(period.from, period.to, 2026));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.invoices).toEqual([eastIssued]);
    expect(result.current.nextNumber).toBe(11);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/issued-invoices?from=2026-09-01&to=2026-09-30&year=2026',
      expect.any(Object)
    );
  });

  it('issues numbers and advances nextNumber without refetching', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ invoices: [], nextNumber: 10 }));
    const { result } = renderHook(() => useIssuedInvoices(period.from, period.to, 2026));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const westIssued = { ...eastIssued, schoolId: 'school-west', number: 11 };
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([eastIssued, westIssued], { status: 201 }));

    let issued;
    await act(async () => {
      issued = await result.current.issue(['school-east', 'school-west'], '2026-10-17');
    });

    expect(issued).toEqual([eastIssued, westIssued]);
    expect(mockedApiFetch).toHaveBeenLastCalledWith('/api/issued-invoices', {
      method: 'POST',
      body: JSON.stringify({ ...period, issuedOn: '2026-10-17', schoolIds: ['school-east', 'school-west'] }),
    });
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
    expect(result.current.invoices).toEqual([eastIssued, westIssued]);
    expect(result.current.nextNumber).toBe(12);
  });

  it('surfaces the API error when issuing fails', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ invoices: [], nextNumber: 1 }));
    const { result } = renderHook(() => useIssuedInvoices(period.from, period.to, 2026));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ error: 'Unknown school' }, { ok: false, status: 400 }));

    await expect(result.current.issue(['school-gone'], '2026-10-17')).rejects.toThrow('Unknown school');
    expect(result.current.nextNumber).toBe(1);
  });

  it('reports an error state when loading fails', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, { ok: false, status: 500 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useIssuedInvoices(period.from, period.to, 2026));

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
