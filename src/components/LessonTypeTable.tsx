import { Pencil, Trash2, Clock, Euro } from 'lucide-react';
import type { LessonType } from '../types/lessonType';
import { formatDuration, formatPrice } from '../utils/format';

interface LessonTypeTableProps {
  lessonTypes: LessonType[];
  onEdit: (lessonType: LessonType) => void;
  onDelete: (id: string) => void;
}

const headerCellClass =
  'px-4 py-3 text-xs font-semibold tracking-wider text-slate-600';

export function LessonTypeTable({ lessonTypes, onEdit, onDelete }: LessonTypeTableProps) {
  if (lessonTypes.length === 0) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500"
        role="status"
        aria-label="No lesson types recorded"
      >
        <p>No lesson types yet. Add your first type above.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[520px] border-collapse text-left"
          aria-label="Lesson types"
        >
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th scope="col" className={headerCellClass}>
                Name
              </th>
              <th scope="col" className={headerCellClass}>
                <span className="flex items-center gap-1.5">
                  <Euro className="h-4 w-4" aria-hidden /> Base price
                </span>
              </th>
              <th scope="col" className={headerCellClass}>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden /> Base duration
                </span>
              </th>
              <th scope="col" className="w-24 px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lessonTypes.map((lessonType) => (
              <tr
                key={lessonType.id}
                className="border-b border-slate-100 transition hover:bg-slate-50/50 last:border-b-0"
              >
                <td className="px-4 py-3 font-medium text-slate-800">{lessonType.name}</td>
                <td className="px-4 py-3 text-slate-600">{formatPrice(lessonType.basePrice)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDuration(lessonType.baseDurationMinutes)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(lessonType)}
                      className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                      aria-label={`Edit ${lessonType.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(lessonType.id)}
                      className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      aria-label={`Delete ${lessonType.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
