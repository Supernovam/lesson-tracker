import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonTypeForm } from './LessonTypeForm';
import type { LessonType } from '../types/lessonType';

const editingType: LessonType = {
  id: 'type-1',
  name: 'Private Course',
  basePrice: 19,
  baseDurationMinutes: 45,
  createdAt: 1,
  updatedAt: 1,
};

describe('LessonTypeForm', () => {
  it('shows create copy by default', () => {
    render(<LessonTypeForm editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /add a lesson type/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /save lesson type/i })).toBeDefined();
  });

  it('shows validation errors for an empty submit', () => {
    render(<LessonTypeForm editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save lesson type/i }));
    expect(screen.getByText('Name is required')).toBeDefined();
    expect(screen.getByText('Base price is required')).toBeDefined();
  });

  it('prefills fields when editing and submits updates', async () => {
    const onSubmit = vi.fn();
    render(<LessonTypeForm editing={editingType} onSubmit={onSubmit} onCancelEdit={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /edit lesson type/i })).toBeDefined();
    expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe('Private Course');
    expect((screen.getByLabelText(/base price/i) as HTMLInputElement).value).toBe('19');
    expect((screen.getByLabelText(/base duration/i) as HTMLInputElement).value).toBe('45');

    fireEvent.click(screen.getByRole('button', { name: /update lesson type/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Private Course',
        basePrice: 19,
        baseDurationMinutes: 45,
      });
    });
  });

  it('calls onCancelEdit', () => {
    const onCancelEdit = vi.fn();
    render(<LessonTypeForm editing={editingType} onSubmit={vi.fn()} onCancelEdit={onCancelEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancelEdit).toHaveBeenCalled();
  });
});
