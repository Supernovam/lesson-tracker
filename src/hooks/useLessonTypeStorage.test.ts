import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLessonTypeStorage } from './useLessonTypeStorage';
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

const privateCourse = {
  id: 'type-private',
  name: 'Private Course',
  basePrice: 19,
  baseDurationMinutes: 45,
  createdAt: 1,
  updatedAt: 1,
};

const formData = { name: '  Private Course  ', basePrice: 19, baseDurationMinutes: 45 };

describe('useLessonTypeStorage', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue(jsonResponse([]));
  });

  it('loads lesson types on mount', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([privateCourse]));

    const { result } = renderHook(() => useLessonTypeStorage());

    await waitFor(() => expect(result.current.lessonTypes).toHaveLength(1));
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/lesson-types', expect.anything());
  });

  it('returns types sorted by name', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse([
        { ...privateCourse, id: 'z', name: 'Zebra Course' },
        { ...privateCourse, id: 'a', name: 'Absolute Course' },
      ])
    );

    const { result } = renderHook(() => useLessonTypeStorage());

    await waitFor(() => expect(result.current.lessonTypes).toHaveLength(2));
    expect(result.current.lessonTypes.map((t) => t.name)).toEqual([
      'Absolute Course',
      'Zebra Course',
    ]);
  });

  it('posts a trimmed name when creating', async () => {
    const { result } = renderHook(() => useLessonTypeStorage());
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalled());

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(privateCourse));
    await act(async () => {
      await result.current.addLessonType(formData);
    });

    const { calls } = mockedApiFetch.mock;
    const [url, options] = calls[calls.length - 1];
    expect(url).toBe('/api/lesson-types');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({
      name: 'Private Course',
      basePrice: 19,
      baseDurationMinutes: 45,
    });
    expect(result.current.lessonTypes).toHaveLength(1);
  });

  it('reports a duplicate name from the server', async () => {
    const { result } = renderHook(() => useLessonTypeStorage());
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalled());

    mockedApiFetch.mockResolvedValueOnce(
      errorResponse(JSON.stringify({ error: 'A lesson type with this name already exists' }), 409)
    );

    await expect(result.current.addLessonType(formData)).rejects.toThrow(/already exists/);
    expect(result.current.lessonTypes).toHaveLength(0);
  });

  it('replaces the edited type via PUT', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([privateCourse]));
    const { result } = renderHook(() => useLessonTypeStorage());
    await waitFor(() => expect(result.current.lessonTypes).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({ ...privateCourse, basePrice: 25, updatedAt: 2 })
    );
    await act(async () => {
      await result.current.updateLessonType('type-private', { ...formData, basePrice: 25 });
    });

    const { calls } = mockedApiFetch.mock;
    const [url, options] = calls[calls.length - 1];
    expect(url).toBe('/api/lesson-types/type-private');
    expect(options?.method).toBe('PUT');
    expect(result.current.lessonTypes[0].basePrice).toBe(25);
    expect(result.current.lessonTypes).toHaveLength(1);
  });

  it('removes a deleted type', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([privateCourse]));
    const { result } = renderHook(() => useLessonTypeStorage());
    await waitFor(() => expect(result.current.lessonTypes).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(null, { status: 204 }));
    await act(async () => {
      await result.current.deleteLessonType('type-private');
    });

    expect(result.current.lessonTypes).toHaveLength(0);
  });

  it('keeps a type that is still used by lessons and surfaces the reason', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([privateCourse]));
    const { result } = renderHook(() => useLessonTypeStorage());
    await waitFor(() => expect(result.current.lessonTypes).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(
      errorResponse(
        JSON.stringify({
          error: 'This lesson type is used by existing lessons and cannot be deleted',
        }),
        409
      )
    );

    await expect(result.current.deleteLessonType('type-private')).rejects.toThrow(
      /used by existing lessons/
    );
    expect(result.current.lessonTypes).toHaveLength(1);
  });
});
