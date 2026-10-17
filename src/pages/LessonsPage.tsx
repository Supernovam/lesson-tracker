import { useCallback, useState } from 'react';
import { LessonForm } from '../components/LessonForm';
import { LessonTable } from '../components/LessonTable';
import { useLessonStorage } from '../hooks/useLessonStorage';
import { useLessonTypeStorage } from '../hooks/useLessonTypeStorage';
import { useSchoolStorage } from '../hooks/useSchoolStorage';
import type { Lesson, LessonFormData } from '../types/lesson';
import { describeLesson } from '../utils/format';

export function LessonsPage() {
  const { lessons, addLesson, updateLesson, deleteLesson } = useLessonStorage();
  const { lessonTypes } = useLessonTypeStorage();
  const { schools } = useSchoolStorage();
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (data: LessonFormData) => {
      if (editingLesson) {
        await updateLesson(editingLesson.id, data);
        setEditingLesson(null);
      } else {
        await addLesson(data);
      }
      setDeleteError(null);
    },
    [addLesson, editingLesson, updateLesson]
  );

  const handleEdit = useCallback((lesson: Lesson) => {
    setEditingLesson(lesson);
    document.getElementById('lesson-form')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const lesson = lessons.find((item) => item.id === id);
      if (!lesson) return;
      if (!window.confirm(`Delete the ${describeLesson(lesson)}? This cannot be undone.`)) return;
      setDeleteError(null);
      deleteLesson(id)
        .then(() => setEditingLesson((current) => (current?.id === id ? null : current)))
        .catch((err) => {
          setDeleteError(err instanceof Error ? err.message : 'Failed to delete lesson.');
        });
    },
    [deleteLesson, lessons]
  );

  return (
    <>
      <section className="mb-10" aria-label={editingLesson ? 'Edit a lesson' : 'Add a new lesson'}>
        <LessonForm
          lessonTypes={lessonTypes}
          schools={schools}
          editing={editingLesson}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditingLesson(null)}
        />
      </section>
      <section aria-label="Lesson history">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Lesson history</h2>
        {deleteError && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            Could not delete the lesson: {deleteError}
          </p>
        )}
        <LessonTable lessons={lessons} schools={schools} onEdit={handleEdit} onDelete={handleDelete} />
      </section>
    </>
  );
}
