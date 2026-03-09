import { useState, useEffect, useCallback } from 'react';
import type { Lesson, LessonFormData } from '../types/lesson';
import { LESSONS_STORAGE_KEY } from '../constants/storage';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadLessonsFromStorage(): Lesson[] {
  try {
    const raw = localStorage.getItem(LESSONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Lesson =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Lesson).id === 'string' &&
        typeof (item as Lesson).studentName === 'string' &&
        typeof (item as Lesson).date === 'string' &&
        typeof (item as Lesson).duration === 'number' &&
        typeof (item as Lesson).comment === 'string' &&
        typeof (item as Lesson).createdAt === 'number'
    );
  } catch {
    return [];
  }
}

function saveLessonsToStorage(lessons: Lesson[]): void {
  try {
    localStorage.setItem(LESSONS_STORAGE_KEY, JSON.stringify(lessons));
  } catch {
    // ignore quota or other storage errors
  }
}

/**
 * Custom hook for lesson list persisted in localStorage.
 * Returns lessons sorted by date (chronological, oldest first).
 */
export function useLessonStorage() {
  const [lessons, setLessons] = useState<Lesson[]>(() => loadLessonsFromStorage());

  useEffect(() => {
    saveLessonsToStorage(lessons);
  }, [lessons]);

  const addLesson = useCallback((formData: LessonFormData) => {
    const lesson: Lesson = {
      id: generateId(),
      studentName: formData.studentName.trim(),
      date: formData.date,
      duration: formData.duration,
      comment: formData.comment.trim(),
      createdAt: Date.now(),
    };
    setLessons((prev) => [...prev, lesson]);
  }, []);

  const deleteLesson = useCallback((id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const lessonsByDate = [...lessons].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return { lessons: lessonsByDate, addLesson, deleteLesson };
}
