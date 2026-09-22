import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSchoolStorage } from './useSchoolStorage';
import { apiFetch } from '../api/config';

vi.mock('../api/config', () => ({ apiFetch: vi.fn() }));

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

const eastCampus = {
  id: 'school-east',
  title: 'East Campus',
  billingName: 'East Campus GmbH',
  address: 'Main St\n10115 Berlin',
  createdAt: 1,
  updatedAt: 1,
};

const formData = {
  title: '  East Campus  ',
  billingName: '  East Campus GmbH  ',
  address: '  Main St\n10115 Berlin  ',
};

describe('useSchoolStorage', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue(jsonResponse([]));
  });

  it('posts a trimmed title, billing name, and address when creating', async () => {
    const { result } = renderHook(() => useSchoolStorage());
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalled());

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(eastCampus));
    await act(async () => {
      await result.current.addSchool(formData);
    });

    const { calls } = mockedApiFetch.mock;
    const [url, options] = calls[calls.length - 1];
    expect(url).toBe('/api/schools');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({
      title: 'East Campus',
      billingName: 'East Campus GmbH',
      address: 'Main St\n10115 Berlin',
    });
    expect(result.current.schools).toHaveLength(1);
  });

  it('puts a trimmed title, billing name, and address when updating', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([eastCampus]));
    const { result } = renderHook(() => useSchoolStorage());
    await waitFor(() => expect(result.current.schools).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ ...eastCampus, updatedAt: 2 }));
    await act(async () => {
      await result.current.updateSchool('school-east', formData);
    });

    const { calls } = mockedApiFetch.mock;
    const [url, options] = calls[calls.length - 1];
    expect(url).toBe('/api/schools/school-east');
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(options?.body as string)).toEqual({
      title: 'East Campus',
      billingName: 'East Campus GmbH',
      address: 'Main St\n10115 Berlin',
    });
  });

  it('keeps a school that is still used by lessons and surfaces the reason', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([eastCampus]));
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

    await expect(result.current.deleteSchool('school-east')).rejects.toThrow(
      'This school is used by existing lessons and cannot be deleted'
    );
    expect(result.current.schools).toHaveLength(1);
  });
});
