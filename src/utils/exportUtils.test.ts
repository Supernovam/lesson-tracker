import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import type { Lesson } from '../types/lesson';
import { LessonExcelExporter } from './exportUtils';
import type { LessonFilter } from './lessonTableData';

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

function column(name: (typeof LessonExcelExporter.COLUMN_HEADERS)[number]) {
  return LessonExcelExporter.COLUMN_HEADERS.indexOf(name);
}

const baseLesson = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: 'id-1',
  studentName: 'Alice',
  date: '2025-01-15',
  duration: 45,
  comment: 'Notes',
  createdAt: 100,
  lessonTypeId: 'type-1',
  lessonTypeName: 'Private Course',
  schoolId: 'school-1',
  schoolTitle: 'Alpha Campus',
  calculatedPrice: 28,
  ...overrides,
});

const january: LessonFilter = { period: { from: '2025-01-01', to: '2025-01-31' }, schoolId: 'all' };
const wholeYear: LessonFilter = { period: { from: '2025-01-01', to: '2025-12-31' }, schoolId: 'all' };
const allDates: LessonFilter = { period: 'all', schoolId: 'all' };

describe('LessonExcelExporter', () => {
  describe('filtering before export', () => {
    it('exports only lessons in the selected date range', () => {
      const lessons: Lesson[] = [
        baseLesson({ id: 'a', date: '2025-01-10' }),
        baseLesson({ id: 'b', date: '2025-02-10', studentName: 'Bob' }),
        baseLesson({ id: 'c', date: '2025-01-20', studentName: 'Carol' }),
      ];

      const rows = LessonExcelExporter.buildDataRows(lessons, january, null);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r[column('Student')])).toEqual(['Alice', 'Carol']);
    });

    it('exports only lessons of the selected school', () => {
      const lessons: Lesson[] = [
        baseLesson({ id: 'a', date: '2025-01-10' }),
        baseLesson({ id: 'b', date: '2025-01-11', studentName: 'Bob', schoolId: 'school-2', schoolTitle: 'Beta' }),
      ];

      const rows = LessonExcelExporter.buildDataRows(lessons, { ...january, schoolId: 'school-2' }, null);
      expect(rows.map((r) => r[column('Student')])).toEqual(['Bob']);
    });

    it('exports lessons of every year with All dates', () => {
      const lessons: Lesson[] = [
        baseLesson({ id: 'a', date: '2019-05-10' }),
        baseLesson({ id: 'b', date: '2031-12-01', studentName: 'Zed' }),
      ];

      expect(LessonExcelExporter.buildDataRows(lessons, allDates, null)).toHaveLength(2);
    });

    it('exports lessons across months when the range spans them', () => {
      const lessons: Lesson[] = [
        baseLesson({ id: 'a', date: '2025-01-10' }),
        baseLesson({ id: 'b', date: '2025-12-01', studentName: 'Zed' }),
      ];

      const rows = LessonExcelExporter.buildDataRows(lessons, wholeYear, null);
      expect(rows).toHaveLength(2);
    });

    it('applies the same sort as the table when exporting', () => {
      const lessons: Lesson[] = [
        baseLesson({ id: 'z', studentName: 'Zoe', date: '2025-01-01' }),
        baseLesson({ id: 'a', studentName: 'Amy', date: '2025-01-01' }),
      ];

      const rows = LessonExcelExporter.buildDataRows(lessons, wholeYear, {
        column: 'studentName',
        direction: 'asc',
      });
      expect(rows.map((r) => r[column('Student')])).toEqual(['Amy', 'Zoe']);
    });
  });

  describe('empty states', () => {
    it('returns no data rows when there are no lessons', () => {
      expect(LessonExcelExporter.buildDataRows([], wholeYear, null)).toEqual([]);
      expect(LessonExcelExporter.hasExportableRows([], wholeYear, null)).toBe(false);
    });

    it('returns no data rows when the filter matches nothing', () => {
      const lessons: Lesson[] = [baseLesson({ date: '2025-01-10' })];
      const june: LessonFilter = { period: { from: '2025-06-01', to: '2025-06-30' }, schoolId: 'all' };
      expect(LessonExcelExporter.buildDataRows(lessons, june, null)).toEqual([]);
      expect(LessonExcelExporter.hasExportableRows(lessons, june, null)).toBe(false);
    });
  });

  describe('column headers and field mapping', () => {
    it('uses user-facing headers in table order', () => {
      expect([...LessonExcelExporter.COLUMN_HEADERS]).toEqual([
        'Lesson type',
        'School',
        'Student',
        'Date',
        'Duration',
        'Cost',
        'Comment',
      ]);
    });

    it('maps internal lesson fields to display strings matching the table', () => {
      const lesson = baseLesson({
        studentName: 'Pat',
        date: '2025-03-08',
        duration: 120,
        comment: '',
        lessonTypeName: 'Present Course',
        calculatedPrice: 50.4,
      });
      const row = LessonExcelExporter.mapLessonToDisplayRow(lesson);
      expect(row).toEqual([
        'Present Course',
        'Alpha Campus',
        'Pat',
        '08.03.2025',
        '120 min',
        '50,40\u00A0€',
        '—',
      ]);
    });

    it('uses an em dash when a lesson has no student name', () => {
      const lesson = baseLesson({ studentName: '' });
      expect(LessonExcelExporter.mapLessonToDisplayRow(lesson)[column('Student')]).toBe('—');
    });

    it('uses an em dash when a lesson has no school', () => {
      const lesson = baseLesson({ schoolId: null, schoolTitle: null });
      expect(LessonExcelExporter.mapLessonToDisplayRow(lesson)[column('School')]).toBe('—');
    });

    it('includes comment text when present', () => {
      const lesson = baseLesson({ comment: 'Great session' });
      expect(LessonExcelExporter.mapLessonToDisplayRow(lesson)[column('Comment')]).toBe('Great session');
    });

    it('adds a total row and no type breakdown to the workbook', () => {
      const lessons: Lesson[] = [
        baseLesson({
          id: 'a',
          lessonTypeName: 'Private Course',
          calculatedPrice: 37.33,
        }),
        baseLesson({
          id: 'b',
          studentName: 'Bob',
          lessonTypeName: 'Present Course',
          calculatedPrice: 50,
        }),
        baseLesson({
          id: 'c',
          studentName: 'Carol',
          lessonTypeName: 'Private Course',
          calculatedPrice: 28,
        }),
      ];

      const rows = LessonExcelExporter.buildWorkbookRows(lessons, wholeYear, null);
      expect(rows[0]).toEqual([...LessonExcelExporter.COLUMN_HEADERS]);
      expect(rows).toContainEqual(['Total', '', '', '', '', '115,33\u00A0€', '']);
      expect(rows.some((row) => row[0] === 'Breakdown by lesson type')).toBe(false);
    });
  });

  describe('export filenames', () => {
    it('names the file after the date range', () => {
      expect(LessonExcelExporter.filenameForExport(january)).toBe('lessons-export-2025-01-01-to-2025-01-31.xlsx');
    });

    it('names an All dates export all-dates', () => {
      expect(LessonExcelExporter.filenameForExport(allDates)).toBe('lessons-export-all-dates.xlsx');
    });

    it('adds the school title when filtered to one school', () => {
      expect(LessonExcelExporter.filenameForExport({ ...january, schoolId: 'school-1' }, 'Alpha/Campus')).toBe(
        'lessons-export-Alpha-Campus-2025-01-01-to-2025-01-31.xlsx'
      );
    });

    it('passes the range-based filename to xlsx writeFile when downloading', () => {
      vi.mocked(XLSX.writeFile).mockClear();
      LessonExcelExporter.downloadLessons([baseLesson()], january, null);
      expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
      expect(XLSX.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        'lessons-export-2025-01-01-to-2025-01-31.xlsx'
      );
    });

    it('uses an explicit filename when provided instead of the default', () => {
      vi.mocked(XLSX.writeFile).mockClear();
      LessonExcelExporter.downloadLessons([baseLesson()], january, null, 'custom-name.xlsx');
      expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'custom-name.xlsx');
    });
  });
});
