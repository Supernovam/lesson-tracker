import { Trash2, Calendar, Clock, User } from 'lucide-react';
import type { Lesson } from '../types/lesson';
import { formatDisplayDate, formatDuration } from '../utils/format';

interface LessonTableProps {
  lessons: Lesson[];
  onDelete: (id: string) => void;
}

export function LessonTable({ lessons, onDelete }: LessonTableProps) {
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
          role="table"
          aria-label="Lesson history"
        >
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" aria-hidden /> Student
                </span>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" aria-hidden /> Date
                </span>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden /> Duration
                </span>
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Comment
              </th>
              <th scope="col" className="w-12 px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
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
