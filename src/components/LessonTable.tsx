import { useState, useMemo, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import {
  Trash2,
  Calendar,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Lesson } from '../types/lesson';
import { formatDisplayDate, formatDuration } from '../utils/format';
import { LessonExcelExporter } from '../utils/exportUtils';
import {
  type SortableColumn,
  type SortDirection,
  type SortState,
  getLessonsForDisplay,
} from '../utils/lessonTableData';

interface LessonTableProps {
  lessons: Lesson[];
  onDelete: (id: string) => void;
}

const MONTH_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
] as const;

const headerButtonClass =
  'flex items-center gap-1.5 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 rounded';
const headerCellClass =
  'px-4 py-3 text-xs font-semibold tracking-wider text-slate-600';

interface SortableHeaderProps {
  column: SortableColumn;
  label: string;
  ariaSortLabel: string;
  sort: SortState;
  onSort: (column: SortableColumn) => void;
  icon: LucideIcon;
}

function SortableHeader({
  column,
  label,
  ariaSortLabel,
  sort,
  onSort,
  icon: Icon,
}: SortableHeaderProps) {
  const isActive = sort?.column === column;
  const direction = isActive ? sort.direction : null;
  const ariaSort = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined;

  return (
    <th scope="col" className={headerCellClass} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={headerButtonClass}
        aria-label={
          isActive
            ? `Sort by ${ariaSortLabel} ${direction === 'asc' ? 'descending' : 'ascending'}`
            : `Sort by ${ariaSortLabel}`
        }
      >
        <Icon className="h-4 w-4" aria-hidden /> {label}
        {isActive ? (
          direction === 'asc' ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="h-4 w-4 text-slate-400" aria-hidden />
        )}
      </button>
    </th>
  );
}

export function LessonTable({ lessons, onDelete }: LessonTableProps) {
  const [sort, setSort] = useState<SortState>(null);
  const [selectedMonth, setSelectedMonth] = useState<(typeof MONTH_OPTIONS)[number]['value']>('all');

  const handleSort = useCallback((column: SortableColumn) => {
    setSort((prev) => {
      if (prev?.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' as SortDirection };
    });
  }, []);

  const sortedLessons = useMemo(
    () => getLessonsForDisplay(lessons, selectedMonth, sort),
    [lessons, selectedMonth, sort]
  );

  const handleExport = useCallback(() => {
    LessonExcelExporter.downloadLessons(lessons, selectedMonth, sort);
  }, [lessons, selectedMonth, sort]);

  if (lessons.length === 0) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500"
        role="status"
        aria-label="No lessons recorded"
      >
        <p>No lessons yet. Log your first lesson above.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="month-filter" className="text-sm font-medium text-slate-700">
            Filter by month
          </label>
          <select
            id="month-filter"
            value={selectedMonth}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setSelectedMonth(event.target.value as (typeof MONTH_OPTIONS)[number]['value'])
            }
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Filter lessons by month"
          >
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={sortedLessons.length === 0}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Export filtered lessons to Excel"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          Export
        </button>
      </div>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[600px] border-collapse text-left"
          aria-label="Lesson history"
        >
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <SortableHeader
                column="studentName"
                label="Student"
                ariaSortLabel="student name"
                sort={sort}
                onSort={handleSort}
                icon={User}
              />
              <SortableHeader
                column="date"
                label="Date"
                ariaSortLabel="date"
                sort={sort}
                onSort={handleSort}
                icon={Calendar}
              />
              <th scope="col" className={headerCellClass}>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden /> Duration
                </span>
              </th>
              <th scope="col" className={headerCellClass}>
                Comment
              </th>
              <th scope="col" className="w-12 px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLessons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No lessons found for the selected month.
                </td>
              </tr>
            ) : (
              sortedLessons.map((lesson) => (
                <tr
                  key={lesson.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50/50 last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{lesson.studentName}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDisplayDate(lesson.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDuration(lesson.duration)}</td>
                  <td className="max-w-[200px] px-4 py-3 text-slate-600">
                    <span className="line-clamp-2">{lesson.comment || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onDelete(lesson.id)}
                      className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      aria-label={`Delete lesson for ${lesson.studentName} on ${formatDisplayDate(lesson.date)}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
