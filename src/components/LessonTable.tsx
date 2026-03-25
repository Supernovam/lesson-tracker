import { useState, useMemo, useCallback } from 'react';
import { Trash2, Calendar, Clock, User, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Lesson } from '../types/lesson';
import { formatDisplayDate, formatDuration } from '../utils/format';

type SortableColumn = 'studentName' | 'date';
type SortDirection = 'asc' | 'desc';
type SortState = { column: SortableColumn; direction: SortDirection } | null;

interface LessonTableProps {
  lessons: Lesson[];
  onDelete: (id: string) => void;
}

function sortLessons(
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
        // Secondary key ensures deterministic ordering for same-day lessons.
        cmp = a.createdAt - b.createdAt;
      }
    }

    if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
    return direction === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
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

  const handleSort = useCallback((column: SortableColumn) => {
    setSort((prev) => {
      if (prev?.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'asc' as SortDirection };
    });
  }, []);

  const sortedLessons = useMemo(() => {
    if (!sort) return lessons;
    return sortLessons(lessons, sort.column, sort.direction);
  }, [lessons, sort]);

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
            {sortedLessons.map((lesson) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
