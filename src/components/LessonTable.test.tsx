import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonTable } from './LessonTable';
import type { Lesson } from '../types/lesson';
import type { School } from '../types/school';

const SCHOOLS: School[] = [
  { id: 'school-east', title: 'East', billingName: 'East GmbH', address: 'A', createdAt: 1, updatedAt: 1 },
  { id: 'school-west', title: 'West', billingName: 'West GmbH', address: 'B', createdAt: 1, updatedAt: 1 },
];
const FILTER_STORAGE_KEY = 'lesson-tracker:lesson-filters';

const fromInput = () => screen.getByLabelText(/lesson filter start date/i) as HTMLInputElement;
const toInput = () => screen.getByLabelText(/lesson filter end date/i) as HTMLInputElement;
const schoolSelect = () => screen.getByLabelText(/filter lessons by school/i) as HTMLSelectElement;

/** Widens the range first so From never gets clamped against the old To. */
const setRange = (from: string, to: string) => {
  fireEvent.change(toInput(), { target: { value: '2099-12-31' } });
  fireEvent.change(fromInput(), { target: { value: from } });
  fireEvent.change(toInput(), { target: { value: to } });
};
const showWholeYear = () => setRange('2025-01-01', '2025-12-31');
const selectSchool = (value: string) => fireEvent.change(schoolSelect(), { target: { value } });
const dataRows = () => screen.getAllByRole('row').slice(1);

const createLesson = (overrides: Partial<Lesson>): Lesson => ({
  id: crypto.randomUUID(),
  studentName: '',
  date: '2025-01-01',
  duration: 60,
  comment: '',
  createdAt: 0,
  lessonTypeId: null,
  lessonTypeName: null,
  schoolId: null,
  schoolTitle: null,
  calculatedPrice: null,
  ...overrides,
});

