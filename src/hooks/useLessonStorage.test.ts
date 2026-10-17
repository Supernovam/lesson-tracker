import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLessonStorage } from './useLessonStorage';
import { apiFetch } from '../api/config';

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

function errorResponse(body: string, status: number, statusText = 'Bad Request') {
  return {
    ok: false,
    status,
    statusText,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response;
}

const lesson = {
  id: 'lesson-1',
  studentName: 'Alex',
  date: '2026-03-08',
  duration: 60,
  comment: '',
  createdAt: 10,
  lessonTypeId: 'type-private',
  lessonTypeName: 'Private Course',
  schoolId: 'school-alpha',
  schoolTitle: 'Alpha Campus',
  calculatedPrice: 37.33,
};

const formData = {
  studentName: '  Alex  ',
  date: '2026-03-08',
  duration: 60,
  comment: '  Good  ',
  lessonTypeId: '  type-private  ',
  schoolId: '  school-alpha  ',
};

describe('useLessonStorage', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiFetch.mockResolvedValue(jsonResponse([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads lessons on mount', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([lesson]));

    const { result } = renderHook(() => useLessonStorage());

    await waitFor(() => expect(result.current.lessons).toHaveLength(1));
    expect(result.current.lessons[0].calculatedPrice).toBe(37.33);
    expect(result.current.status).toBe('ready');
  });

  it('starts in a loading state until lessons arrive', async () => {
    let resolveLessons: ((value: Response) => void) | undefined;
    mockedApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLessons = resolve;
      })
    );

    const { result } = renderHook(() => useLessonStorage());
    expect(result.current.status).toBe('loading');
    expect(result.current.lessons).toEqual([]);

    await act(async () => {
      resolveLessons?.(jsonResponse([lesson]));
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.lessons).toHaveLength(1);
  });

  it('sends the trimmed lesson type id when creating a lesson', async () => {
    const { result } = renderHook(() => useLessonStorage());
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalled());

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(lesson));
    await act(async () => {
      await result.current.addLesson(formData);
    });

    const { calls } = mockedApiFetch.mock;
    const [url, options] = calls[calls.length - 1];
    expect(url).toBe('/api/lessons');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({
      studentName: 'Alex',
      date: '2026-03-08',
      duration: 60,
      comment: 'Good',
      lessonTypeId: 'type-private',
      schoolId: 'school-alpha',
    });
  });

  it('adds the server-priced lesson to state rather than the local form data', async () => {
    const { result } = renderHook(() => useLessonStorage());
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalled());

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(lesson));
    await act(async () => {
      await result.current.addLesson(formData);
    });

    expect(result.current.lessons).toHaveLength(1);
    expect(result.current.lessons[0]).toMatchObject({
      lessonTypeName: 'Private Course',
      calculatedPrice: 37.33,
    });
  });

  it('surfaces the server error message and keeps state unchanged', async () => {
    const { result } = renderHook(() => useLessonStorage());
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalled());

    mockedApiFetch.mockResolvedValueOnce(
      errorResponse(JSON.stringify({ error: 'lessonTypeId is invalid' }), 400)
    );

    await expect(result.current.addLesson(formData)).rejects.toThrow('lessonTypeId is invalid');
    expect(result.current.lessons).toHaveLength(0);
  });

  it('sorts lessons chronologically, oldest first', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse([
        { ...lesson, id: 'b', date: '2026-03-10' },
        { ...lesson, id: 'a', date: '2026-03-01' },
      ])
    );

    const { result } = renderHook(() => useLessonStorage());

    await waitFor(() => expect(result.current.lessons).toHaveLength(2));
    expect(result.current.lessons.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('replaces the edited lesson via PUT and keeps the server price', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([lesson]));
    const { result } = renderHook(() => useLessonStorage());
    await waitFor(() => expect(result.current.lessons).toHaveLength(1));

    const updated = { ...lesson, studentName: 'Alex B', duration: 90, calculatedPrice: 56 };
    mockedApiFetch.mockResolvedValueOnce(jsonResponse(updated));
    await act(async () => {
      await result.current.updateLesson('lesson-1', { ...formData, studentName: 'Alex B', duration: 90 });
    });

    const { calls } = mockedApiFetch.mock;
    const [url, options] = calls[calls.length - 1];
    expect(url).toBe('/api/lessons/lesson-1');
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(options?.body as string)).toMatchObject({
      studentName: 'Alex B',
      duration: 90,
      lessonTypeId: 'type-private',
      schoolId: 'school-alpha',
    });
    expect(result.current.lessons).toHaveLength(1);
    expect(result.current.lessons[0]).toMatchObject({ studentName: 'Alex B', calculatedPrice: 56 });
  });

  it('keeps the existing lesson when an update fails', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([lesson]));
    const { result } = renderHook(() => useLessonStorage());
    await waitFor(() => expect(result.current.lessons).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(
      errorResponse(JSON.stringify({ error: 'lesson not found' }), 404, 'Not Found')
    );

    await expect(result.current.updateLesson('lesson-1', formData)).rejects.toThrow('lesson not found');
    expect(result.current.lessons[0].studentName).toBe('Alex');
  });

  it('removes a lesson after a successful delete', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([lesson]));
    const { result } = renderHook(() => useLessonStorage());
    await waitFor(() => expect(result.current.lessons).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(null, { status: 204 }));
    await act(async () => {
      await result.current.deleteLesson('lesson-1');
    });

    expect(result.current.lessons).toHaveLength(0);
    expect(mockedApiFetch).toHaveBeenLastCalledWith('/api/lessons/lesson-1', { method: 'DELETE' });
  });

  it('keeps the lesson and reports the server error when delete fails', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([lesson]));
    const { result } = renderHook(() => useLessonStorage());
    await waitFor(() => expect(result.current.lessons).toHaveLength(1));

    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'failed to delete lesson' }, { ok: false, status: 500 })
    );

    await expect(result.current.deleteLesson('lesson-1')).rejects.toThrow('failed to delete lesson');
    expect(result.current.lessons).toHaveLength(1);
  });
});
