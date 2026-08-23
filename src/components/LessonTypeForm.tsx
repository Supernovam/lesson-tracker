import { useState, useCallback, useEffect } from 'react';
import type React from 'react';
import { Tags } from 'lucide-react';
import type { LessonType, LessonTypeFormData } from '../types/lessonType';
import { parseDuration, validateLessonTypeForm } from '../utils/validation';

interface LessonTypeFormProps {
  editing: LessonType | null;
  onSubmit: (data: LessonTypeFormData) => void | Promise<void>;
  onCancelEdit: () => void;
}

const emptyFormState: LessonTypeFormData = {
  name: '',
  basePrice: Number.NaN,
  baseDurationMinutes: 0,
};

export function LessonTypeForm({ editing, onSubmit, onCancelEdit }: LessonTypeFormProps) {
  const [formData, setFormData] = useState<LessonTypeFormData>(emptyFormState);
  const [priceInput, setPriceInput] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof LessonTypeFormData, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editing) {
      setFormData({
        name: editing.name,
        basePrice: editing.basePrice,
        baseDurationMinutes: editing.baseDurationMinutes,
      });
      setPriceInput(String(editing.basePrice));
      setDurationInput(String(editing.baseDurationMinutes));
    } else {
      setFormData(emptyFormState);
      setPriceInput('');
      setDurationInput('');
    }
    setErrors({});
    setSubmitError(null);
  }, [editing]);

  const updateField = useCallback(<K extends keyof LessonTypeFormData>(
    field: K,
    value: LessonTypeFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, [errors]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const result = validateLessonTypeForm(formData);
      setErrors(result.errors);
      if (!result.valid) return;
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        await onSubmit(formData);
        if (!editing) {
          setFormData(emptyFormState);
          setPriceInput('');
          setDurationInput('');
        }
      } catch (err) {
        if (err instanceof Error) setSubmitError(err.message);
        else setSubmitError('Failed to save lesson type. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [editing, formData, onSubmit]
  );

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setPriceInput(raw);
    if (raw.trim() === '') {
      updateField('basePrice', Number.NaN);
      return;
    }
    updateField('basePrice', Number(raw));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDurationInput(raw);
    if (raw === '') {
      updateField('baseDurationMinutes', 0);
      return;
    }
    const num = parseInt(raw, 10);
    if (Number.isNaN(num)) {
      updateField('baseDurationMinutes', 0);
      return;
    }
    updateField('baseDurationMinutes', num);
  };

  const handleDurationBlur = () => {
    const raw = durationInput.trim();
    if (raw === '') return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = parseDuration(parsed);
    setDurationInput(String(clamped));
    updateField('baseDurationMinutes', clamped);
  };

  const isEditing = Boolean(editing);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby="lesson-type-form-title"
      noValidate
    >
      <h2 id="lesson-type-form-title" className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <Tags className="h-5 w-5 text-slate-500" aria-hidden />
        {isEditing ? 'Edit lesson type' : 'Add a lesson type'}
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="lesson-type-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="lesson-type-name"
            type="text"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('name', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="e.g. Private Course"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'lesson-type-name-error' : undefined}
          />
          {errors.name && (
            <p id="lesson-type-name-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lesson-type-price" className="mb-1.5 block text-sm font-medium text-slate-700">
            Base price (€)
          </label>
          <input
            id="lesson-type-price"
            type="number"
            min={0}
            step={0.01}
            value={priceInput}
            onChange={handlePriceChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            aria-invalid={Boolean(errors.basePrice)}
            aria-describedby={errors.basePrice ? 'lesson-type-price-error' : undefined}
          />
          {errors.basePrice && (
            <p id="lesson-type-price-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.basePrice}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lesson-type-duration" className="mb-1.5 block text-sm font-medium text-slate-700">
            Base duration (minutes)
          </label>
          <input
            id="lesson-type-duration"
            type="number"
            min={1}
            max={9999}
            step={1}
            value={durationInput}
            onChange={handleDurationChange}
            onBlur={handleDurationBlur}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            aria-invalid={Boolean(errors.baseDurationMinutes)}
            aria-describedby={errors.baseDurationMinutes ? 'lesson-type-duration-error' : undefined}
          />
          {errors.baseDurationMinutes && (
            <p id="lesson-type-duration-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.baseDurationMinutes}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {submitError && (
          <p className="mb-0 w-full text-sm text-red-600" role="alert">
            {submitError}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-800 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 sm:w-auto sm:min-w-[140px]"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update lesson type' : 'Save lesson type'}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
