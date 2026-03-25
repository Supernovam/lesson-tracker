import { useState, useEffect, useCallback } from 'react';
import type { Lesson, LessonFormData } from '../types/lesson';

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return b ? `${b}/${p}` : `/${p}`;
}

// In dev we rely on Vite's dev-server proxy (`server.proxy`) to forward `/api/*`
// to the local Express API.
const apiBaseFromEnv = (import.meta.env.VITE_API_BASE ?? '').trim();
const API_BASE = (() => {
  if (apiBaseFromEnv) return apiBaseFromEnv;
  if (import.meta.env.DEV) return '';

  const baseUrl = (import.meta.env.BASE_URL ?? '').trim();
  if (baseUrl) {
    console.warn(
      '[lesson-tracker] VITE_API_BASE is not set; falling back to same-origin API calls. ' +
        'Set VITE_API_BASE at build time to use the Render backend.'
    );
  }
  return baseUrl;
})();

async function fetchLessons(signal?: AbortSignal): Promise<Lesson[]> {
  const res = await fetch(joinUrl(API_BASE, '/api/lessons'), { signal });
  if (!res.ok) {
    throw new Error(`Failed to load lessons: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Lesson[];
}

/**
 * Custom hook for lesson list persisted in Neon Postgres.
 * Returns lessons sorted by date (chronological, oldest first).
 */
export function useLessonStorage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    fetchLessons(controller.signal)
      .then((data) => {
        if (isMounted) setLessons(data);
      })
      .catch((err) => {
        // Ignore cancellation triggered by unmount.
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

  const addLesson = useCallback(async (formData: LessonFormData) => {
    const payload = {
      studentName: formData.studentName.trim(),
      date: formData.date,
      duration: formData.duration,
      comment: formData.comment.trim(),
    };

    // Update state only after the API confirms the insert.
    const res = await fetch(joinUrl(API_BASE, '/api/lessons'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Server responds with JSON like: { error: "..." } but we fall back to raw text.
      let parsedError: string | undefined;
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.error === 'string') parsedError = parsed.error;
      } catch {
        // ignore JSON parse errors and fall back below
      }
      throw new Error(parsedError || text || `${res.status} ${res.statusText}`);
    }

    const lesson = (await res.json()) as Lesson;
    setLessons((prev) => [...prev, lesson]);
  }, []);

  const deleteLesson = useCallback((id: string) => {
    fetch(joinUrl(API_BASE, `/api/lessons/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    })
      .then((res) => {
        if (!res.ok && res.status !== 404) throw new Error(`${res.status} ${res.statusText}`);
      })
      .then(() => setLessons((prev) => prev.filter((l) => l.id !== id)))
      .catch((err) => {
        console.error('Failed to delete lesson:', err);
      });
  }, []);

  const lessonsByDate = [...lessons].sort(
    (a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      if (aTime !== bTime) return aTime - bTime; // chronological (oldest first)
      return a.createdAt - b.createdAt; // match server ordering for same-day lessons
    }
  );

  return { lessons: lessonsByDate, addLesson, deleteLesson };
}
