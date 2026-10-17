import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SchoolForm } from './SchoolForm';
import type { School } from '../types/school';

const editingSchool: School = {
  id: 'school-1',
  title: 'Alpha Campus',
  billingName: 'Alpha Campus GmbH',
  address: 'Main St\n12345 Sampletown',
  createdAt: 1,
  updatedAt: 1,
};

describe('SchoolForm', () => {
  it('requires a title, billing name, and address', () => {
    render(<SchoolForm editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save school/i }));
    expect(screen.getByText('Title is required')).toBeDefined();
    expect(screen.getByText('Billing name is required')).toBeDefined();
    expect(screen.getByText('Address is required')).toBeDefined();
  });

  it('prefills the school being edited and submits its current values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SchoolForm editing={editingSchool} onSubmit={onSubmit} onCancelEdit={vi.fn()} />);

    expect((screen.getByLabelText(/^title$/i) as HTMLInputElement).value).toBe('Alpha Campus');
    expect((screen.getByLabelText(/^billing name$/i) as HTMLInputElement).value).toBe(
      'Alpha Campus GmbH'
    );
    expect((screen.getByLabelText(/^address$/i) as HTMLTextAreaElement).value).toBe(
      'Main St\n12345 Sampletown'
    );

    fireEvent.change(screen.getByLabelText(/^billing name$/i), {
      target: { value: 'Beta Campus GmbH' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update school/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Alpha Campus',
        billingName: 'Beta Campus GmbH',
        address: 'Main St\n12345 Sampletown',
      })
    );
  });
});
