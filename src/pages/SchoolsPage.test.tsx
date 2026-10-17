import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SchoolsPage } from './SchoolsPage';
import { apiFetch } from '../api/config';

// Only the network call is faked; error and abort helpers stay real.
vi.mock('../api/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/config')>()),
  apiFetch: vi.fn(),
}));

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

const alphaCampus = {
  id: 'school-alpha',
  title: 'Alpha Campus',
  billingName: 'Alpha Campus GmbH',
  address: 'Main St\n12345 Sampletown',
  createdAt: 1,
  updatedAt: 1,
};

describe('SchoolsPage', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it('shows the server message when a school in use cannot be deleted', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([alphaCampus]));
    render(<SchoolsPage />);

    expect(await screen.findByRole('button', { name: /delete alpha campus/i })).toBeDefined();

    mockedApiFetch.mockResolvedValueOnce(
      errorResponse(
        JSON.stringify({
          error: 'This school is used by existing lessons and cannot be deleted',
        }),
        409
      )
    );
    fireEvent.click(screen.getByRole('button', { name: /delete alpha campus/i }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This school is used by existing lessons and cannot be deleted'
    );
    expect(screen.getByRole('button', { name: /delete alpha campus/i })).toBeDefined();
  });

  it('trims the title, billing name, and address before creating a school', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse([]));
    render(<SchoolsPage />);

    expect(await screen.findByRole('status', { name: /no schools recorded/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: '  Alpha Campus  ' } });
    fireEvent.change(screen.getByLabelText(/^billing name$/i), {
      target: { value: '  Alpha Campus GmbH  ' },
    });
    fireEvent.change(screen.getByLabelText(/^address$/i), {
      target: { value: '  Main St\n12345 Sampletown  ' },
    });

    mockedApiFetch.mockResolvedValueOnce(jsonResponse(alphaCampus, { status: 201 }));
    fireEvent.click(screen.getByRole('button', { name: /save school/i }));

    await waitFor(() => {
      const { calls } = mockedApiFetch.mock;
      const [url, options] = calls[calls.length - 1];
      expect(url).toBe('/api/schools');
      expect(options?.method).toBe('POST');
      expect(JSON.parse(options?.body as string)).toEqual({
        title: 'Alpha Campus',
        billingName: 'Alpha Campus GmbH',
        address: 'Main St\n12345 Sampletown',
      });
    });
  });
});
