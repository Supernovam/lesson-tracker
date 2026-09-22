import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SchoolForm } from './SchoolForm';
import type { School } from '../types/school';

const editingSchool: School = {
  id: 'school-1',
  title: 'East Campus',
  address: 'Main St\n10115 Berlin',
  createdAt: 1,
  updatedAt: 1,
};

describe('SchoolForm', () => {
  it('requires a title and an address', () => {
    render(<SchoolForm editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save school/i }));
    expect(screen.getByText('Title is required')).toBeDefined();
    expect(screen.getByText('Address is required')).toBeDefined();
  });

  it('prefills the school being edited and submits its current values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SchoolForm editing={editingSchool} onSubmit={onSubmit} onCancelEdit={vi.fn()} />);

    expect((screen.getByLabelText(/^title$/i) as HTMLInputElement).value).toBe('East Campus');
    expect((screen.getByLabelText(/^address$/i) as HTMLTextAreaElement).value).toBe(
      'Main St\n10115 Berlin'
    );

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'West Campus' } });
    fireEvent.click(screen.getByRole('button', { name: /update school/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'West Campus',
        address: 'Main St\n10115 Berlin',
      })
    );
  });
});
