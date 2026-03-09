import { useState, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import type { LessonFormData } from '../types/lesson';
import { validateLessonForm } from '../utils/validation';
import { getTodayISO } from '../utils/format';

const DEFAULT_DURATION = 120;

interface LessonFormProps {
  onSubmit: (data: LessonFormData) => void;
}

const initialFormState: LessonFormData = {
  studentName: '',
  date: getTodayISO(),
  duration: DEFAULT_DURATION,
  comment: '',
};

export function LessonForm({ onSubmit }: LessonFormProps) {
  const [formData, setFormData] = useState<LessonFormData>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof LessonFormData, string>>>({});

  const updateField = useCallback(<K extends keyof LessonFormData>(field: K, value: LessonFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, [errors]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const result = validateLessonForm(formData);
      setErrors(result.errors);
      if (!result.valid) return;
      onSubmit(formData);
      setFormData({
        ...initialFormState,
        date: getTodayISO(),
        duration: DEFAULT_DURATION,
      });
    },
    [formData, onSubmit]
  );

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      updateField('duration', DEFAULT_DURATION);
      return;
    }
    const num = parseInt(raw, 10);
    if (!Number.isNaN(num) && num >= 0) {
      updateField('duration', num > 0 ? num : DEFAULT_DURATION);
    }
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
            onChange={(e) => updateField('studentName', e.target.value)}
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

        <div>
          <label htmlFor="lesson-date" className="mb-1.5 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="lesson-date"
            type="date"
            value={formData.date}
            onChange={(e) => updateField('date', e.target.value)}
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
            value={formData.duration}
            onChange={handleDurationChange}
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

        <div className="sm:col-span-2">
          <label htmlFor="lesson-comment" className="mb-1.5 block text-sm font-medium text-slate-700">
            Comment <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="lesson-comment"
            value={formData.comment}
            onChange={(e) => updateField('comment', e.target.value)}
            rows={3}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"          />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-800 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 sm:w-auto sm:min-w-[140px]"
        >
          Save lesson
        </button>
      </div>
    </form>
  );
}
