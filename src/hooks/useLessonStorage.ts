import { useState, useEffect, useCallback } from 'react';
import type { Lesson, LessonFormData } from '../types/lesson';
import { apiFetch, errorFromResponse, isAbortError } from '../api/config';

async function fetchLessons(signal?: AbortSignal): Promise<Lesson[]> {
  const res = await apiFetch('/api/lessons', { signal });
  if (!res.ok) {
    throw new Error(`Failed to load lessons: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Lesson[];
}

function toPayload(formData: LessonFormData) {
  return {
    studentName: formData.studentName.trim(),
    date: formData.date,
    duration: formData.duration,
    comment: formData.comment.trim(),
    lessonTypeId: formData.lessonTypeId.trim(),
    schoolId: formData.schoolId.trim(),
  };
}

/**
 * Custom hook for lesson list persisted in Neon Postgres.
 * Returns lessons sorted by date (chronological, oldest first).
 */
export type LessonStorageStatus = 'loading' | 'ready' | 'error';

export function useLessonStorage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [status, setStatus] = useState<LessonStorageStatus>('loading');

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    fetchLessons(controller.signal)
      .then((data) => {
        if (!isMounted) return;
        setLessons(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        console.error(err);
        if (isMounted) setStatus('error');
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const addLesson = useCallback(async (formData: LessonFormData) => {
    // Update state only after the API confirms the insert.
    const res = await apiFetch('/api/lessons', {
      method: 'POST',
      body: JSON.stringify(toPayload(formData)),
    });

    if (!res.ok) {
      throw await errorFromResponse(res);
    }

    const lesson = (await res.json()) as Lesson;
    setLessons((prev) => [...prev, lesson]);
  }, []);

  const updateLesson = useCallback(async (id: string, formData: LessonFormData) => {
    const res = await apiFetch(`/api/lessons/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(toPayload(formData)),
    });

    if (!res.ok) {
      throw await errorFromResponse(res);
    }

    const lesson = (await res.json()) as Lesson;
    setLessons((prev) => prev.map((item) => (item.id === id ? lesson : item)));
  }, []);

  const deleteLesson = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/lessons/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    // The API answers 204 even for an id that is already gone; a 404 is treated the same way.
    if (!res.ok && res.status !== 404) {
      throw await errorFromResponse(res);
    }
    setLessons((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const lessonsByDate = [...lessons].sort(
    (a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      if (aTime !== bTime) return aTime - bTime; // chronological (oldest first)
      return a.createdAt - b.createdAt; // match server ordering for same-day lessons
    }
  );

  return { lessons: lessonsByDate, status, addLesson, updateLesson, deleteLesson };
}
