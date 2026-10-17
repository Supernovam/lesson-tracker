import { useState, useEffect, useCallback } from 'react';
import type { LessonType, LessonTypeFormData } from '../types/lessonType';
import { apiFetch, errorFromResponse, isAbortError } from '../api/config';

async function fetchLessonTypes(signal?: AbortSignal): Promise<LessonType[]> {
  const res = await apiFetch('/api/lesson-types', { signal });
  if (!res.ok) {
    throw new Error(`Failed to load lesson types: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as LessonType[];
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
        if (isAbortError(err)) return;
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
      throw await errorFromResponse(res);
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
      throw await errorFromResponse(res);
    }

    const lessonType = (await res.json()) as LessonType;
    setLessonTypes((prev) => prev.map((item) => (item.id === id ? lessonType : item)));
  }, []);

  const deleteLessonType = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/lesson-types/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.status === 404) {
      setLessonTypes((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    if (!res.ok) {
      throw await errorFromResponse(res);
    }
    setLessonTypes((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const lessonTypesByName = [...lessonTypes].sort((a, b) => a.name.localeCompare(b.name));

  return {
    lessonTypes: lessonTypesByName,
    addLessonType,
    updateLessonType,
    deleteLessonType,
  };
}
