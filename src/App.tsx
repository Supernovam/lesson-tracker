import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { LessonsPage } from './pages/LessonsPage';
import { LessonTypesPage } from './pages/LessonTypesPage';

type Tab = 'lessons' | 'lesson-types';

function TrackerApp({
  userEmail,
  onLogout,
}: {
  userEmail: string;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('lessons');

  const tabClass = (tab: Tab) =>
    activeTab === tab
      ? 'rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white'
      : 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50';

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

        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Main">
          <button
            type="button"
            onClick={() => setActiveTab('lessons')}
            className={tabClass('lessons')}
            aria-current={activeTab === 'lessons' ? 'page' : undefined}
          >
            Lessons
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lesson-types')}
            className={tabClass('lesson-types')}
            aria-current={activeTab === 'lesson-types' ? 'page' : undefined}
          >
            Lesson Types
          </button>
        </nav>

        {activeTab === 'lessons' ? <LessonsPage /> : <LessonTypesPage />}
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
