import type { Lesson } from '../types/lesson';

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive From/To range of ISO `YYYY-MM-DD` dates. */
export type DateRange = { from: string; to: string };

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value);
}

/** A complete ISO date with a year from 1900 on. Rejects half-typed years such as `0202-10-01`. */
export function isPlausibleDate(value: unknown): value is string {
  return isIsoDate(value) && Number(value.slice(0, 4)) >= 1900;
}

export function calendarMonthBounds(year: number, monthIndex: number): DateRange {
  const month = monthIndex + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function currentCalendarMonthBounds(): DateRange {
  const now = new Date();
  return calendarMonthBounds(now.getFullYear(), now.getMonth());
}

export function filterLessonsByDateRange(lessons: Lesson[], from: string, to: string): Lesson[] {
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return [];
  return lessons.filter((lesson) => lesson.date >= from && lesson.date <= to);
}

/** Keeps From on or before To. */
export function constrainFrom(from: string, to: string): string {
  if (isIsoDate(from) && isIsoDate(to) && from > to) return to;
  return from;
}

/** Keeps To on or after From. */
export function constrainTo(from: string, to: string): string {
  if (isIsoDate(from) && isIsoDate(to) && to < from) return from;
  return to;
}
