function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return b ? `${b}/${p}` : `/${p}`;
}

// In dev we rely on Vite's proxy to forward `/api/*` and `/auth/*`
// to the local Express API.
const apiBaseFromEnv = (import.meta.env.VITE_API_BASE ?? '').trim();

export const API_BASE = (() => {
  if (apiBaseFromEnv) return apiBaseFromEnv;
  if (import.meta.env.DEV) return '';

  const baseUrl = (import.meta.env.BASE_URL ?? '').trim();
  if (baseUrl) {
    console.warn(
      '[lesson-tracker] VITE_API_BASE is not set; falling back to same-origin API calls. ' +
        'Set VITE_API_BASE at build time to use the Render backend.'
    );
  }
  return baseUrl;
})();

export function apiUrl(path: string) {
  return joinUrl(API_BASE, path);
}

type ApiFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

export async function apiFetch(path: string, init: ApiFetchInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });
}

export function isAbortError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'name' in err && err.name === 'AbortError');
}

/**
 * Error for a failed API response: the API's `{ "error": "…" }` message when present.
 * Otherwise `context: status statusText` when a context is given (never a raw body such as a
 * proxy's HTML error page), else the raw body, else `status statusText`.
 */
export async function errorFromResponse(res: Response, context?: string): Promise<Error> {
  const text = await res.text().catch(() => '');
  let apiMessage: string | undefined;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.error === 'string') apiMessage = parsed.error;
  } catch {
    // not JSON; fall back below
  }
  const status = `${res.status} ${res.statusText}`;
  if (apiMessage) return new Error(apiMessage);
  if (context) return new Error(`${context}: ${status}`);
  return new Error(text || status);
}
