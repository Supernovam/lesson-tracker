import { useState, useCallback, useEffect } from 'react';
import type React from 'react';
import { Tags } from 'lucide-react';
import type { LessonType, LessonTypeFormData } from '../types/lessonType';
import { parseDuration, validateLessonTypeForm } from '../utils/validation';
import { DURATION_LIMITS, TEACHING_UNIT_MINUTES, type DurationUnit } from '../utils/durationUnit';

interface LessonTypeFormProps {
  editing: LessonType | null;
  onSubmit: (data: LessonTypeFormData) => void | Promise<void>;
  onCancelEdit: () => void;
}

const emptyFormState: LessonTypeFormData = {
  name: '',
  basePrice: Number.NaN,
  baseDurationMinutes: 0,
  durationUnit: 'minutes',
};

const unitOptions: { value: DurationUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'teaching_units', label: 'Teaching units (UE)' },
];

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
        durationUnit: editing.durationUnit,
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

  const handleUnitChange = (unit: DurationUnit) => {
    updateField('durationUnit', unit);
    // The base duration field is hidden or shown again, so an error from an earlier submit no longer applies.
    setErrors((prev) => ({ ...prev, baseDurationMinutes: undefined }));
  };

  const isEditing = Boolean(editing);
  const isTeachingUnits = formData.durationUnit === 'teaching_units';
  const lessonCount = editing?.lessonCount ?? 0;
  const isUnitLocked = lessonCount > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-hidden focus:ring-1 focus:ring-slate-500"
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

        <fieldset className="sm:col-span-2" aria-describedby={isUnitLocked ? 'lesson-type-unit-hint' : undefined}>
          <legend className="mb-1.5 block text-sm font-medium text-slate-700">Bill by</legend>
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
            {unitOptions.map((option) => {
              const checked = formData.durationUnit === option.value;
              return (
                <label
                  key={option.value}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition has-focus-visible:ring-2 has-focus-visible:ring-slate-500 ${
                    checked ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  } ${isUnitLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="lesson-type-unit"
                    value={option.value}
                    checked={checked}
                    onChange={() => handleUnitChange(option.value)}
                    disabled={isUnitLocked}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          {isUnitLocked && (
            <p id="lesson-type-unit-hint" className="mt-1 text-sm text-slate-500">
              Used by {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}. Create a new lesson
              type to bill differently.
            </p>
          )}
        </fieldset>

        <div>
          <label htmlFor="lesson-type-price" className="mb-1.5 block text-sm font-medium text-slate-700">
            {isTeachingUnits ? 'Price per UE (€)' : 'Base price (€)'}
          </label>
          <input
            id="lesson-type-price"
            type="number"
            min={0}
            step={0.01}
            value={priceInput}
            onChange={handlePriceChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-hidden focus:ring-1 focus:ring-slate-500"
            aria-invalid={Boolean(errors.basePrice)}
            aria-describedby={errors.basePrice ? 'lesson-type-price-error' : undefined}
          />
          {errors.basePrice && (
            <p id="lesson-type-price-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.basePrice}
            </p>
          )}
          {isTeachingUnits && (
            <p className="mt-1 text-sm text-slate-500">1 UE = {TEACHING_UNIT_MINUTES} min</p>
          )}
        </div>

        {!isTeachingUnits && (
          <div>
            <label htmlFor="lesson-type-duration" className="mb-1.5 block text-sm font-medium text-slate-700">
              Base duration (minutes)
            </label>
            <input
              id="lesson-type-duration"
              type="number"
              min={DURATION_LIMITS.minutes.min}
              max={DURATION_LIMITS.minutes.max}
              step={1}
              value={durationInput}
              onChange={handleDurationChange}
              onBlur={handleDurationBlur}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-slate-500 focus:outline-hidden focus:ring-1 focus:ring-slate-500"
              aria-invalid={Boolean(errors.baseDurationMinutes)}
              aria-describedby={errors.baseDurationMinutes ? 'lesson-type-duration-error' : undefined}
            />
            {errors.baseDurationMinutes && (
              <p id="lesson-type-duration-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.baseDurationMinutes}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {submitError && (
          <p className="mb-0 w-full text-sm text-red-600" role="alert">
            {submitError}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-800 px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 focus:outline-hidden focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 sm:w-auto sm:min-w-[140px]"
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
