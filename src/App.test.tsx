import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'teacher@example.com', name: 'Teacher', picture: '' },
    status: 'authenticated',
    error: null,
    logout: vi.fn(),
  }),
}));

vi.mock('./hooks/useLessonStorage', () => ({
  useLessonStorage: () => ({
    lessons: [],
    addLesson: vi.fn(),
    deleteLesson: vi.fn(),
  }),
}));

vi.mock('./hooks/useLessonTypeStorage', () => ({
  useLessonTypeStorage: () => ({
    lessonTypes: [],
    addLessonType: vi.fn(),
    updateLessonType: vi.fn(),
    deleteLessonType: vi.fn(),
  }),
}));

describe('App pages', () => {
  it('starts on the Lessons page and can switch to Lesson Types', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /log a lesson/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /lesson history/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /lesson types/i }));

    expect(screen.getByRole('heading', { name: /add a lesson type/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /^lesson types$/i })).toBeDefined();
  });
});
