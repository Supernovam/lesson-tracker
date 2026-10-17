import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSchoolStorage } from './useSchoolStorage';
import { apiFetch } from '../api/config';

// Only the network call is faked; error and abort helpers stay real.
vi.mock('../api/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/config')>()),
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return {
    ok: true,
    status: init.status ?? 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(body: string, status: number, statusText = 'Conflict') {
  return {
    ok: false,
    status,
    statusText,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response;
}

const alphaCampus = {
  id: 'school-alpha',
  title: 'Alpha Campus',
  billingName: 'Alpha Campus GmbH',
  address: 'Main St\n12345 Sampletown',
  createdAt: 1,
  updatedAt: 1,
};

const formData = {
  title: '  Alpha Campus  ',
  billingName: '  Alpha Campus GmbH  ',
  address: '  Main St\n12345 Sampletown  ',
};

describe('useSchoolStorage', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue(jsonResponse([]));
  });

  it('posts a trimmed title, billing name, and address when creating', async () => {
    const { result } = renderHook(() => useSchoolStorage());
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalled());

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(alphaCampus));
    await act(async () => {
      await result.current.addSchool(formData);
    });

    const { calls } = mockedApiFetch.mock;
    const [url, options] = calls[calls.length - 1];
    expect(url).toBe('/api/schools');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({
      title: 'Alpha Campus',
      billingName: 'Alpha Campus GmbH',
      address: 'Main St\n12345 Sampletown',
    });
    expect(result.current.schools).toHaveLength(1);
  });

  it('puts a trimmed title, billing name, and address when updating', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([alphaCampus]));
    const { result } = renderHook(() => useSchoolStorage());
    await waitFor(() => expect(result.current.schools).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ ...alphaCampus, updatedAt: 2 }));
    await act(async () => {
      await result.current.updateSchool('school-alpha', formData);
    });

    const { calls } = mockedApiFetch.mock;
    const [url, options] = calls[calls.length - 1];
    expect(url).toBe('/api/schools/school-alpha');
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(options?.body as string)).toEqual({
      title: 'Alpha Campus',
      billingName: 'Alpha Campus GmbH',
      address: 'Main St\n12345 Sampletown',
    });
  });

  it('keeps a school that is still used by lessons and surfaces the reason', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([alphaCampus]));
    const { result } = renderHook(() => useSchoolStorage());
    await waitFor(() => expect(result.current.schools).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(
      errorResponse(
        JSON.stringify({
          error: 'This school is used by existing lessons and cannot be deleted',
        }),
        409
      )
    );

    await expect(result.current.deleteSchool('school-alpha')).rejects.toThrow(
      'This school is used by existing lessons and cannot be deleted'
    );
    expect(result.current.schools).toHaveLength(1);
  });
});
