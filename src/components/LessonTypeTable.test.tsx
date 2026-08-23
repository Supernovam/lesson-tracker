import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonTypeTable } from './LessonTypeTable';
import type { LessonType } from '../types/lessonType';

const createLessonType = (overrides: Partial<LessonType>): LessonType => ({
  id: crypto.randomUUID(),
  name: 'Private Course',
  basePrice: 19,
  baseDurationMinutes: 45,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('LessonTypeTable', () => {
  it('shows empty state when there are no lesson types', () => {
    render(<LessonTypeTable lessonTypes={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('status', { name: /no lesson types recorded/i })).toBeDefined();
    expect(screen.getByText(/no lesson types yet/i)).toBeDefined();
  });

  it('renders lesson types with price and duration', () => {
    render(
      <LessonTypeTable
        lessonTypes={[createLessonType({ id: '1', name: 'Present Course', basePrice: 63, baseDurationMinutes: 150 })]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Present Course')).toBeDefined();
    expect(screen.getByText('150 min')).toBeDefined();
    expect(screen.getByText(/^63,00\s€$/)).toBeDefined();
  });

  it('calls onEdit and onDelete for a row', () => {
    const lessonType = createLessonType({ id: 'type-1', name: 'Private Course' });
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<LessonTypeTable lessonTypes={[lessonType]} onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /edit private course/i }));
    expect(onEdit).toHaveBeenCalledWith(lessonType);

    fireEvent.click(screen.getByRole('button', { name: /delete private course/i }));
    expect(onDelete).toHaveBeenCalledWith('type-1');
  });
});
