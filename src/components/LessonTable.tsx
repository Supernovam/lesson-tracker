import { useState, useMemo, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import {
  Pencil,
  Trash2,
  Calendar,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Tags,
  Euro,
  School,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Lesson } from '../types/lesson';
import type { School as SchoolRecord } from '../types/school';
import { DateRangeFields } from './DateRangeFields';
import { filterButtonClass, filterControlClass } from './filterStyles';
import { currentCalendarMonthBounds, type DateRange } from '../utils/dateRange';
import { loadLessonFilters, saveLessonFilters } from '../utils/lessonFilterStorage';
import { describeLesson, formatDisplayDate, formatDuration, formatPrice } from '../utils/format';
import { LessonExcelExporter } from '../utils/exportUtils';
import {
  ALL_DATES,
  ALL_SCHOOLS,
  type LessonFilter,
  type LessonPeriod,
  type SortState,
  type SortableColumn,
  type SortDirection,
  getLessonsForDisplay,
} from '../utils/lessonTableData';

/** Per-column direction; `null` means that column is not part of the active sort. */
type ColumnSort = SortDirection | null;

type MultiSortState = {
  studentName: ColumnSort;
  date: ColumnSort;
  schoolTitle: ColumnSort;
  primary: SortableColumn;
};

interface LessonTableProps {
  lessons: Lesson[];
  schools: SchoolRecord[];
  onEdit: (lesson: Lesson) => void;
  onDelete: (id: string) => void;
}

const headerButtonClass =
  'flex items-center gap-1.5 transition hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 rounded';
const headerCellClass =
  'px-2 py-3 text-xs font-semibold tracking-wider text-slate-600';

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
  schoolTitle: null,
  primary: 'date',
};

