import { useState, useCallback, useMemo } from 'react';
import type React from 'react';
import { BookOpen } from 'lucide-react';
import type { LessonFormData } from '../types/lesson';
import type { LessonType } from '../types/lessonType';
import { parseDuration, validateLessonForm } from '../utils/validation';
import { formatDuration, formatPrice, getTodayISO } from '../utils/format';
import { calculateSessionPrice } from '../utils/pricing';

interface LessonFormProps {
  lessonTypes: LessonType[];
  onSubmit: (data: LessonFormData) => void | Promise<void>;
}

/** `duration: 0` means "not set yet"; the chosen lesson type supplies the real value. */
const initialFormState: LessonFormData = {
  studentName: '',
  date: getTodayISO(),
  duration: 0,
  comment: '',
  lessonTypeId: '',
};

export function LessonForm({ lessonTypes, onSubmit }: LessonFormProps) {
  const [formData, setFormData] = useState<LessonFormData>(initialFormState);
  const [durationInput, setDurationInput] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof LessonFormData, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback(<K extends keyof LessonFormData>(field: K, value: LessonFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, [errors]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const result = validateLessonForm(formData);
      setErrors(result.errors);
      if (!result.valid) return;
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        await onSubmit(formData);
        const retainedType = lessonTypes.find((type) => type.id === formData.lessonTypeId);
        setFormData({
          ...initialFormState,
          date: getTodayISO(),
          duration: retainedType?.baseDurationMinutes ?? 0,
          lessonTypeId: formData.lessonTypeId,
        });
        setDurationInput(retainedType ? String(retainedType.baseDurationMinutes) : '');
      } catch (err) {
        if (err instanceof Error) setSubmitError(err.message);
        else setSubmitError('Failed to save lesson. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, lessonTypes, onSubmit]
  );

  const selectedType = lessonTypes.find((type) => type.id === formData.lessonTypeId) ?? null;

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDurationInput(raw);
    if (raw === '') {
      updateField('duration', 0);
      return;
    }
    const num = parseInt(raw, 10);
    if (Number.isNaN(num)) {
      updateField('duration', 0);
      return;
    }
    updateField('duration', num);
  };

  const handleDurationBlur = () => {
    const raw = durationInput.trim();
    // `Number('')` is 0, which would clamp up to 1, so treat blank as unparseable.
    const parsed = raw === '' ? Number.NaN : Number(raw);

    if (!Number.isFinite(parsed)) {
      setDurationInput(selectedType ? String(selectedType.baseDurationMinutes) : '');
      updateField('duration', selectedType?.baseDurationMinutes ?? 0);
      return;
    }

    const clamped = parseDuration(parsed);
    setDurationInput(String(clamped));
    updateField('duration', clamped);
  };

  const pricePreview = useMemo(() => {
    if (!selectedType || !Number.isInteger(formData.duration) || formData.duration < 1) {
      return null;
    }
    return calculateSessionPrice(
      formData.duration,
      selectedType.baseDurationMinutes,
      selectedType.basePrice
    );
  }, [formData.duration, selectedType]);

  const handleLessonTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    const nextType = lessonTypes.find((type) => type.id === nextId) ?? null;
    updateField('lessonTypeId', nextId);
    setDurationInput(nextType ? String(nextType.baseDurationMinutes) : '');
    updateField('duration', nextType?.baseDurationMinutes ?? 0);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby="lesson-form-title"
      noValidate
    >
      <h2 id="lesson-form-title" className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <BookOpen className="h-5 w-5 text-slate-500" aria-hidden />
        Log a lesson
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="student-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Student name
          </label>
          <input
            id="student-name"
            type="text"
            value={formData.studentName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateField('studentName', e.target.value)
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            autoComplete="name"
            aria-invalid={Boolean(errors.studentName)}
            aria-describedby={errors.studentName ? 'student-name-error' : undefined}
          />
          {errors.studentName && (
            <p id="student-name-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.studentName}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="lesson-type" className="mb-1.5 block text-sm font-medium text-slate-700">
            Lesson type
          </label>
          <select
            id="lesson-type"
            value={formData.lessonTypeId}
            onChange={handleLessonTypeChange}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            aria-invalid={Boolean(errors.lessonTypeId)}
            aria-describedby={errors.lessonTypeId ? 'lesson-type-error' : undefined}
            disabled={lessonTypes.length === 0}
          >
            <option value="">
              {lessonTypes.length === 0 ? 'Add a lesson type first' : 'Select a lesson type'}
            </option>
            {lessonTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} ({formatPrice(type.basePrice)} / {formatDuration(type.baseDurationMinutes)})
              </option>
            ))}
          </select>
          {errors.lessonTypeId && (
            <p id="lesson-type-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.lessonTypeId}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lesson-date" className="mb-1.5 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="lesson-date"
            type="date"
            value={formData.date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('date', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? 'lesson-date-error' : undefined}
          />
          {errors.date && (
            <p id="lesson-date-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.date}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lesson-duration" className="mb-1.5 block text-sm font-medium text-slate-700">
            Duration (minutes)
          </label>
          <input
            id="lesson-duration"
            type="number"
            min={1}
            max={9999}
            step={1}
            value={durationInput}
            onChange={handleDurationChange}
            onBlur={handleDurationBlur}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            aria-invalid={Boolean(errors.duration)}
            aria-describedby={errors.duration ? 'lesson-duration-error' : undefined}
          />
          {errors.duration && (
            <p id="lesson-duration-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.duration}
            </p>
          )}
        </div>

        {pricePreview != null && selectedType && (
          <p className="sm:col-span-2 text-sm text-slate-600" aria-live="polite">
            Estimated cost:{' '}
            <span className="font-medium text-slate-800">{formatPrice(pricePreview)}</span>
            {' '}({formatDuration(formData.duration)} at {formatPrice(selectedType.basePrice)} /{' '}
            {formatDuration(selectedType.baseDurationMinutes)})
          </p>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="lesson-comment" className="mb-1.5 block text-sm font-medium text-slate-700">
            Comment <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="lesson-comment"
            value={formData.comment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('comment', e.target.value)}
            rows={3}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"          />
        </div>
      </div>

      <div className="mt-6">
        {submitError && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {submitError}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-800 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 sm:w-auto sm:min-w-[140px]"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save lesson'}
        </button>
      </div>
    </form>
  );
}
