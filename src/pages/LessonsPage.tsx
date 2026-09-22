import { useCallback, useState } from 'react';
import { LessonForm } from '../components/LessonForm';
import { LessonTable } from '../components/LessonTable';
import { useLessonStorage } from '../hooks/useLessonStorage';
import { useLessonTypeStorage } from '../hooks/useLessonTypeStorage';
import type { Lesson, LessonFormData } from '../types/lesson';

export function LessonsPage() {
  const { lessons, addLesson, updateLesson, deleteLesson } = useLessonStorage();
  const { lessonTypes } = useLessonTypeStorage();
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const handleSubmit = useCallback(
    async (data: LessonFormData) => {
      if (editingLesson) {
        await updateLesson(editingLesson.id, data);
        setEditingLesson(null);
        return;
      }
      await addLesson(data);
    },
    [addLesson, editingLesson, updateLesson]
  );

  const handleEdit = useCallback((lesson: Lesson) => {
    setEditingLesson(lesson);
    document.getElementById('lesson-form')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <section className="mb-10" aria-label={editingLesson ? 'Edit a lesson' : 'Add a new lesson'}>
        <LessonForm
          lessonTypes={lessonTypes}
          editing={editingLesson}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditingLesson(null)}
        />
      </section>
      <section aria-label="Lesson history">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Lesson history</h2>
        <LessonTable lessons={lessons} onEdit={handleEdit} onDelete={deleteLesson} />
      </section>
    </>
  );
}
