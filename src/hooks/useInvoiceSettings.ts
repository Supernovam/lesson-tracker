import { useEffect, useState } from 'react';
import { apiFetch, isAbortError } from '../api/config';
import type { InvoiceSettings } from '../types/invoice';

export type InvoiceSettingsState =
  | { status: 'loading'; settings: null }
  | { status: 'ready'; settings: InvoiceSettings }
  | { status: 'missing'; settings: null }
  | { status: 'error'; settings: null };

async function fetchInvoiceSettings(signal?: AbortSignal): Promise<InvoiceSettings | null> {
  const res = await apiFetch('/api/invoice-settings', { signal });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load invoice settings: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as InvoiceSettings;
}

export function useInvoiceSettings(): InvoiceSettingsState {
  const [state, setState] = useState<InvoiceSettingsState>({ status: 'loading', settings: null });

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    fetchInvoiceSettings(controller.signal)
      .then((data) => {
        if (!isMounted) return;
        setState(data ? { status: 'ready', settings: data } : { status: 'missing', settings: null });
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        console.error(err);
        if (isMounted) setState({ status: 'error', settings: null });
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  return state;
}
