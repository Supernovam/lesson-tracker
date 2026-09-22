import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonsPage } from './LessonsPage';
import type { Lesson } from '../types/lesson';
import type { LessonType } from '../types/lessonType';
import type { School } from '../types/school';

const { lesson, lessonType, school, updateLesson, addLesson } = vi.hoisted(() => {
  const lesson: Lesson = {
    id: 'lesson-1',
    studentName: 'Alex',
    date: '2026-09-21',
    duration: 60,
    comment: 'Went well',
    createdAt: 1,
    lessonTypeId: 'private',
    lessonTypeName: 'Private Course',
    schoolId: 'east',
    schoolTitle: 'East Campus',
    calculatedPrice: 25.33,
  };
  const school: School = {
    id: 'east',
    title: 'East Campus',
    address: 'Main St',
    createdAt: 1,
    updatedAt: 1,
  };
  const lessonType: LessonType = {
    id: 'private',
    name: 'Private Course',
    basePrice: 19,
    baseDurationMinutes: 45,
    createdAt: 1,
    updatedAt: 1,
  };
  return {
    lesson,
    lessonType,
    school,
    addLesson: vi.fn().mockResolvedValue(undefined),
    updateLesson: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../hooks/useLessonStorage', () => ({
  useLessonStorage: () => ({
    lessons: [lesson],
    addLesson,
    updateLesson,
    deleteLesson: vi.fn(),
  }),
}));

vi.mock('../hooks/useLessonTypeStorage', () => ({
  useLessonTypeStorage: () => ({
    lessonTypes: [lessonType],
  }),
}));

vi.mock('../hooks/useSchoolStorage', () => ({
  useSchoolStorage: () => ({
    schools: [school],
  }),
}));

describe('LessonsPage', () => {
  beforeEach(() => {
    addLesson.mockClear();
    updateLesson.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('loads the selected lesson into the form and saves the edit', async () => {
    render(<LessonsPage />);

    fireEvent.change(screen.getByLabelText(/filter lessons by month/i), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: /edit lesson for alex/i }));

    expect(screen.getByRole('heading', { name: /edit lesson/i })).toBeDefined();
    const studentName = screen.getByRole('textbox', { name: /^student name$/i }) as HTMLInputElement;
    expect(studentName.value).toBe('Alex');

    fireEvent.change(studentName, { target: { value: 'Alex B' } });
    fireEvent.click(screen.getByRole('button', { name: /update lesson/i }));

    await waitFor(() => expect(updateLesson).toHaveBeenCalledTimes(1));
    expect(updateLesson).toHaveBeenCalledWith(
      'lesson-1',
      expect.objectContaining({
        studentName: 'Alex B',
        lessonTypeId: 'private',
        schoolId: 'east',
        duration: 60,
        comment: 'Went well',
      })
    );
    expect(addLesson).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /log a lesson/i })).toBeDefined();
  });
});
