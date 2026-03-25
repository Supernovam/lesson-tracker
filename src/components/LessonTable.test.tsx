import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonTable } from './LessonTable';
import type { Lesson } from '../types/lesson';

const createLesson = (overrides: Partial<Lesson>): Lesson => ({
  id: crypto.randomUUID(),
  studentName: '',
  date: '2025-01-01',
  duration: 60,
  comment: '',
  createdAt: 0,
  ...overrides,
});

describe('LessonTable', () => {
  it('shows empty state when no lessons', () => {
    render(<LessonTable lessons={[]} onDelete={vi.fn()} />);
    expect(screen.getByRole('status', { name: /no lessons recorded/i })).toBeDefined();
    expect(screen.getByText(/no lessons yet/i)).toBeDefined();
  });

  it('renders lessons in original order by default', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Charlie', date: '2025-03-01' }),
      createLesson({ id: '2', studentName: 'Alice', date: '2025-01-15' }),
      createLesson({ id: '3', studentName: 'Bob', date: '2025-02-10' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Charlie');
    expect(rows[1].textContent).toContain('Alice');
    expect(rows[2].textContent).toContain('Bob');
  });

  it('sorts by student name ascending when Student header is clicked', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Charlie', date: '2025-01-01' }),
      createLesson({ id: '2', studentName: 'Alice', date: '2025-01-01' }),
      createLesson({ id: '3', studentName: 'Bob', date: '2025-01-01' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by student name/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('Alice');
    expect(rows[1].textContent).toContain('Bob');
    expect(rows[2].textContent).toContain('Charlie');
  });

  it('sorts by student name descending when Student header is clicked twice', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Charlie', date: '2025-01-01' }),
      createLesson({ id: '2', studentName: 'Alice', date: '2025-01-01' }),
      createLesson({ id: '3', studentName: 'Bob', date: '2025-01-01' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by student name/i }));
    fireEvent.click(screen.getByRole('button', { name: /sort by student name descending/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('Charlie');
    expect(rows[1].textContent).toContain('Bob');
    expect(rows[2].textContent).toContain('Alice');
  });

  it('sorts by date ascending when Date header is clicked', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Same', date: '2025-03-15' }),
      createLesson({ id: '2', studentName: 'Same', date: '2025-01-10' }),
      createLesson({ id: '3', studentName: 'Same', date: '2025-02-05' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by date/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('10.01.2025');
    expect(rows[1].textContent).toContain('05.02.2025');
    expect(rows[2].textContent).toContain('15.03.2025');
  });

  it('sorts by date descending when Date header is clicked twice', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Same', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Same', date: '2025-03-15' }),
      createLesson({ id: '3', studentName: 'Same', date: '2025-02-05' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by date/i }));
    fireEvent.click(screen.getByRole('button', { name: /sort by date descending/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('15.03.2025');
    expect(rows[1].textContent).toContain('05.02.2025');
    expect(rows[2].textContent).toContain('10.01.2025');
  });

  it('switches to date sort when Date is clicked after sorting by Student', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Charlie', date: '2025-03-15' }),
      createLesson({ id: '2', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '3', studentName: 'Bob', date: '2025-02-05' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by student name/i }));
    fireEvent.click(screen.getByRole('button', { name: /sort by date/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('10.01.2025');
    expect(rows[1].textContent).toContain('05.02.2025');
    expect(rows[2].textContent).toContain('15.03.2025');
  });

  it('maintains deterministic order when sort values are equal (stable sort)', () => {
    const lessons: Lesson[] = [
      createLesson({ id: 'z-third', studentName: 'Same', date: '2025-01-01', comment: 'C' }),
      createLesson({ id: 'a-first', studentName: 'Same', date: '2025-01-01', comment: 'A' }),
      createLesson({ id: 'm-second', studentName: 'Same', date: '2025-01-01', comment: 'B' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by student name/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('A');
    expect(rows[1].textContent).toContain('B');
    expect(rows[2].textContent).toContain('C');
  });

  it('exposes aria-sort on active sort column for assistive tech', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-01' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    const sortButton = screen.getByRole('button', { name: /sort by student name/i });
    fireEvent.click(sortButton);

    const headerCell = sortButton.closest('th');
    expect(headerCell?.getAttribute('aria-sort')).toBe('ascending');

    fireEvent.click(screen.getByRole('button', { name: /sort by student name descending/i }));
    expect(headerCell?.getAttribute('aria-sort')).toBe('descending');
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    const lessons: Lesson[] = [
      createLesson({ id: 'lesson-1', studentName: 'Alice', date: '2025-01-01' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /delete lesson for alice/i }));

    expect(onDelete).toHaveBeenCalledWith('lesson-1');
  });

  it('filters lessons by selected month', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2025-02-10' }),
      createLesson({ id: '3', studentName: 'Charlie', date: '2025-03-10' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/filter lessons by month/i), {
      target: { value: '1' },
    });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Bob');
  });

  it('shows full list when All is selected after month filter', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2025-02-10' }),
      createLesson({ id: '3', studentName: 'Charlie', date: '2025-03-10' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    const monthSelect = screen.getByLabelText(/filter lessons by month/i);
    fireEvent.change(monthSelect, { target: { value: '1' } });
    fireEvent.change(monthSelect, { target: { value: 'all' } });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Alice');
    expect(rows[1].textContent).toContain('Bob');
    expect(rows[2].textContent).toContain('Charlie');
  });

  it('shows empty filtered state when no lessons match selected month', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2025-02-10' }),
    ];

    render(<LessonTable lessons={lessons} onDelete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/filter lessons by month/i), {
      target: { value: '11' },
    });

    expect(screen.getByText(/no lessons found for the selected month/i)).toBeDefined();
  });
});
