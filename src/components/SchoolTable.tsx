import { Pencil, Trash2 } from 'lucide-react';
import type { School } from '../types/school';

interface SchoolTableProps {
  schools: School[];
  onEdit: (school: School) => void;
  onDelete: (id: string) => void;
}

const headerCellClass = 'px-4 py-3 text-xs font-semibold tracking-wider text-slate-600';

export function SchoolTable({ schools, onEdit, onDelete }: SchoolTableProps) {
  if (schools.length === 0) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500"
        role="status"
        aria-label="No schools recorded"
      >
        <p>No schools yet. Add your first school above.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left" aria-label="Schools">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th scope="col" className={headerCellClass}>
                Title
              </th>
              <th scope="col" className={headerCellClass}>
                Billing name
              </th>
              <th scope="col" className={headerCellClass}>
                Address
              </th>
              <th scope="col" className="w-24 px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school) => (
              <tr
                key={school.id}
                className="border-b border-slate-100 transition hover:bg-slate-50/50 last:border-b-0"
              >
                <td className="px-4 py-3 font-medium text-slate-800">{school.title}</td>
                <td className="px-4 py-3 text-slate-600">{school.billingName}</td>
                <td className="whitespace-pre-line px-4 py-3 text-slate-600">{school.address}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(school)}
                      className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                      aria-label={`Edit ${school.title}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(school.id)}
                      className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      aria-label={`Delete ${school.title}`}
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