describe('LessonTable', () => {
  // The table opens on the current month, so tests pin "today" to January 2025.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('shows empty state when no lessons', () => {
    render(<LessonTable schools={SCHOOLS} lessons={[]} onDelete={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole('status', { name: /no lessons recorded/i })).toBeDefined();
    expect(screen.getByText(/no lessons yet/i)).toBeDefined();
  });

  it('opens on the current month', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Charlie', date: '2025-03-01' }),
      createLesson({ id: '2', studentName: 'Alice', date: '2025-01-20' }),
      createLesson({ id: '3', studentName: 'Bob', date: '2025-02-10' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    expect(fromInput().value).toBe('2025-01-01');
    expect(toInput().value).toBe('2025-01-31');
    expect(schoolSelect().value).toBe('all');

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Alice');
  });

  it('renders lessons in original order by default', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Charlie', date: '2025-03-01' }),
      createLesson({ id: '2', studentName: 'Alice', date: '2025-01-15' }),
      createLesson({ id: '3', studentName: 'Bob', date: '2025-02-10' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    showWholeYear();

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

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

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

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by student name/i }));
    fireEvent.click(screen.getByRole('button', { name: /sort by student name descending/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('Charlie');
    expect(rows[1].textContent).toContain('Bob');
    expect(rows[2].textContent).toContain('Alice');
  });

  it('sorts by school ascending, with lessons that have no school first', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Cara', date: '2025-01-01', schoolTitle: 'West' }),
      createLesson({ id: '2', studentName: 'Amy', date: '2025-01-02', schoolTitle: null }),
      createLesson({ id: '3', studentName: 'Ben', date: '2025-01-03', schoolTitle: 'East' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by school ascending/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Amy'),
      expect.stringContaining('Ben'),
      expect.stringContaining('Cara'),
    ]);
  });

  it('sorts by school descending when the School header is clicked twice', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Cara', date: '2025-01-01', schoolTitle: 'West' }),
      createLesson({ id: '2', studentName: 'Amy', date: '2025-01-02', schoolTitle: 'East' }),
      createLesson({ id: '3', studentName: 'Ben', date: '2025-01-03', schoolTitle: 'North' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sort by school ascending/i }));
    fireEvent.click(screen.getByRole('button', { name: /sort by school descending/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('Cara');
    expect(rows[1].textContent).toContain('Ben');
    expect(rows[2].textContent).toContain('Amy');
  });

  it('sorts by date ascending when Date header is clicked', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Same', date: '2025-03-15' }),
      createLesson({ id: '2', studentName: 'Same', date: '2025-01-10' }),
      createLesson({ id: '3', studentName: 'Same', date: '2025-02-05' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    showWholeYear();

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

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    showWholeYear();

    fireEvent.click(screen.getByRole('button', { name: /sort by date/i }));
    fireEvent.click(screen.getByRole('button', { name: /sort by date descending/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('15.03.2025');
    expect(rows[1].textContent).toContain('05.02.2025');
    expect(rows[2].textContent).toContain('10.01.2025');
  });

  it('preserves Student sort state when Date is activated (both columns stay active)', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Charlie', date: '2025-03-15' }),
      createLesson({ id: '2', studentName: 'Alice', date: '2025-01-10' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    showWholeYear();

    fireEvent.click(screen.getByRole('button', { name: /sort by student name ascending/i }));
    const studentButton = screen.getByRole('button', { name: /sort by student name descending/i });
    const studentTh = studentButton.closest('th');
    expect(studentTh?.getAttribute('aria-sort')).toBe('ascending');

    fireEvent.click(screen.getByRole('button', { name: /sort by date ascending/i }));
    expect(studentTh?.getAttribute('aria-sort')).toBe('ascending');
    const dateTh = screen.getByRole('button', { name: /sort by date descending/i }).closest('th');
    expect(dateTh?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('switches to date sort when Date is clicked after sorting by Student', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Charlie', date: '2025-03-15' }),
      createLesson({ id: '2', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '3', studentName: 'Bob', date: '2025-02-05' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    showWholeYear();

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

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

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

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

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

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onEdit={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /delete lesson for alice/i }));

    expect(onDelete).toHaveBeenCalledWith('lesson-1');
  });

  it('calls onEdit with the lesson when the edit button is clicked', () => {
    const onEdit = vi.fn();
    const lessons: Lesson[] = [
      createLesson({ id: 'lesson-1', studentName: 'Alice', date: '2025-01-01' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onEdit={onEdit} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /edit lesson for alice/i }));

    expect(onEdit).toHaveBeenCalledWith(lessons[0]);
  });

  it('shows lesson type and school before student name, with cost and no page total', () => {
    const lessons: Lesson[] = [
      createLesson({
        id: '1',
        studentName: 'Alice',
        date: '2025-01-10',
        lessonTypeName: 'Private Course',
        schoolTitle: 'East Campus',
        calculatedPrice: 25.33,
      }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    const headerCells = screen.getAllByRole('columnheader');
    expect(headerCells[0].textContent).toMatch(/type/i);
    expect(headerCells[1].textContent).toMatch(/school/i);
    expect(headerCells[2].textContent).toMatch(/student/i);

    const dataRow = screen.getAllByRole('row')[1];
    const cells = dataRow.querySelectorAll('td');
    expect(cells[0].textContent).toBe('Private Course');
    expect(cells[1].textContent).toBe('East Campus');
    expect(cells[2].textContent).toBe('Alice');
    expect(screen.getByText(/^25,33\s€$/)).toBeDefined();
    expect(screen.queryByText(/^Total:/)).toBeNull();
  });

  it('filters lessons by the From/To range, across months', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2025-02-10' }),
      createLesson({ id: '3', studentName: 'Charlie', date: '2025-03-10' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    setRange('2025-01-05', '2025-02-15');

    expect(dataRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Alice'),
      expect.stringContaining('Bob'),
    ]);
  });

  it('does not allow From to be set after To', () => {
    render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    fireEvent.change(fromInput(), { target: { value: '2025-03-01' } });

    expect(fromInput().value).toBe('2025-01-31');
  });

  it('ignores a year that is still being typed and does not save it', () => {
    render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1', studentName: 'Kim', date: '2025-01-10' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    for (const partial of ['0002-01-31', '0020-01-31', '0202-01-31']) {
      fireEvent.change(toInput(), { target: { value: partial } });
      expect(toInput().value).toBe('2025-01-31');
    }
    expect(window.localStorage.getItem(FILTER_STORAGE_KEY)).toBeNull();

    fireEvent.change(toInput(), { target: { value: '2025-02-28' } });
    expect(toInput().value).toBe('2025-02-28');
  });

  it('does not remember a range that equals the current month', () => {
    render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    setRange('2025-01-01', '2025-01-31');

    expect(JSON.parse(window.localStorage.getItem(FILTER_STORAGE_KEY) ?? '{}').period).toBeUndefined();
  });

  it('keeps the last valid range when a date field is cleared', () => {
    render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );
    setRange('2025-01-05', '2025-01-20');

    fireEvent.change(fromInput(), { target: { value: '' } });

    expect(fromInput().value).toBe('2025-01-05');
    expect(dataRows()[0].textContent).toContain('Alice');
    expect(JSON.parse(window.localStorage.getItem(FILTER_STORAGE_KEY) ?? '{}').period).toEqual({
      from: '2025-01-05',
      to: '2025-01-20',
    });
  });

  it('sorts lessons without a student name last in both directions', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: '', date: '2025-01-01' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2025-01-02' }),
      createLesson({ id: '3', studentName: 'Amy', date: '2025-01-03' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    const studentCells = () => dataRows().map((row) => row.querySelectorAll('td')[2].textContent);

    fireEvent.click(screen.getByRole('button', { name: /sort by student name ascending/i }));
    expect(studentCells()).toEqual(['Amy', 'Bob', '—']);

    fireEvent.click(screen.getByRole('button', { name: /sort by student name descending/i }));
    expect(studentCells()).toEqual(['Bob', 'Amy', '—']);
  });

  it('Current month returns to the calendar month and forgets the saved range', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2024-10-10' }),
    ];
    const { unmount } = render(
      <LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />
    );
    const currentMonthButton = () => screen.getByRole('button', { name: 'Current month' }) as HTMLButtonElement;
    expect(currentMonthButton().disabled).toBe(true);

    setRange('2024-10-01', '2024-10-31');
    selectSchool('school-east');
    expect(currentMonthButton().disabled).toBe(false);

    fireEvent.click(currentMonthButton());
    expect(fromInput().value).toBe('2025-01-01');
    expect(toInput().value).toBe('2025-01-31');
    unmount();

    vi.setSystemTime(new Date('2025-03-05T12:00:00Z'));
    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    expect(fromInput().value).toBe('2025-03-01');
    expect(schoolSelect().value).toBe('school-east');
  });

  it('All dates shows every lesson, stays on across visits, and includes later lessons', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2023-06-01' }),
    ];
    const { unmount } = render(
      <LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'All dates' }));

    expect(dataRows()).toHaveLength(2);
    expect(fromInput().value).toBe('2023-06-01');
    expect(toInput().value).toBe('2025-01-10');
    expect(screen.getByRole('button', { name: 'All dates' }).getAttribute('aria-pressed')).toBe('true');
    unmount();

    const later = [...lessons, createLesson({ id: '3', studentName: 'Cleo', date: '2026-04-01' })];
    render(<LessonTable schools={SCHOOLS} lessons={later} onDelete={vi.fn()} onEdit={vi.fn()} />);
    expect(dataRows()).toHaveLength(3);
    expect(toInput().value).toBe('2026-04-01');
  });

  it('shows all past lessons of the selected school when switching from Current month to All dates', () => {
    vi.setSystemTime(new Date('2031-06-15T12:00:00Z'));
    const lessons: Lesson[] = [
      createLesson({ id: 'w1', studentName: 'Wanda', date: '2030-02-14', schoolId: 'school-west', schoolTitle: 'West' }),
      createLesson({ id: 'w2', studentName: 'Walt', date: '2031-03-09', schoolId: 'school-west', schoolTitle: 'West' }),
      createLesson({ id: 'e1', studentName: 'Eve', date: '2031-06-07', schoolId: 'school-east', schoolTitle: 'East' }),
      createLesson({ id: 'n1', studentName: 'Nobody', date: '2030-07-19' }),
    ];
    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    selectSchool('school-west');
    expect(screen.getByText(/no lessons found for the selected filters/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'All dates' }));
    expect(dataRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Wanda'),
      expect.stringContaining('Walt'),
    ]);

    setRange('2030-02-01', '2031-06-30');
    expect(dataRows()).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Current month' }));
    expect(screen.getByText(/no lessons found for the selected filters/i)).toBeDefined();
  });

  it('leaves All dates when a date is edited', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2023-06-01' }),
    ];
    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'All dates' }));

    fireEvent.change(fromInput(), { target: { value: '2024-01-01' } });

    expect(screen.getByRole('button', { name: 'All dates' }).getAttribute('aria-pressed')).toBe('false');
    expect(dataRows().map((row) => row.textContent)).toEqual([expect.stringContaining('Alice')]);
  });

  it('filters lessons by school', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10', schoolId: 'school-east', schoolTitle: 'East' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2025-01-11', schoolId: 'school-west', schoolTitle: 'West' }),
      createLesson({ id: '3', studentName: 'Cleo', date: '2025-01-12' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    expect(dataRows()).toHaveLength(3);
    expect([...schoolSelect().options].map((option) => option.textContent)).toEqual(['All schools', 'East', 'West']);

    selectSchool('school-west');
    expect(dataRows().map((row) => row.textContent)).toEqual([expect.stringContaining('Bob')]);

    selectSchool('all');
    expect(dataRows()).toHaveLength(3);
  });

  it('remembers a changed range and school for the next visit', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10', schoolId: 'school-east' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2024-12-20', schoolId: 'school-west' }),
    ];

    const { unmount } = render(
      <LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />
    );
    setRange('2024-12-01', '2024-12-31');
    selectSchool('school-west');
    unmount();

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    expect(fromInput().value).toBe('2024-12-01');
    expect(toInput().value).toBe('2024-12-31');
    expect(schoolSelect().value).toBe('school-west');
    expect(dataRows().map((row) => row.textContent)).toEqual([expect.stringContaining('Bob')]);
  });

  it('keeps the current-month default until the user changes a filter', () => {
    const { unmount } = render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );
    unmount();

    expect(window.localStorage.getItem(FILTER_STORAGE_KEY)).toBeNull();

    vi.setSystemTime(new Date('2025-02-03T12:00:00Z'));
    render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );
    expect(fromInput().value).toBe('2025-02-01');
    expect(toInput().value).toBe('2025-02-28');
  });

  it('remembers only the school when only the school was changed', () => {
    const { unmount } = render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );
    selectSchool('school-east');
    unmount();

    vi.setSystemTime(new Date('2025-02-03T12:00:00Z'));
    render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(schoolSelect().value).toBe('school-east');
    expect(fromInput().value).toBe('2025-02-01');
  });

  it('falls back to all schools when the remembered school no longer exists', () => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ schoolId: 'school-deleted' }));
    const lessons: Lesson[] = [createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10', schoolId: 'school-east' })];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    expect(schoolSelect().value).toBe('all');
    expect(dataRows()).toHaveLength(1);
  });

  it('ignores unreadable saved filters', () => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, '{not json');

    render(
      <LessonTable schools={SCHOOLS} lessons={[createLesson({ id: '1' })]} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(fromInput().value).toBe('2025-01-01');
    expect(schoolSelect().value).toBe('all');
  });

  it('shows a dash and date-only button labels for a lesson without a student', () => {
    render(
      <LessonTable
        schools={SCHOOLS}
        lessons={[createLesson({ id: '1', studentName: '', date: '2025-01-10' })]}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(dataRows()[0].querySelectorAll('td')[2].textContent).toBe('—');
    expect(screen.getByRole('button', { name: 'Edit lesson on 10.01.2025' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete lesson on 10.01.2025' })).toBeDefined();
  });

  it('shows empty filtered state when no lessons match the filters', () => {
    const lessons: Lesson[] = [
      createLesson({ id: '1', studentName: 'Alice', date: '2025-01-10' }),
      createLesson({ id: '2', studentName: 'Bob', date: '2025-02-10' }),
    ];

    render(<LessonTable schools={SCHOOLS} lessons={lessons} onDelete={vi.fn()} onEdit={vi.fn()} />);

    setRange('2025-11-01', '2025-11-30');

    expect(screen.getByText(/no lessons found for the selected filters/i)).toBeDefined();
  });
});
