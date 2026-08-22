import { LessonForm } from './components/LessonForm';
import { LessonTable } from './components/LessonTable';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { useLessonStorage } from './hooks/useLessonStorage';

function TrackerApp({
  userEmail,
  onLogout,
}: {
  userEmail: string;
  onLogout: () => void;
}) {
  const { lessons, addLesson, deleteLesson } = useLessonStorage();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Lesson Tracker
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{userEmail}</span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
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

function App() {
  const { user, status, error, logout } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Checking sign-in…
      </div>
    );
  }

  if (status !== 'authenticated' || !user) {
    return <LoginScreen error={error} />;
  }

  return <TrackerApp userEmail={user.email} onLogout={logout} />;
}

export default App;
