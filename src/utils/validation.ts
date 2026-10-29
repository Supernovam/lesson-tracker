import type { LessonFormData, LessonValidationResult } from '../types/lesson';
import type { LessonTypeFormData, LessonTypeValidationResult } from '../types/lessonType';
import type { SchoolFormData, SchoolValidationResult } from '../types/school';
import { DURATION_LIMITS, normalizeDuration, roundToUnit, type DurationUnit } from './durationUnit';
import { formatUnitCountInput } from './format';

const { min: MIN_DURATION, max: MAX_DURATION } = DURATION_LIMITS.minutes;
const { min: MIN_UNITS, max: MAX_UNITS } = DURATION_LIMITS.teaching_units;

/** `unit` is the selected lesson type's: teaching units allow decimals, minutes do not. */
export function validateLessonForm(
  data: LessonFormData,
  unit: DurationUnit = 'minutes'
): LessonValidationResult {
  const errors: LessonValidationResult['errors'] = {};

  if (!data.date.trim()) {
    errors.date = 'Date is required';
  } else {
    const date = new Date(data.date);
    if (Number.isNaN(date.getTime())) {
      errors.date = 'Please enter a valid date';
    }
  }

  const durationNum = Number(data.duration);
  if (unit === 'teaching_units') {
    if (normalizeDuration(durationNum, unit) == null) {
      errors.duration = `Duration must be between ${formatUnitCountInput(MIN_UNITS)} and ${MAX_UNITS} UE, with at most 2 decimals`;
    }
  } else if (!Number.isInteger(durationNum) || durationNum < MIN_DURATION) {
    errors.duration = `Duration must be a positive integer (${MIN_DURATION}-${MAX_DURATION} minutes)`;
  } else if (durationNum > MAX_DURATION) {
    errors.duration = `Duration must not exceed ${MAX_DURATION} minutes`;
  }

  if (!data.lessonTypeId.trim()) {
    errors.lessonTypeId = 'Lesson type is required';
  }

  if (!data.schoolId.trim()) {
    errors.schoolId = 'School is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Parses and clamps a duration into its unit's range: whole minutes, or teaching units
 * rounded to 2 decimals. Used for normalizing input.
 */
export function parseDuration(value: unknown, unit: DurationUnit = 'minutes'): number {
  const { min, max } = DURATION_LIMITS[unit];
  const num = Number(value);
  if (!Number.isFinite(num)) {
    // Clamp +/-Infinity to sensible bounds.
    if (num === Infinity) return max;
    return min;
  }
  return Math.min(Math.max(roundToUnit(num, unit), min), max);
}

/** Reads a typed decimal such as "3,2" or "3.2"; blank or malformed input gives NaN. */
export function parseDecimalInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return Number.NaN;
  return Number(trimmed.replace(',', '.'));
}

function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-8;
}

/**
 * Validates lesson type form data.
 * - name: non-empty, trimmed
 * - basePrice: finite number >= 0 with at most 2 decimal places
 * - baseDurationMinutes: positive integer between MIN_DURATION and MAX_DURATION (minutes types only)
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

  // A teaching-unit type has no base duration to enter: it is priced per UE.
  const durationNum = Number(data.baseDurationMinutes);
  const isMinutes = data.durationUnit === 'minutes';
  if (isMinutes && (!Number.isInteger(durationNum) || durationNum < MIN_DURATION)) {
    errors.baseDurationMinutes = `Duration must be a positive integer (${MIN_DURATION}-${MAX_DURATION} minutes)`;
  } else if (isMinutes && durationNum > MAX_DURATION) {
    errors.baseDurationMinutes = `Duration must not exceed ${MAX_DURATION} minutes`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateSchoolForm(data: SchoolFormData): SchoolValidationResult {
  const errors: SchoolValidationResult['errors'] = {};

  if (!data.title.trim()) {
    errors.title = 'Title is required';
  }

  if (!data.billingName.trim()) {
    errors.billingName = 'Billing name is required';
  }

  if (!data.address.trim()) {
    errors.address = 'Address is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
