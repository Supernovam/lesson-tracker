import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonForm } from './LessonForm';
import type { LessonType } from '../types/lessonType';

const lessonTypes: LessonType[] = [
  {
    id: 'private',
    name: 'Private Course',
    basePrice: 19,
    baseDurationMinutes: 45,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'present',
    name: 'Present Course',
    basePrice: 63,
    baseDurationMinutes: 150,
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('LessonForm', () => {
  it('requires a lesson type', () => {
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));
    expect(screen.getByText('Lesson type is required')).toBeDefined();
  });

  it('shows a live price preview when a type and duration are set', () => {
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/19,00/);

    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '60' } });
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/25,33/);
  });

  it('submits the selected lesson type with the lesson', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: 'Went well' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Alex',
        lessonTypeId: 'present',
        duration: 150,
        comment: 'Went well',
      })
    );
  });

  it('starts with an empty duration and fills it from the chosen type', () => {
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={vi.fn()} />);
    const duration = screen.getByLabelText(/duration/i) as HTMLInputElement;
    expect(duration.value).toBe('');

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    expect(duration.value).toBe('45');

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    expect(duration.value).toBe('150');
  });

  it('clears the duration when the lesson type is deselected', () => {
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={vi.fn()} />);
    const duration = screen.getByLabelText(/duration/i) as HTMLInputElement;

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    expect(duration.value).toBe('150');

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: '' } });
    expect(duration.value).toBe('');
    expect(screen.queryByText(/estimated cost/i)).toBeNull();
  });

  it('restores the type base duration when the field is cleared and blurred', () => {
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={vi.fn()} />);
    const duration = screen.getByLabelText(/duration/i) as HTMLInputElement;

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    fireEvent.change(duration, { target: { value: '' } });
    expect(screen.queryByText(/estimated cost/i)).toBeNull();

    fireEvent.blur(duration);
    expect(duration.value).toBe('150');
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/63,00/);
  });

  it('leaves the duration empty on blur when no type is selected', () => {
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={vi.fn()} />);
    const duration = screen.getByLabelText(/duration/i) as HTMLInputElement;

    fireEvent.change(duration, { target: { value: '' } });
    fireEvent.blur(duration);

    expect(duration.value).toBe('');
  });

  it('reports an invalid duration instead of silently defaulting it', () => {
    const onSubmit = vi.fn();
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    expect(screen.getByText(/duration must be a positive integer/i)).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the chosen type but clears the student after a successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/student name/i) as HTMLInputElement).value).toBe('')
    );
    expect((screen.getByLabelText(/lesson type/i) as HTMLSelectElement).value).toBe('private');
  });

  it('restores the retained type base duration after a successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/student name/i) as HTMLInputElement).value).toBe('')
    );
    expect((screen.getByLabelText(/duration/i) as HTMLInputElement).value).toBe('150');
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/63,00/);
  });

  it('shows the server message when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('lessonTypeId is invalid'));
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    expect((await screen.findByRole('alert')).textContent).toBe('lessonTypeId is invalid');
  });

  it('disables the select and prompts for setup when no types exist', () => {
    render(<LessonForm lessonTypes={[]} onSubmit={vi.fn()} />);

    const select = screen.getByLabelText(/lesson type/i) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText(/add a lesson type first/i)).toBeDefined();
  });

  it('does not show a price preview before a type is chosen', () => {
    render(<LessonForm lessonTypes={lessonTypes} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/estimated cost/i)).toBeNull();
  });
});
