import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SchoolsPage } from './SchoolsPage';
import { apiFetch } from '../api/config';

vi.mock('../api/config', () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return {
    ok: true,
    status: init.status ?? 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(body: string, status: number, statusText = 'Conflict') {
  return {
    ok: false,
    status,
    statusText,
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response;
}

const eastCampus = {
  id: 'school-east',
  title: 'East Campus',
  address: 'Main St\n10115 Berlin',
  createdAt: 1,
  updatedAt: 1,
};

describe('SchoolsPage', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it('shows the server message when a school in use cannot be deleted', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([eastCampus]));
    render(<SchoolsPage />);

    expect(await screen.findByRole('button', { name: /delete east campus/i })).toBeDefined();

    mockedApiFetch.mockResolvedValueOnce(
      errorResponse(
        JSON.stringify({
          error: 'This school is used by existing lessons and cannot be deleted',
        }),
        409
      )
    );
    fireEvent.click(screen.getByRole('button', { name: /delete east campus/i }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This school is used by existing lessons and cannot be deleted'
    );
    expect(screen.getByRole('button', { name: /delete east campus/i })).toBeDefined();
  });

  it('trims the title and address before creating a school', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([]));
    render(<SchoolsPage />);

    expect(await screen.findByRole('status', { name: /no schools recorded/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: '  East Campus  ' } });
    fireEvent.change(screen.getByLabelText(/^address$/i), {
      target: { value: '  Main St\n10115 Berlin  ' },
    });

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(eastCampus, { status: 201 }));
    fireEvent.click(screen.getByRole('button', { name: /save school/i }));

    await waitFor(() => {
      const { calls } = mockedApiFetch.mock;
      const [url, options] = calls[calls.length - 1];
      expect(url).toBe('/api/schools');
      expect(options?.method).toBe('POST');
      expect(JSON.parse(options?.body as string)).toEqual({
        title: 'East Campus',
        address: 'Main St\n10115 Berlin',
      });
    });
  });
});
