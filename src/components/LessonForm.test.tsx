import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonForm } from './LessonForm';
import type { Lesson } from '../types/lesson';
import type { LessonType } from '../types/lessonType';
import type { School } from '../types/school';

const lessonTypes: LessonType[] = [
  {
    id: 'private',
    name: 'Private Course',
    basePrice: 28,
    baseDurationMinutes: 45,
    durationUnit: 'minutes',
    lessonCount: 0,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'present',
    name: 'Present Course',
    basePrice: 50,
    baseDurationMinutes: 150,
    durationUnit: 'minutes',
    lessonCount: 0,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'group',
    name: 'Group Course',
    basePrice: 32,
    baseDurationMinutes: 45,
    durationUnit: 'teaching_units',
    lessonCount: 0,
    createdAt: 1,
    updatedAt: 1,
  },
];

const schools: School[] = [
  {
    id: 'alpha',
    title: 'Alpha Campus',
    billingName: 'Alpha Campus GmbH',
    address: 'Main St\n12345 Sampletown',
    createdAt: 1,
    updatedAt: 1,
  },
];

const editingLesson: Lesson = {
  id: 'lesson-1',
  studentName: 'Alex',
  date: '2026-03-08',
  duration: 60,
  durationUnit: 'minutes',
  comment: 'Went well',
  createdAt: 1,
  lessonTypeId: 'private',
  lessonTypeName: 'Private Course',
  schoolId: 'alpha',
  schoolTitle: 'Alpha Campus',
  calculatedPrice: 37.33,
};

