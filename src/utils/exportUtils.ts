import writeXlsxFile from 'write-excel-file/browser';
import type { Lesson } from '../types/lesson';
import { formatDisplayDate, formatDuration, formatPrice, safeFilenamePart, sumLessonPrices } from './format';
import { ALL_DATES, getLessonsForDisplay, type LessonFilter, type SortState } from './lessonTableData';

export type LessonDisplayRow = readonly [string, string, string, string, string, string, string];

/**
 * Builds Excel exports that mirror the lesson table: same columns, order, filtering, and sorting.
 */
export class LessonExcelExporter {
  static readonly COLUMN_HEADERS = [
    'Lesson type',
    'School',
    'Student',
    'Date',
    'Duration',
    'Cost',
    'Comment',
  ] as const;

  /**
   * Default download name: `lessons-export-<from>-to-<to>.xlsx` (or `all-dates`), with the
   * school title after `lessons-export-` when the list is filtered to one school.
   */
  static filenameForExport(filter: LessonFilter, schoolTitle?: string): string {
    const school = schoolTitle ? `${safeFilenamePart(schoolTitle)}-` : '';
    const { period } = filter;
    const dates = period === ALL_DATES ? 'all-dates' : `${period.from}-to-${period.to}`;
    return `lessons-export-${school}${dates}.xlsx`;
  }

  /**
   * Maps internal lesson fields to the same display strings shown in the table.
   */
  static mapLessonToDisplayRow(lesson: Lesson): LessonDisplayRow {
    return [
      lesson.lessonTypeName || '—',
      lesson.schoolTitle || '—',
      lesson.studentName || '—',
      formatDisplayDate(lesson.date),
      formatDuration(lesson.duration),
      lesson.calculatedPrice == null ? '—' : formatPrice(lesson.calculatedPrice),
      lesson.comment || '—',
    ];
  }

  static getOrderedLessonsForExport(
    lessons: Lesson[],
    filter: LessonFilter,
    sort: SortState
  ): Lesson[] {
    return getLessonsForDisplay(lessons, filter, sort);
  }

  /**
   * Sheet body rows (no header row), filtered and sorted like the table.
   */
  static buildDataRows(
    lessons: Lesson[],
    filter: LessonFilter,
    sort: SortState
  ): string[][] {
    return this.getOrderedLessonsForExport(lessons, filter, sort).map((lesson) =>
      [...this.mapLessonToDisplayRow(lesson)]
    );
  }

  static buildWorkbookRows(
    lessons: Lesson[],
    filter: LessonFilter,
    sort: SortState
  ): string[][] {
    const ordered = this.getOrderedLessonsForExport(lessons, filter, sort);
    const dataRows = ordered.map((lesson) => [...this.mapLessonToDisplayRow(lesson)]);
    const total = sumLessonPrices(ordered);
    const costIndex = this.COLUMN_HEADERS.indexOf('Cost');
    const totalRow = this.COLUMN_HEADERS.map((_, index) => {
      if (index === 0) return 'Total';
      if (index === costIndex) return formatPrice(total);
      return '';
    });

    return [[...this.COLUMN_HEADERS], ...dataRows, [], totalRow];
  }

  /**
   * Returns true when there is at least one lesson row to export (after filter + sort).
   */
  static hasExportableRows(lessons: Lesson[], filter: LessonFilter, sort: SortState): boolean {
    return this.getOrderedLessonsForExport(lessons, filter, sort).length > 0;
  }

  static downloadLessons(
    lessons: Lesson[],
    filter: LessonFilter,
    sort: SortState,
    filename?: string
  ): Promise<void> {
    const rows = this.buildWorkbookRows(lessons, filter, sort);
    return writeXlsxFile(rows, { sheet: 'Lessons' }).toFile(filename ?? this.filenameForExport(filter));
  }
}
