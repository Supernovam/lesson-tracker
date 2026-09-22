import { useCallback, useState } from 'react';
import { SchoolForm } from '../components/SchoolForm';
import { SchoolTable } from '../components/SchoolTable';
import { useSchoolStorage } from '../hooks/useSchoolStorage';
import type { School, SchoolFormData } from '../types/school';

export function SchoolsPage() {
  const { schools, addSchool, updateSchool, deleteSchool } = useSchoolStorage();
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (data: SchoolFormData) => {
      if (editingSchool) {
        await updateSchool(editingSchool.id, data);
        setEditingSchool(null);
        return;
      }
      await addSchool(data);
    },
    [addSchool, editingSchool, updateSchool]
  );

  return (
    <>
      <section className="mb-10" aria-label="Add a school">
        <SchoolForm
          editing={editingSchool}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditingSchool(null)}
        />
      </section>
      <section aria-label="Schools">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Schools</h2>
        {deleteError && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {deleteError}
          </p>
        )}
        <SchoolTable
          schools={schools}
          onEdit={setEditingSchool}
          onDelete={(id) => {
            setDeleteError(null);
            void deleteSchool(id).catch((err) => {
              setDeleteError(err instanceof Error ? err.message : 'Failed to delete school.');
            });
          }}
        />
      </section>
    </>
  );
}
