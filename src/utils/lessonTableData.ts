import type { Lesson } from '../types/lesson';

export type SortableColumn = 'studentName' | 'date';
export type SortDirection = 'asc' | 'desc';
export type SortState = { column: SortableColumn; direction: SortDirection } | null;

/**
 * Keeps lessons whose ISO date falls in the selected calendar month, or all lessons when "all".
 */
export function filterLessonsByMonth(lessons: Lesson[], selectedMonth: string): Lesson[] {
  if (selectedMonth === 'all') return lessons;
  return lessons.filter((lesson) => {
    const [, month] = lesson.date.split('-');
    return Number(month) - 1 === Number(selectedMonth);
  });
}

export function sortLessons(
  lessons: Lesson[],
  column: SortableColumn,
  direction: SortDirection
): Lesson[] {
  return [...lessons].sort((a, b) => {
    let cmp = 0;

    if (column === 'studentName') {
      cmp = a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' });
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
 * Applies the same month filter and optional column sort as the lesson table.
 */
export function getLessonsForDisplay(
  lessons: Lesson[],
  selectedMonth: string,
  sort: SortState
): Lesson[] {
  const filtered = filterLessonsByMonth(lessons, selectedMonth);
  if (!sort) return filtered;
  return sortLessons(filtered, sort.column, sort.direction);
}
