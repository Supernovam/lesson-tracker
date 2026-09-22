import { useState, useEffect, useCallback } from 'react';
import type { School, SchoolFormData } from '../types/school';
import { apiFetch } from '../api/config';

async function fetchSchools(signal?: AbortSignal): Promise<School[]> {
  const res = await apiFetch('/api/schools', { signal });
  if (!res.ok) {
    throw new Error(`Failed to load schools: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as School[];
}

function errorFromResponse(text: string, status: number, statusText: string): Error {
  let parsedError: string | undefined;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.error === 'string') parsedError = parsed.error;
  } catch {
    // ignore JSON parse errors and fall back below
  }
  return new Error(parsedError || text || `${status} ${statusText}`);
}

function toPayload(formData: SchoolFormData) {
  return {
    title: formData.title.trim(),
    address: formData.address.trim(),
  };
}

/**
 * Custom hook for schools persisted in Neon Postgres.
 * Returns schools sorted by title.
 */
export function useSchoolStorage() {
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    fetchSchools(controller.signal)
      .then((data) => {
        if (isMounted) setSchools(data);
      })
      .catch((err) => {
        const maybeName =
          err instanceof Error
            ? err.name
            : typeof err === 'object' && err !== null && 'name' in err
              ? (err as { name?: unknown }).name
              : undefined;
        if (maybeName === 'AbortError') return;
        console.error(err);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const addSchool = useCallback(async (formData: SchoolFormData) => {
    const res = await apiFetch('/api/schools', {
      method: 'POST',
      body: JSON.stringify(toPayload(formData)),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw errorFromResponse(text, res.status, res.statusText);
    }

    const school = (await res.json()) as School;
    setSchools((prev) => [...prev, school]);
  }, []);

  const updateSchool = useCallback(async (id: string, formData: SchoolFormData) => {
    const res = await apiFetch(`/api/schools/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(toPayload(formData)),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw errorFromResponse(text, res.status, res.statusText);
    }

    const school = (await res.json()) as School;
    setSchools((prev) => prev.map((item) => (item.id === id ? school : item)));
  }, []);

  const deleteSchool = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/schools/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.status === 404) {
      setSchools((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw errorFromResponse(text, res.status, res.statusText);
    }
    setSchools((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const schoolsByTitle = [...schools].sort((a, b) => a.title.localeCompare(b.title));

  return {
    schools: schoolsByTitle,
    addSchool,
    updateSchool,
    deleteSchool,
  };
}
