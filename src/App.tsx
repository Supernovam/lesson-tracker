import { LessonForm } from './components/LessonForm';
import { LessonTable } from './components/LessonTable';
import { useLessonStorage } from './hooks/useLessonStorage';

function App() {
  const { lessons, addLesson, deleteLesson } = useLessonStorage();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Lesson Tracker
          </h1>
        </header>

        <section className="mb-10" aria-label="Add a new lesson">
          <LessonForm onSubmit={addLesson} />
        </section>

        <section aria-label="Lesson history">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Lesson history</h2>
          <LessonTable lessons={lessons} onDelete={deleteLesson} />
        </section>
      </main>
    </div>
  );
}

export default App;
