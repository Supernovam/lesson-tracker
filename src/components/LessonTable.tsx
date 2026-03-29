import { useState, useMemo, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { Trash2, Calendar, Clock, User, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Lesson } from '../types/lesson';
import { formatDisplayDate, formatDuration } from '../utils/format';

type SortableColumn = 'studentName' | 'date';
type SortDirection = 'asc' | 'desc';

/** Per-column direction; `null` means that column is not part of the active sort. */
type ColumnSort = SortDirection | null;

type MultiSortState = {
  studentName: ColumnSort;
  date: ColumnSort;
  primary: SortableColumn;
};

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

function compareColumnRaw(a: Lesson, b: Lesson, column: SortableColumn): number {
  if (column === 'studentName') {
    return a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' });
  }
  return a.date.localeCompare(b.date);
}

function applyDirection(cmp: number, direction: SortDirection): number {
  return direction === 'asc' ? cmp : -cmp;
}

/**
 * Sorts by `primary` first, then the other column. If a column’s sort is `null`, that level is
 * skipped for ordering except as a default ascending tie-break after the primary comparison.
 */
function sortLessons(lessons: Lesson[], state: MultiSortState): Lesson[] {
  if (state.studentName === null && state.date === null) {
    return lessons;
  }

  const secondary: SortableColumn =
    state.primary === 'studentName' ? 'date' : 'studentName';

  return [...lessons].sort((a, b) => {
    const primaryDir = state[state.primary];
    let cmp = 0;

    if (primaryDir !== null) {
      cmp = compareColumnRaw(a, b, state.primary);
      cmp = applyDirection(cmp, primaryDir);
      if (cmp !== 0) return cmp;
    }

    const secondaryDir = state[secondary];
    if (secondaryDir !== null) {
      cmp = compareColumnRaw(a, b, secondary);
      cmp = applyDirection(cmp, secondaryDir);
    } else {
      // Inactive secondary: still use that field ascending as a stable tie-break (e.g. same date → student A→Z).
      cmp = compareColumnRaw(a, b, secondary);
    }

    if (cmp !== 0) return cmp;

    const created = a.createdAt - b.createdAt;
    if (created !== 0) return created;
    return a.id.localeCompare(b.id);
  });
}

const headerButtonClass =
  'flex items-center gap-1.5 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 rounded';
const headerCellClass =
  'px-4 py-3 text-xs font-semibold tracking-wider text-slate-600';

interface SortableHeaderProps {
  column: SortableColumn;
  label: string;
  ariaSortLabel: string;
  direction: ColumnSort;
  onSort: (column: SortableColumn) => void;
  icon: LucideIcon;
}

function SortableHeader({
  column,
  label,
  ariaSortLabel,
  direction,
  onSort,
  icon: Icon,
}: SortableHeaderProps) {
  const isActive = direction !== null;
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
            : `Sort by ${ariaSortLabel} ascending`
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

const initialMultiSort: MultiSortState = {
  studentName: null,
  date: null,
  primary: 'date',
};

export function LessonTable({ lessons, onDelete }: LessonTableProps) {
  const [sort, setSort] = useState<MultiSortState>(initialMultiSort);
  const [selectedMonth, setSelectedMonth] = useState<(typeof MONTH_OPTIONS)[number]['value']>('all');

  const handleSort = useCallback((column: SortableColumn) => {
    setSort((prev) => {
      const current = prev[column];
      const nextDir: SortDirection =
        current === null ? 'asc' : current === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        [column]: nextDir,
        primary: column,
      };
    });
  }, []);

  const filteredLessons = useMemo(() => {
    if (selectedMonth === 'all') return lessons;
    return lessons.filter((lesson) => {
      const [, month] = lesson.date.split('-');
      return Number(month) - 1 === Number(selectedMonth);
    });
  }, [lessons, selectedMonth]);

  const sortedLessons = useMemo(() => {
    return sortLessons(filteredLessons, sort);
  }, [filteredLessons, sort]);

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
      <div className="border-b border-slate-200 p-4">
        <label htmlFor="month-filter" className="mr-2 text-sm font-medium text-slate-700">
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
                direction={sort.studentName}
                onSort={handleSort}
                icon={User}
              />
              <SortableHeader
                column="date"
                label="Date"
                ariaSortLabel="date"
                direction={sort.date}
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
