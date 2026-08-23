import { useState, useEffect, useCallback } from 'react';
import type { LessonType, LessonTypeFormData } from '../types/lessonType';
import { apiFetch } from '../api/config';

async function fetchLessonTypes(signal?: AbortSignal): Promise<LessonType[]> {
  const res = await apiFetch('/api/lesson-types', { signal });
  if (!res.ok) {
    throw new Error(`Failed to load lesson types: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as LessonType[];
}

function errorFromResponse(text: string, status: number, statusText: string): Error {
  let parsedError: string | undefined;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.error === 'string') parsedError = parsed.error;
  } catch {
    // ignore JSON parse errors and fall back below
  }
  return new Error(parsedError || text || `${status} ${statusText}`);
}

function toPayload(formData: LessonTypeFormData) {
  return {
    name: formData.name.trim(),
    basePrice: formData.basePrice,
    baseDurationMinutes: formData.baseDurationMinutes,
  };
}

/**
 * Custom hook for lesson types persisted in Neon Postgres.
 * Returns types sorted by name.
 */
export function useLessonTypeStorage() {
  const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    fetchLessonTypes(controller.signal)
      .then((data) => {
        if (isMounted) setLessonTypes(data);
      })
      .catch((err) => {
        const maybeName =
          err instanceof Error
            ? err.name
            : typeof err === 'object' && err !== null && 'name' in err
              ? (err as { name?: unknown }).name
              : undefined;
        if (maybeName === 'AbortError') return;
        console.error(err);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const addLessonType = useCallback(async (formData: LessonTypeFormData) => {
    const res = await apiFetch('/api/lesson-types', {
      method: 'POST',
      body: JSON.stringify(toPayload(formData)),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw errorFromResponse(text, res.status, res.statusText);
    }

    const lessonType = (await res.json()) as LessonType;
    setLessonTypes((prev) => [...prev, lessonType]);
  }, []);

  const updateLessonType = useCallback(async (id: string, formData: LessonTypeFormData) => {
    const res = await apiFetch(`/api/lesson-types/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(toPayload(formData)),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw errorFromResponse(text, res.status, res.statusText);
    }

    const lessonType = (await res.json()) as LessonType;
    setLessonTypes((prev) => prev.map((item) => (item.id === id ? lessonType : item)));
  }, []);

  const deleteLessonType = useCallback((id: string) => {
    apiFetch(`/api/lesson-types/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
      .then((res) => {
        if (!res.ok && res.status !== 404) throw new Error(`${res.status} ${res.statusText}`);
      })
      .then(() => setLessonTypes((prev) => prev.filter((item) => item.id !== id)))
      .catch((err) => {
        console.error('Failed to delete lesson type:', err);
      });
  }, []);

  const lessonTypesByName = [...lessonTypes].sort((a, b) => a.name.localeCompare(b.name));

  return {
    lessonTypes: lessonTypesByName,
    addLessonType,
    updateLessonType,
    deleteLessonType,
  };
}