export function LessonTable({ lessons, schools, onEdit, onDelete }: LessonTableProps) {
  const [sort, setSort] = useState<MultiSortState>(initialMultiSort);
  // Filters start on the current month and all schools, unless the user changed them on an
  // earlier visit; then their last choice is restored from this browser.
  const [saved] = useState(loadLessonFilters);
  const [period, setPeriod] = useState<LessonPeriod>(() => saved.period ?? currentCalendarMonthBounds());
  const [selectedSchoolId, setSelectedSchoolId] = useState(saved.schoolId ?? ALL_SCHOOLS);

  // A remembered school that was since deleted falls back to all schools.
  const schoolId =
    selectedSchoolId === ALL_SCHOOLS || schools.some((school) => school.id === selectedSchoolId)
      ? selectedSchoolId
      : ALL_SCHOOLS;
  const filter = useMemo<LessonFilter>(() => ({ period, schoolId }), [period, schoolId]);
  const selectedSchoolTitle = schools.find((school) => school.id === schoolId)?.title;
  const currentMonth = currentCalendarMonthBounds();
  const isCurrentMonth =
    period !== ALL_DATES && period.from === currentMonth.from && period.to === currentMonth.to;
  // With All dates the inputs show the span of the logged lessons.
  const shownRange = useMemo<DateRange>(() => {
    if (period !== ALL_DATES) return period;
    if (lessons.length === 0) return currentCalendarMonthBounds();
    const dates = lessons.map((lesson) => lesson.date).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [period, lessons]);

  const handlePeriodChange = useCallback((next: LessonPeriod) => {
    setPeriod(next);
    // Exactly the current month is the default, so keep following the calendar.
    const month = currentCalendarMonthBounds();
    const isDefault = next !== ALL_DATES && next.from === month.from && next.to === month.to;
    saveLessonFilters({ period: isDefault ? undefined : next });
  }, []);

  const handleShowCurrentMonth = useCallback(() => {
    setPeriod(currentCalendarMonthBounds());
    // Forget the saved period so later visits follow the calendar month again.
    saveLessonFilters({ period: undefined });
  }, []);

  const handleSchoolChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchoolId(event.target.value);
    saveLessonFilters({ schoolId: event.target.value });
  }, []);

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

  const activeSort = useMemo<SortState>(() => {
    const direction = sort[sort.primary];
    if (!direction) return null;
    return { column: sort.primary, direction };
  }, [sort]);

  const sortedLessons = useMemo(
    () => getLessonsForDisplay(lessons, filter, activeSort),
    [lessons, filter, activeSort]
  );

  const handleExport = useCallback(() => {
    if (!LessonExcelExporter.hasExportableRows(lessons, filter, activeSort)) return;
    LessonExcelExporter.downloadLessons(
      lessons,
      filter,
      activeSort,
      LessonExcelExporter.filenameForExport(filter, selectedSchoolTitle)
    ).catch((err) => console.error('Failed to export lessons:', err));
  }, [lessons, filter, activeSort, selectedSchoolTitle]);

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
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
        <DateRangeFields
          idPrefix="lesson-filter"
          ariaLabelPrefix="Lesson filter"
          range={shownRange}
          onChange={handlePeriodChange}
        />
        <button type="button" onClick={handleShowCurrentMonth} disabled={isCurrentMonth} className={filterButtonClass}>
          Current month
        </button>
        <button
          type="button"
          onClick={() => handlePeriodChange(ALL_DATES)}
          aria-pressed={period === ALL_DATES}
          className={`${filterButtonClass} aria-pressed:bg-slate-100`}
        >
          All dates
        </button>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="school-filter" className="text-sm font-medium text-slate-700">
            School
          </label>
          <select
            id="school-filter"
            value={schoolId}
            onChange={handleSchoolChange}
            className={filterControlClass}
            aria-label="Filter lessons by school"
          >
            <option value={ALL_SCHOOLS}>All schools</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={sortedLessons.length === 0}
          className={filterButtonClass}
          aria-label="Export filtered lessons to Excel"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          Export
        </button>
      </div>
      <div className="overflow-x-auto">
        <table
          className="w-full table-fixed border-collapse text-left"
          aria-label="Lesson history"
        >
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[7.25rem]" />
            <col className="w-[7.5rem]" />
            <col className="w-[5.5rem]" />
            <col />
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th scope="col" className={headerCellClass}>
                <span className="flex items-center gap-1.5">
                  <Tags className="h-4 w-4" aria-hidden /> Type
                </span>
              </th>
              <SortableHeader
                column="schoolTitle"
                label="School"
                ariaSortLabel="school"
                direction={sort.schoolTitle}
                onSort={handleSort}
                icon={School}
              />
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
                <span className="flex items-center gap-1.5">
                  <Euro className="h-4 w-4" aria-hidden /> Cost
                </span>
              </th>
              <th scope="col" className={headerCellClass}>
                Comment
              </th>
              <th scope="col" className="w-16 px-1 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLessons.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No lessons found for the selected filters.
                </td>
              </tr>
            ) : (
              sortedLessons.map((lesson) => (
                <tr
                  key={lesson.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50/50 last:border-b-0"
                >
                  <td className="truncate px-2 py-3 text-slate-600">{lesson.lessonTypeName || '—'}</td>
                  <td className="truncate px-2 py-3 text-slate-600">{lesson.schoolTitle || '—'}</td>
                  <td className="truncate px-2 py-3 font-medium text-slate-800">{lesson.studentName || '—'}</td>
                  <td className="overflow-hidden whitespace-nowrap px-2 py-3 text-slate-600">{formatDisplayDate(lesson.date)}</td>
                  <td className="overflow-hidden whitespace-nowrap px-2 py-3 text-slate-600">{formatDuration(lesson.duration)}</td>
                  <td className="overflow-hidden whitespace-nowrap px-2 py-3 text-slate-600">
                    {lesson.calculatedPrice == null ? '—' : formatPrice(lesson.calculatedPrice)}
                  </td>
                  <td className="px-2 py-3 text-slate-600">
                    <span className="line-clamp-2">{lesson.comment || '—'}</span>
                  </td>
                  <td className="px-1 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(lesson)}
                        className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                        aria-label={`Edit ${describeLesson(lesson)}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(lesson.id)}
                        className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        aria-label={`Delete ${describeLesson(lesson)}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
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
