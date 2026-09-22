import { useState, useCallback, useEffect } from 'react';
import type React from 'react';
import { School as SchoolIcon } from 'lucide-react';
import type { School, SchoolFormData } from '../types/school';
import { validateSchoolForm } from '../utils/validation';

interface SchoolFormProps {
  editing: School | null;
  onSubmit: (data: SchoolFormData) => void | Promise<void>;
  onCancelEdit: () => void;
}

const emptyFormState: SchoolFormData = {
  title: '',
  address: '',
};

export function SchoolForm({ editing, onSubmit, onCancelEdit }: SchoolFormProps) {
  const [formData, setFormData] = useState<SchoolFormData>(emptyFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof SchoolFormData, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editing) {
      setFormData({ title: editing.title, address: editing.address });
    } else {
      setFormData(emptyFormState);
    }
    setErrors({});
    setSubmitError(null);
  }, [editing]);

  const updateField = useCallback(<K extends keyof SchoolFormData>(
    field: K,
    value: SchoolFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, [errors]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const result = validateSchoolForm(formData);
      setErrors(result.errors);
      if (!result.valid) return;
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        await onSubmit(formData);
        if (!editing) setFormData(emptyFormState);
      } catch (err) {
        if (err instanceof Error) setSubmitError(err.message);
        else setSubmitError('Failed to save school. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [editing, formData, onSubmit]
  );

  const isEditing = Boolean(editing);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby="school-form-title"
      noValidate
    >
      <h2 id="school-form-title" className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <SchoolIcon className="h-5 w-5 text-slate-500" aria-hidden />
        {isEditing ? 'Edit school' : 'Add a school'}
      </h2>

      <div className="grid gap-5">
        <div>
          <label htmlFor="school-title" className="mb-1.5 block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="school-title"
            type="text"
            value={formData.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('title', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="e.g. East Campus"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'school-title-error' : undefined}
          />
          {errors.title && (
            <p id="school-title-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="school-address" className="mb-1.5 block text-sm font-medium text-slate-700">
            Address
          </label>
          <textarea
            id="school-address"
            value={formData.address}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('address', e.target.value)}
            rows={3}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder={'Street\nPostal code and city'}
            aria-invalid={Boolean(errors.address)}
            aria-describedby={errors.address ? 'school-address-error' : undefined}
          />
          {errors.address && (
            <p id="school-address-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.address}
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
          {isSubmitting ? 'Saving...' : isEditing ? 'Update school' : 'Save school'}
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
