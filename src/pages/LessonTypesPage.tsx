import { useCallback, useState } from 'react';
import { LessonTypeForm } from '../components/LessonTypeForm';
import { LessonTypeTable } from '../components/LessonTypeTable';
import { useLessonTypeStorage } from '../hooks/useLessonTypeStorage';
import type { LessonType, LessonTypeFormData } from '../types/lessonType';

export function LessonTypesPage() {
  const { lessonTypes, addLessonType, updateLessonType, deleteLessonType } = useLessonTypeStorage();
  const [editingType, setEditingType] = useState<LessonType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (data: LessonTypeFormData) => {
      if (editingType) {
        await updateLessonType(editingType.id, data);
        setEditingType(null);
        return;
      }
      await addLessonType(data);
    },
    [addLessonType, editingType, updateLessonType]
  );

  return (
    <>
      <section className="mb-10" aria-label="Add a lesson type">
        <LessonTypeForm
          editing={editingType}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditingType(null)}
        />
      </section>
      <section aria-label="Lesson types">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Lesson types</h2>
        {deleteError && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {deleteError}
          </p>
        )}
        <LessonTypeTable
          lessonTypes={lessonTypes}
          onEdit={setEditingType}
          onDelete={(id) => {
            setDeleteError(null);
            void deleteLessonType(id).catch((err) => {
              setDeleteError(err instanceof Error ? err.message : 'Failed to delete lesson type.');
            });
          }}
        />
      </section>
    </>
  );
}
