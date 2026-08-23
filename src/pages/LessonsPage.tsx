import { LessonForm } from '../components/LessonForm';
import { LessonTable } from '../components/LessonTable';
import { useLessonStorage } from '../hooks/useLessonStorage';
import { useLessonTypeStorage } from '../hooks/useLessonTypeStorage';

export function LessonsPage() {
  const { lessons, addLesson, deleteLesson } = useLessonStorage();
  const { lessonTypes } = useLessonTypeStorage();

  return (
    <>
      <section className="mb-10" aria-label="Add a new lesson">
        <LessonForm lessonTypes={lessonTypes} onSubmit={addLesson} />
      </section>
      <section aria-label="Lesson history">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Lesson history</h2>
        <LessonTable lessons={lessons} onDelete={deleteLesson} />
      </section>
    </>
  );
}
