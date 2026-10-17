import { useCallback, useEffect, useState } from 'react';
import { apiFetch, isAbortError } from '../api/config';
import type { IssuedInvoice } from '../types/invoice';

export type IssuedInvoicesState =
  | { status: 'loading'; invoices: IssuedInvoice[]; nextNumber: null }
  | { status: 'ready'; invoices: IssuedInvoice[]; nextNumber: number }
  | { status: 'error'; invoices: IssuedInvoice[]; nextNumber: null };

type IssuedInvoicesResponse = { invoices: IssuedInvoice[]; nextNumber: number };

async function errorFromResponse(res: Response, fallback: string): Promise<Error> {
  try {
    const parsed = JSON.parse(await res.text());
    if (parsed && typeof parsed.error === 'string') return new Error(parsed.error);
  } catch {
    // ignore JSON parse errors and fall back below
  }
  return new Error(`${fallback}: ${res.status} ${res.statusText}`);
}

async function fetchIssuedInvoices(
  from: string,
  to: string,
  year: number,
  signal?: AbortSignal
): Promise<IssuedInvoicesResponse> {
  const query = new URLSearchParams({ from, to, year: String(year) });
  const res = await apiFetch(`/api/issued-invoices?${query}`, { signal });
  if (!res.ok) throw await errorFromResponse(res, 'Failed to load issued invoices');
  return (await res.json()) as IssuedInvoicesResponse;
}

/**
 * Rechnungsnummern already issued for one billing period, and `issue` to assign new ones.
 * `year` is the calendar year of the invoice date; numbering restarts at 1 each year.
 */
export function useIssuedInvoices(from: string, to: string, year: number) {
  const [state, setState] = useState<IssuedInvoicesState>({ status: 'loading', invoices: [], nextNumber: null });

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    setState({ status: 'loading', invoices: [], nextNumber: null });

    fetchIssuedInvoices(from, to, year, controller.signal)
      .then((data) => {
        if (isMounted) setState({ status: 'ready', invoices: data.invoices, nextNumber: data.nextNumber });
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        console.error(err);
        if (isMounted) setState({ status: 'error', invoices: [], nextNumber: null });
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [from, to, year]);

  const issue = useCallback(
    async (schoolIds: string[], issuedOn: string): Promise<IssuedInvoice[]> => {
      const res = await apiFetch('/api/issued-invoices', {
        method: 'POST',
        body: JSON.stringify({ from, to, issuedOn, schoolIds }),
      });
      if (!res.ok) throw await errorFromResponse(res, 'Failed to issue invoices');
      const issued = (await res.json()) as IssuedInvoice[];
      setState((prev) => {
        if (prev.status !== 'ready') return prev;
        const issuedSchoolIds = new Set(issued.map((entry) => entry.schoolId));
        const highestThisYear = Math.max(
          0,
          ...issued.filter((entry) => entry.year === year).map((entry) => entry.number)
        );
        return {
          status: 'ready',
          invoices: [...prev.invoices.filter((entry) => !issuedSchoolIds.has(entry.schoolId)), ...issued],
          nextNumber: Math.max(prev.nextNumber, highestThisYear + 1),
        };
      });
      return issued;
    },
    [from, to, year]
  );

  return { ...state, issue };
}
