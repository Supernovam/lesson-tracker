import type { LessonFormData, LessonValidationResult } from '../types/lesson';
import type { LessonTypeFormData, LessonTypeValidationResult } from '../types/lessonType';

const MIN_DURATION = 1;
const MAX_DURATION = 9999;

/**
 * Validates lesson form data.
 * - studentName: non-empty, trimmed
 * - date: non-empty, valid date string
 * - duration: positive integer between MIN_DURATION and MAX_DURATION
 * - comment: optional (no validation)
 */
export function validateLessonForm(data: LessonFormData): LessonValidationResult {
  const errors: LessonValidationResult['errors'] = {};

  const trimmedName = data.studentName.trim();
  if (!trimmedName) {
    errors.studentName = 'Student name is required';
  }

  if (!data.date.trim()) {
    errors.date = 'Date is required';
  } else {
    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) {
      errors.date = 'Please enter a valid date';
    }
  }

  const durationNum = Number(data.duration);
  if (!Number.isInteger(durationNum) || durationNum < MIN_DURATION) {
    errors.duration = `Duration must be a positive integer (${MIN_DURATION}-${MAX_DURATION} minutes)`;
  } else if (durationNum > MAX_DURATION) {
    errors.duration = `Duration must not exceed ${MAX_DURATION} minutes`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Parses and clamps duration to a positive integer. Used for normalizing input.
 */
export function parseDuration(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    // Clamp +/-Infinity to sensible bounds.
    if (num === Infinity) return MAX_DURATION;
    return MIN_DURATION;
  }
  if (num < MIN_DURATION) return MIN_DURATION;
  if (num > MAX_DURATION) return MAX_DURATION;
  return Math.floor(num);
}

function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-8;
}

/**
 * Validates lesson type form data.
 * - name: non-empty, trimmed
 * - basePrice: finite number >= 0 with at most 2 decimal places
 * - baseDurationMinutes: positive integer between MIN_DURATION and MAX_DURATION
 */
export function validateLessonTypeForm(data: LessonTypeFormData): LessonTypeValidationResult {
  const errors: LessonTypeValidationResult['errors'] = {};

  if (!data.name.trim()) {
    errors.name = 'Name is required';
  }

  if (!Number.isFinite(data.basePrice)) {
    errors.basePrice = 'Base price is required';
  } else if (data.basePrice < 0) {
    errors.basePrice = 'Base price must be 0 or greater';
  } else if (!hasAtMostTwoDecimals(data.basePrice)) {
    errors.basePrice = 'Base price must have at most 2 decimal places';
  }

  const durationNum = Number(data.baseDurationMinutes);
  if (!Number.isInteger(durationNum) || durationNum < MIN_DURATION) {
    errors.baseDurationMinutes = `Duration must be a positive integer (${MIN_DURATION}-${MAX_DURATION} minutes)`;
  } else if (durationNum > MAX_DURATION) {
    errors.baseDurationMinutes = `Duration must not exceed ${MAX_DURATION} minutes`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
