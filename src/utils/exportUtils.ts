import * as XLSX from 'xlsx';
import type { Lesson } from '../types/lesson';
import { formatDisplayDate, formatDuration } from './format';
import { getLessonsForDisplay, type SortState } from './lessonTableData';

/** Month filter value → English month name (or "all-months") for export filenames. */
const EXPORT_FILENAME_MONTH: Record<string, string> = {
  all: 'all-months',
  '0': 'January',
  '1': 'February',
  '2': 'March',
  '3': 'April',
  '4': 'May',
  '5': 'June',
  '6': 'July',
  '7': 'August',
  '8': 'September',
  '9': 'October',
  '10': 'November',
  '11': 'December',
};

/**
 * Builds Excel exports that mirror the lesson table: same columns, order, filtering, and sorting.
 */
export class LessonExcelExporter {
  static readonly COLUMN_HEADERS = ['Student', 'Date', 'Duration', 'Comment'] as const;

  /**
   * Default download name: `lessons-export-<month>.xlsx` using the same month labels as the table filter.
   */
  static filenameForExport(selectedMonth: string): string {
    const part = EXPORT_FILENAME_MONTH[selectedMonth] ?? 'unknown';
    return `lessons-export-${part}.xlsx`;
  }

  /**
   * Maps internal lesson fields to the same display strings shown in the table.
   */
  static mapLessonToDisplayRow(lesson: Lesson): readonly [string, string, string, string] {
    return [
      lesson.studentName,
      formatDisplayDate(lesson.date),
      formatDuration(lesson.duration),
      lesson.comment || '—',
    ];
  }

  static getOrderedLessonsForExport(
    lessons: Lesson[],
    selectedMonth: string,
    sort: SortState
  ): Lesson[] {
    return getLessonsForDisplay(lessons, selectedMonth, sort);
  }

  /**
   * Sheet body rows (no header row), filtered and sorted like the table.
   */
  static buildDataRows(
    lessons: Lesson[],
    selectedMonth: string,
    sort: SortState
  ): string[][] {
    return this.getOrderedLessonsForExport(lessons, selectedMonth, sort).map((lesson) =>
      [...this.mapLessonToDisplayRow(lesson)]
    );
  }

  /**
   * Returns true when there is at least one lesson row to export (after filter + sort).
   */
  static hasExportableRows(lessons: Lesson[], selectedMonth: string, sort: SortState): boolean {
    return this.getOrderedLessonsForExport(lessons, selectedMonth, sort).length > 0;
  }

  static downloadLessons(
    lessons: Lesson[],
    selectedMonth: string,
    sort: SortState,
    filename?: string
  ): void {
    const headerRow = [...this.COLUMN_HEADERS];
    const dataRows = this.buildDataRows(lessons, selectedMonth, sort);
    const aoa = [headerRow, ...dataRows];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lessons');
    XLSX.writeFile(workbook, filename ?? this.filenameForExport(selectedMonth));
  }
}