describe('LessonForm', () => {
  it('requires a lesson type', () => {
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));
    expect(screen.getByText('Lesson type is required')).toBeDefined();
  });

  it('saves a lesson without a student name', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={onSubmit} />);

    expect(screen.getByText(/^student name/i, { selector: 'label' }).textContent).toMatch(/\(optional\)/);
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    fireEvent.change(screen.getByLabelText(/^school$/i), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ studentName: '', lessonTypeId: 'private' }));
    expect(screen.queryByText(/student name is required/i)).toBeNull();
  });

  it('shows a live price preview when a type and duration are set', () => {
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/28,00/);

    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '60' } });
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/37,33/);
  });

  it('submits the selected lesson type with the lesson', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    fireEvent.change(screen.getByLabelText(/^school$/i), { target: { value: 'alpha' } });
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: 'Went well' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Alex',
        lessonTypeId: 'present',
        schoolId: 'alpha',
        duration: 150,
        comment: 'Went well',
      })
    );
  });

  it('starts with an empty duration and fills it from the chosen type', () => {
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={vi.fn()} />);
    const duration = screen.getByLabelText(/duration/i) as HTMLInputElement;
    expect(duration.value).toBe('');

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    expect(duration.value).toBe('45');

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    expect(duration.value).toBe('150');
  });

  it('clears the duration when the lesson type is deselected', () => {
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={vi.fn()} />);
    const duration = screen.getByLabelText(/duration/i) as HTMLInputElement;

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    expect(duration.value).toBe('150');

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: '' } });
    expect(duration.value).toBe('');
    expect(screen.queryByText(/estimated cost/i)).toBeNull();
  });

  it('restores the type base duration when the field is cleared and blurred', () => {
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={vi.fn()} />);
    const duration = screen.getByLabelText(/duration/i) as HTMLInputElement;

    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    fireEvent.change(duration, { target: { value: '' } });
    expect(screen.queryByText(/estimated cost/i)).toBeNull();

    fireEvent.blur(duration);
    expect(duration.value).toBe('150');
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/50,00/);
  });

  it('leaves the duration empty on blur when no type is selected', () => {
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={vi.fn()} />);
    const duration = screen.getByLabelText(/duration/i) as HTMLInputElement;

    fireEvent.change(duration, { target: { value: '' } });
    fireEvent.blur(duration);

    expect(duration.value).toBe('');
  });

  it('reports an invalid duration instead of silently defaulting it', () => {
    const onSubmit = vi.fn();
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    expect(screen.getByText(/duration must be a positive integer/i)).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the chosen type but clears the student after a successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    fireEvent.change(screen.getByLabelText(/^school$/i), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/student name/i) as HTMLInputElement).value).toBe('')
    );
    expect((screen.getByLabelText(/lesson type/i) as HTMLSelectElement).value).toBe('private');
    expect((screen.getByLabelText(/^school$/i) as HTMLSelectElement).value).toBe('alpha');
  });

  it('restores the retained type base duration after a successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });
    fireEvent.change(screen.getByLabelText(/^school$/i), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/student name/i) as HTMLInputElement).value).toBe('')
    );
    expect((screen.getByLabelText(/duration/i) as HTMLInputElement).value).toBe('150');
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/50,00/);
  });

  it('shows the server message when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('lessonTypeId is invalid'));
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'private' } });
    fireEvent.change(screen.getByLabelText(/^school$/i), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

    expect((await screen.findByRole('alert')).textContent).toBe('lessonTypeId is invalid');
  });

  it('requires a school before an existing lesson can be saved', () => {
    const onSubmit = vi.fn();
    render(
      <LessonForm
        lessonTypes={lessonTypes}
        schools={schools}
        editing={{ ...editingLesson, schoolId: null, schoolTitle: null }}
        onSubmit={onSubmit}
        onCancelEdit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /update lesson/i }));
    expect(screen.getByText('School is required')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the school select when no schools exist', () => {
    render(<LessonForm lessonTypes={lessonTypes} schools={[]} onSubmit={vi.fn()} />);
    const select = screen.getByLabelText(/^school$/i) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText(/add a school first/i)).toBeDefined();
  });

  it('disables the select and prompts for setup when no types exist', () => {
    render(<LessonForm lessonTypes={[]} schools={schools} onSubmit={vi.fn()} />);

    const select = screen.getByLabelText(/lesson type/i) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText(/add a lesson type first/i)).toBeDefined();
  });

  it('does not show a price preview before a type is chosen', () => {
    render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/estimated cost/i)).toBeNull();
  });

  it('prefills the lesson being edited and submits its current values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <LessonForm
        lessonTypes={lessonTypes} schools={schools}
        editing={editingLesson}
        onSubmit={onSubmit}
        onCancelEdit={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /edit lesson/i })).toBeDefined();
    expect((screen.getByLabelText(/student name/i) as HTMLInputElement).value).toBe('Alex');
    expect((screen.getByLabelText(/lesson type/i) as HTMLSelectElement).value).toBe('private');
    expect((screen.getByLabelText(/^date$/i) as HTMLInputElement).value).toBe('2026-03-08');
    expect((screen.getByLabelText(/duration/i) as HTMLInputElement).value).toBe('60');
    expect((screen.getByLabelText(/comment/i) as HTMLTextAreaElement).value).toBe('Went well');
    expect(screen.getByText(/estimated cost/i).textContent).toMatch(/37,33/);

    fireEvent.change(screen.getByLabelText(/student name/i), { target: { value: 'Alex B' } });
    fireEvent.click(screen.getByRole('button', { name: /update lesson/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Alex B',
        lessonTypeId: 'private',
        schoolId: 'alpha',
        duration: 60,
        date: '2026-03-08',
        comment: 'Went well',
      })
    );
    expect((screen.getByLabelText(/student name/i) as HTMLInputElement).value).toBe('Alex B');
  });

  it('calls onCancelEdit and returns to an empty log form', () => {
    const onCancelEdit = vi.fn();
    const { rerender } = render(
      <LessonForm
        lessonTypes={lessonTypes} schools={schools}
        editing={{ ...editingLesson, comment: '' }}
        onSubmit={vi.fn()}
        onCancelEdit={onCancelEdit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancelEdit).toHaveBeenCalled();

    rerender(<LessonForm lessonTypes={lessonTypes} schools={schools} editing={null} onSubmit={vi.fn()} onCancelEdit={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /log a lesson/i })).toBeDefined();
    expect((screen.getByLabelText(/student name/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/duration/i) as HTMLInputElement).value).toBe('');
  });

  describe('teaching units', () => {
    const durationField = () => screen.getByLabelText(/duration/i) as HTMLInputElement;
    const groupLesson: Lesson = {
      ...editingLesson,
      lessonTypeId: 'group',
      lessonTypeName: 'Group Course',
      duration: 3.2,
      durationUnit: 'teaching_units',
      calculatedPrice: 102.4,
    };

    /** Renders the log form with the teaching-unit type and a school already chosen. */
    function renderGroupCourse(onSubmit = vi.fn()) {
      render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={onSubmit} />);
      fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'group' } });
      fireEvent.change(screen.getByLabelText(/^school$/i), { target: { value: 'alpha' } });
      return onSubmit;
    }

    it('lists the type at its price per UE', () => {
      render(<LessonForm lessonTypes={lessonTypes} schools={schools} onSubmit={vi.fn()} />);
      expect(screen.getByRole('option', { name: /group course/i }).textContent).toMatch(/32,00\s€ \/ 1 UE/);
    });

    it('starts at one UE with its minutes and price', () => {
      renderGroupCourse();

      expect(screen.getByText('Duration (UE)')).toBeDefined();
      expect(durationField().value).toBe('1');
      expect(durationField().type).toBe('text');
      expect(durationField().inputMode).toBe('decimal');
      expect(screen.getByText('= 45 min')).toBeDefined();
      expect(screen.getByText(/estimated cost/i).textContent).toMatch(/32,00\s€ \(1 UE at 32,00\s€ \/ 1 UE\)/);
    });

    it('prices a decimal entered with a comma', () => {
      renderGroupCourse();
      fireEvent.change(durationField(), { target: { value: '3,2' } });

      expect(screen.getByText('= 144 min')).toBeDefined();
      expect(screen.getByText(/estimated cost/i).textContent).toMatch(/102,40\s€ \(3,2 UE at/);
    });

    it('marks minutes that are not whole as approximate', () => {
      renderGroupCourse();
      fireEvent.change(durationField(), { target: { value: '1.75' } });

      expect(screen.getByText('≈ 79 min')).toBeDefined();
    });

    it.each([
      ['1,755', '1,76'],
      ['25', '20'],
      ['0', '0,01'],
      ['abc', '1'],
      ['', '1'],
    ])('normalizes %j to %j on blur', (typed, shown) => {
      renderGroupCourse();
      fireEvent.change(durationField(), { target: { value: typed } });
      fireEvent.blur(durationField());

      expect(durationField().value).toBe(shown);
    });

    it('hides the minutes and price for a duration it cannot accept', () => {
      renderGroupCourse();
      fireEvent.change(durationField(), { target: { value: '1,755' } });

      expect(screen.queryByText(/min$/)).toBeNull();
      expect(screen.queryByText(/estimated cost/i)).toBeNull();
    });

    it('rejects a duration with more than 2 decimals on submit', () => {
      const onSubmit = renderGroupCourse();
      fireEvent.change(durationField(), { target: { value: '1,755' } });
      fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

      expect(screen.getByText('Duration must be between 0,01 and 20 UE, with at most 2 decimals')).toBeDefined();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits the UE count and starts the next lesson at one UE', async () => {
      const onSubmit = renderGroupCourse(vi.fn().mockResolvedValue(undefined));
      fireEvent.change(durationField(), { target: { value: '3,2' } });
      fireEvent.click(screen.getByRole('button', { name: /save lesson/i }));

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ lessonTypeId: 'group', duration: 3.2 }))
      );
      await waitFor(() => expect(durationField().value).toBe('1'));
    });

    it('switches to the base minutes when a minutes type is chosen', () => {
      renderGroupCourse();
      fireEvent.change(screen.getByLabelText(/lesson type/i), { target: { value: 'present' } });

      expect(screen.getByText('Duration (minutes)')).toBeDefined();
      expect(durationField().value).toBe('150');
      expect(durationField().type).toBe('number');
      expect(durationField().inputMode).toBe('numeric');
      expect(screen.queryByText(/= \d+ min/)).toBeNull();
    });

    it('prefills a teaching-unit lesson being edited', () => {
      render(<LessonForm lessonTypes={lessonTypes} schools={schools} editing={groupLesson} onSubmit={vi.fn()} />);

      expect(screen.getByText('Duration (UE)')).toBeDefined();
      expect(durationField().value).toBe('3,2');
    });

    it('keeps an edited lesson in UE while the lesson types are still loading', () => {
      render(<LessonForm lessonTypes={[]} schools={schools} editing={groupLesson} onSubmit={vi.fn()} />);
      fireEvent.blur(durationField());

      expect(screen.getByText('Duration (UE)')).toBeDefined();
      expect(durationField().type).toBe('text');
      expect(durationField().value).toBe('3,2');
    });
  });
});
