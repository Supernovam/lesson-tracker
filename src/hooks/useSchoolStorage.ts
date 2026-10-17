import { useState, useEffect, useCallback } from 'react';
import type { School, SchoolFormData } from '../types/school';
import { apiFetch, errorFromResponse, isAbortError } from '../api/config';

async function fetchSchools(signal?: AbortSignal): Promise<School[]> {
  const res = await apiFetch('/api/schools', { signal });
  if (!res.ok) {
    throw new Error(`Failed to load schools: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as School[];
}

function toPayload(formData: SchoolFormData) {
  return {
    title: formData.title.trim(),
    billingName: formData.billingName.trim(),
    address: formData.address.trim(),
  };
}

/**
 * Custom hook for schools persisted in Neon Postgres.
 * Returns schools sorted by title.
 */
export type SchoolStorageStatus = 'loading' | 'ready' | 'error';

export function useSchoolStorage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [status, setStatus] = useState<SchoolStorageStatus>('loading');

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    fetchSchools(controller.signal)
      .then((data) => {
        if (!isMounted) return;
        setSchools(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        console.error(err);
        if (isMounted) setStatus('error');
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
      throw await errorFromResponse(res);
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
      throw await errorFromResponse(res);
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
      throw await errorFromResponse(res);
    }
    setSchools((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const schoolsByTitle = [...schools].sort((a, b) => a.title.localeCompare(b.title));

  return {
    schools: schoolsByTitle,
    status,
    addSchool,
    updateSchool,
    deleteSchool,
  };
}
