import type { Lesson } from '../types/lesson';
import { filterLessonsByDateRange, type DateRange } from './dateRange';

export type SortableColumn = 'studentName' | 'date' | 'schoolTitle';
export type SortDirection = 'asc' | 'desc';
export type SortState = { column: SortableColumn; direction: SortDirection } | null;

/** School filter value that shows lessons from every school (and lessons without one). */
export const ALL_SCHOOLS = 'all';

/** Period value that shows lessons of every date, including ones logged later. */
export const ALL_DATES = 'all';

/** Inclusive From/To dates, or `ALL_DATES`. */
export type LessonPeriod = DateRange | typeof ALL_DATES;

/** Lesson list filter: a period plus a school id or `ALL_SCHOOLS`. */
export type LessonFilter = { period: LessonPeriod; schoolId: string };

export function filterLessons(lessons: Lesson[], filter: LessonFilter): Lesson[] {
  const { period } = filter;
  const inRange = period === ALL_DATES ? lessons : filterLessonsByDateRange(lessons, period.from, period.to);
  if (filter.schoolId === ALL_SCHOOLS) return inRange;
  return inRange.filter((lesson) => lesson.schoolId === filter.schoolId);
}

export function sortLessons(
  lessons: Lesson[],
  column: SortableColumn,
  direction: SortDirection
): Lesson[] {
  return [...lessons].sort((a, b) => {
    let cmp = 0;

    if (column === 'studentName') {
      // Lessons without a student name go last in either direction.
      if (!a.studentName !== !b.studentName) return a.studentName ? -1 : 1;
      cmp = a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' });
    } else if (column === 'schoolTitle') {
      cmp = (a.schoolTitle ?? '').localeCompare(b.schoolTitle ?? '', undefined, { sensitivity: 'base' });
    } else {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) {
        cmp = dateCmp;
      } else {
        cmp = a.createdAt - b.createdAt;
      }
    }

    if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
    return direction === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });
}

/**
 * Applies the same date/school filter and optional column sort as the lesson table.
 */
export function getLessonsForDisplay(
  lessons: Lesson[],
  filter: LessonFilter,
  sort: SortState
): Lesson[] {
  const filtered = filterLessons(lessons, filter);
  if (!sort) return filtered;
  return sortLessons(filtered, sort.column, sort.direction);
}
