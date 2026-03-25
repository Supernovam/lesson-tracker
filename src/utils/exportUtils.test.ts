import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import type { Lesson } from '../types/lesson';
import { LessonExcelExporter } from './exportUtils';

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

const baseLesson = (overrides: Partial<Lesson>): Lesson => ({
  id: 'id-1',
  studentName: 'Alice',
  date: '2025-01-15',
  duration: 45,
  comment: 'Notes',
  createdAt: 100,
  ...overrides,
});

describe('LessonExcelExporter', () => {
  describe('filtering before export', () => {
    it('exports only lessons in the selected month', () => {
      const lessons: Lesson[] = [
        baseLesson({ id: 'a', date: '2025-01-10' }),
        baseLesson({ id: 'b', date: '2025-02-10', studentName: 'Bob' }),
        baseLesson({ id: 'c', date: '2025-01-20', studentName: 'Carol' }),
      ];

      const rows = LessonExcelExporter.buildDataRows(lessons, '0', null);
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r[0])).toEqual(['Alice', 'Carol']);
    });

    it('exports all lessons when month filter is "all"', () => {
      const lessons: Lesson[] = [
        baseLesson({ id: 'a', date: '2025-01-10' }),
        baseLesson({ id: 'b', date: '2025-12-01', studentName: 'Zed' }),
      ];

      const rows = LessonExcelExporter.buildDataRows(lessons, 'all', null);
      expect(rows).toHaveLength(2);
    });

    it('applies the same sort as the table when exporting', () => {
      const lessons: Lesson[] = [
        baseLesson({ id: 'z', studentName: 'Zoe', date: '2025-01-01' }),
        baseLesson({ id: 'a', studentName: 'Amy', date: '2025-01-01' }),
      ];

      const rows = LessonExcelExporter.buildDataRows(lessons, 'all', {
        column: 'studentName',
        direction: 'asc',
      });
      expect(rows.map((r) => r[0])).toEqual(['Amy', 'Zoe']);
    });
  });

  describe('empty states', () => {
    it('returns no data rows when there are no lessons', () => {
      expect(LessonExcelExporter.buildDataRows([], 'all', null)).toEqual([]);
      expect(LessonExcelExporter.hasExportableRows([], 'all', null)).toBe(false);
    });

    it('returns no data rows when the month filter matches nothing', () => {
      const lessons: Lesson[] = [baseLesson({ date: '2025-01-10' })];
      expect(LessonExcelExporter.buildDataRows(lessons, '5', null)).toEqual([]);
      expect(LessonExcelExporter.hasExportableRows(lessons, '5', null)).toBe(false);
    });
  });

  describe('column headers and field mapping', () => {
    it('uses user-facing headers in table order', () => {
      expect([...LessonExcelExporter.COLUMN_HEADERS]).toEqual([
        'Student',
        'Date',
        'Duration',
        'Comment',
      ]);
    });

    it('maps internal lesson fields to display strings matching the table', () => {
      const lesson = baseLesson({
        studentName: 'Pat',
        date: '2025-03-08',
        duration: 120,
        comment: '',
      });
      const row = LessonExcelExporter.mapLessonToDisplayRow(lesson);
      expect(row).toEqual(['Pat', '08.03.2025', '120 min', '—']);
    });

    it('includes comment text when present', () => {
      const lesson = baseLesson({ comment: 'Great session' });
      expect(LessonExcelExporter.mapLessonToDisplayRow(lesson)[3]).toBe('Great session');
    });
  });

  describe('export filenames', () => {
    it('includes the English month name when a specific month is selected', () => {
      expect(LessonExcelExporter.filenameForExport('2')).toBe('lessons-export-March.xlsx');
      expect(LessonExcelExporter.filenameForExport('11')).toBe('lessons-export-December.xlsx');
    });

    it('uses all-months when the filter is All', () => {
      expect(LessonExcelExporter.filenameForExport('all')).toBe('lessons-export-all-months.xlsx');
    });

    it('falls back to a generic segment when the month value is unknown', () => {
      expect(LessonExcelExporter.filenameForExport('not-a-month')).toBe('lessons-export-unknown.xlsx');
    });

    it('passes the month-based filename to xlsx writeFile when downloading', () => {
      vi.mocked(XLSX.writeFile).mockClear();
      LessonExcelExporter.downloadLessons([baseLesson()], '8', null);
      expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
      expect(XLSX.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        'lessons-export-September.xlsx'
      );
    });

    it('uses an explicit filename when provided instead of the month-based default', () => {
      vi.mocked(XLSX.writeFile).mockClear();
      LessonExcelExporter.downloadLessons([baseLesson()], '0', null, 'custom-name.xlsx');
      expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'custom-name.xlsx');
    });
  });
});
