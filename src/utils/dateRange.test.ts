import { describe, expect, it, vi } from 'vitest';
import {
  calendarMonthBounds,
  constrainFrom,
  constrainTo,
  currentCalendarMonthBounds,
  filterLessonsByDateRange,
} from './dateRange';
import { createLesson } from '../test/invoiceFixtures';

describe('calendarMonthBounds', () => {
  it('returns the first and last day of the month', () => {
    expect(calendarMonthBounds(2026, 8)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(calendarMonthBounds(2024, 1)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('uses the current calendar month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
    expect(currentCalendarMonthBounds()).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    vi.useRealTimers();
  });
});

describe('filterLessonsByDateRange', () => {
  it('keeps lessons from the start date through the end date, including across months', () => {
    const lessons = [
      createLesson({ id: 'before', date: '2026-08-24' }),
      createLesson({ id: 'aug', date: '2026-08-25' }),
      createLesson({ id: 'sep', date: '2026-09-21' }),
      createLesson({ id: 'after', date: '2026-09-25' }),
    ];

    expect(filterLessonsByDateRange(lessons, '2026-08-25', '2026-09-24').map((lesson) => lesson.id)).toEqual([
      'aug',
      'sep',
    ]);
  });

  it('returns no lessons when the range is inverted or invalid', () => {
    expect(filterLessonsByDateRange([createLesson()], '2026-09-30', '2026-09-01')).toEqual([]);
    expect(filterLessonsByDateRange([createLesson()], '9', '2026-09-30')).toEqual([]);
  });
});

describe('constrain From/To', () => {
  it('does not allow From to move after To', () => {
    expect(constrainFrom('2026-10-01', '2026-09-30')).toBe('2026-09-30');
    expect(constrainFrom('2026-08-25', '2026-09-30')).toBe('2026-08-25');
  });

  it('does not allow To to move before From', () => {
    expect(constrainTo('2026-09-01', '2026-08-01')).toBe('2026-09-01');
    expect(constrainTo('2026-09-01', '2026-09-24')).toBe('2026-09-24');
  });
});
