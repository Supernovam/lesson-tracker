import { apiUrl } from '../api/config';

const productionApiBase = (import.meta.env.VITE_API_BASE ?? '').trim();
const isProductionFrontend = import.meta.env.PROD;
const apiMisconfigured = isProductionFrontend && !productionApiBase;

interface LoginScreenProps {
  error?: string | null;
}

export function LoginScreen({ error }: LoginScreenProps) {
  const displayError =
    error ||
    (apiMisconfigured
      ? 'This production build has no API URL. Set the VITE_API_BASE GitHub Actions secret to your Render origin and redeploy Pages.'
      : null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans text-slate-800 antialiased">
      <main className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lesson Tracker</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with a Google account that has been granted access.
        </p>

        {displayError ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {displayError}
          </p>
        ) : null}

        {apiMisconfigured ? (
          <p className="mt-6 text-sm text-slate-500">Sign-in is unavailable until the API URL is configured.</p>
        ) : (
          <a
            href={apiUrl('/auth/google')}
            className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Continue with Google
          </a>
        )}
      </main>
    </div>
  );
}
