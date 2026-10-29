import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonTypeForm } from './LessonTypeForm';
import type { LessonType } from '../types/lessonType';

const editingType: LessonType = {
  id: 'type-1',
  name: 'Private Course',
  basePrice: 28,
  baseDurationMinutes: 45,
  durationUnit: 'minutes',
  lessonCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

const radio = (name: RegExp) => screen.getByRole('radio', { name }) as HTMLInputElement;

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
    expect((screen.getByLabelText(/base price/i) as HTMLInputElement).value).toBe('28');
    expect((screen.getByLabelText(/base duration/i) as HTMLInputElement).value).toBe('45');

    fireEvent.click(screen.getByRole('button', { name: /update lesson type/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Private Course',
        basePrice: 28,
        baseDurationMinutes: 45,
        durationUnit: 'minutes',
      });
    });
  });

  it('calls onCancelEdit', () => {
    const onCancelEdit = vi.fn();
    render(<LessonTypeForm editing={editingType} onSubmit={vi.fn()} onCancelEdit={onCancelEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancelEdit).toHaveBeenCalled();
  });

  it('bills by the minute by default', () => {
    render(<LessonTypeForm editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);

    expect(radio(/minutes/i).checked).toBe(true);
    expect(screen.getByLabelText(/base price/i)).toBeDefined();
    expect(screen.getByLabelText(/base duration/i)).toBeDefined();
    expect(screen.queryByText(/1 UE = 45 min/)).toBeNull();
  });

  it('creates a teaching-unit type priced per UE without a base duration', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LessonTypeForm editing={null} onSubmit={onSubmit} onCancelEdit={vi.fn()} />);

    fireEvent.click(radio(/teaching units/i));
    expect(screen.queryByLabelText(/base duration/i)).toBeNull();
    expect(screen.getByText('1 UE = 45 min')).toBeDefined();

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Group Course' } });
    fireEvent.change(screen.getByLabelText(/price per ue/i), { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson type/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Group Course', basePrice: 32, durationUnit: 'teaching_units' })
      )
    );
  });

  it('asks for a base duration again after switching back to minutes', () => {
    const onSubmit = vi.fn();
    render(<LessonTypeForm editing={null} onSubmit={onSubmit} onCancelEdit={vi.fn()} />);

    fireEvent.click(radio(/teaching units/i));
    fireEvent.click(radio(/minutes/i));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Private Course' } });
    fireEvent.change(screen.getByLabelText(/base price/i), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson type/i }));

    expect(screen.getByText(/duration must be a positive integer/i)).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prefills the unit of a teaching-unit type being edited', () => {
    render(
      <LessonTypeForm
        editing={{ ...editingType, name: 'Group Course', durationUnit: 'teaching_units' }}
        onSubmit={vi.fn()}
        onCancelEdit={vi.fn()}
      />
    );

    expect(radio(/teaching units/i).checked).toBe(true);
    expect(screen.getByLabelText(/price per ue/i)).toBeDefined();
  });

  it.each([
    [1, 'Used by 1 lesson.'],
    [3, 'Used by 3 lessons.'],
  ])('locks the unit of a type used by %i lesson(s)', (lessonCount, hint) => {
    render(
      <LessonTypeForm editing={{ ...editingType, lessonCount }} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />
    );

    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLInputElement).disabled).toBe(true);
    }
    expect(screen.getByText(new RegExp(hint)).textContent).toMatch(/create a new lesson type/i);
  });

  it('leaves the unit editable while no lessons use the type', () => {
    render(<LessonTypeForm editing={editingType} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);

    expect(radio(/teaching units/i).disabled).toBe(false);
    expect(screen.queryByText(/used by/i)).toBeNull();
  });

  it.each([
    ['12000', '9999'],
    ['0', '1'],
    ['90.7', '90'],
  ])('clamps a typed base duration of %j to %j on blur', (typed, shown) => {
    render(<LessonTypeForm editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    const duration = screen.getByLabelText(/base duration/i) as HTMLInputElement;

    fireEvent.change(duration, { target: { value: typed } });
    fireEvent.blur(duration);

    expect(duration.value).toBe(shown);
  });

  it('leaves a blank base duration blank on blur and requires it on submit', () => {
    render(<LessonTypeForm editing={editingType} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    const duration = screen.getByLabelText(/base duration/i) as HTMLInputElement;

    fireEvent.change(duration, { target: { value: '' } });
    fireEvent.blur(duration);
    fireEvent.click(screen.getByRole('button', { name: /update lesson type/i }));

    expect(duration.value).toBe('');
    expect(screen.getByText(/duration must be a positive integer/i)).toBeDefined();
  });

  it('requires a price again after it is cleared', () => {
    render(<LessonTypeForm editing={editingType} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/base price/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /update lesson type/i }));

    expect(screen.getByText('Base price is required')).toBeDefined();
  });

  it('clears a field error once the field is edited', () => {
    render(<LessonTypeForm editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save lesson type/i }));
    expect(screen.getByText('Name is required')).toBeDefined();

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Group Course' } });

    expect(screen.queryByText('Name is required')).toBeNull();
  });

  it.each([
    ['the server message', new Error('A lesson type with this name already exists'), /already exists/],
    ['a fallback message', 'offline', /failed to save lesson type/i],
  ])('shows %s when saving fails', async (_case, failure, expected) => {
    const onSubmit = vi.fn().mockRejectedValue(failure);
    render(<LessonTypeForm editing={editingType} onSubmit={onSubmit} onCancelEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /update lesson type/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(expected);
  });

  it('drops a base duration error once the unit changes', () => {
    render(<LessonTypeForm editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /save lesson type/i }));
    expect(screen.getByText(/duration must be a positive integer/i)).toBeDefined();

    fireEvent.click(radio(/teaching units/i));
    fireEvent.click(radio(/minutes/i));

    expect(screen.queryByText(/duration must be a positive integer/i)).toBeNull();
  });
});
