import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonsPage } from './LessonsPage';
import type { Lesson } from '../types/lesson';
import type { LessonType } from '../types/lessonType';
import type { School } from '../types/school';

const { lesson, lessonType, school, updateLesson, addLesson, deleteLesson } = vi.hoisted(() => {
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
    billingName: 'East Campus GmbH',
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
    deleteLesson: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../hooks/useLessonStorage', () => ({
  useLessonStorage: () => ({
    lessons: [lesson],
    addLesson,
    updateLesson,
    deleteLesson,
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
    deleteLesson.mockReset().mockResolvedValue(undefined);
    window.localStorage.setItem(
      'lesson-tracker:lesson-filters',
      JSON.stringify({ period: { from: '2026-09-01', to: '2026-09-30' } })
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('loads the selected lesson into the form and saves the edit', async () => {
    render(<LessonsPage />);

    fireEvent.change(screen.getByLabelText(/lesson filter end date/i), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText(/lesson filter start date/i), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: /edit lesson for alex/i }));

    expect(screen.getByRole('heading', { name: /edit lesson/i })).toBeDefined();
    const studentName = screen.getByRole('textbox', { name: /^student name/i }) as HTMLInputElement;
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

  it('asks before deleting a lesson and does nothing when cancelled', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<LessonsPage />);

    fireEvent.click(screen.getByRole('button', { name: /delete lesson for alex/i }));

    expect(confirm).toHaveBeenCalledWith('Delete the lesson for Alex on 21.09.2026? This cannot be undone.');
    expect(deleteLesson).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('deletes after confirming and shows an error if it fails', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteLesson.mockRejectedValueOnce(new Error('failed to delete lesson'));
    render(<LessonsPage />);

    fireEvent.click(screen.getByRole('button', { name: /delete lesson for alex/i }));

    expect(deleteLesson).toHaveBeenCalledWith('lesson-1');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not delete the lesson: failed to delete lesson'
    );
    confirm.mockRestore();
  });

  it('closes the edit form when the lesson being edited is deleted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LessonsPage />);

    fireEvent.click(screen.getByRole('button', { name: /edit lesson for alex/i }));
    expect(screen.getByRole('heading', { name: /edit lesson/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /delete lesson for alex/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: /log a lesson/i })).toBeDefined());
    confirm.mockRestore();
  });

  it('clears a failed-delete message after the next successful save', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteLesson.mockRejectedValueOnce(new Error('failed to delete lesson'));
    render(<LessonsPage />);
    fireEvent.click(screen.getByRole('button', { name: /delete lesson for alex/i }));
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: /edit lesson for alex/i }));
    fireEvent.click(screen.getByRole('button', { name: /update lesson/i }));

    await waitFor(() => expect(screen.queryByText(/could not delete the lesson/i)).toBeNull());
    confirm.mockRestore();
  });
});
