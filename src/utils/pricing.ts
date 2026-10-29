import type { DurationUnit } from './durationUnit';

/**
 * Proportional session price: (actual duration / base duration) * base price,
 * rounded to 2 decimal places.
 */
export function calculateSessionPrice(
  actualDurationMinutes: number,
  baseDurationMinutes: number,
  basePrice: number
): number {
  if (!Number.isFinite(actualDurationMinutes) || actualDurationMinutes < 0) {
    throw new Error('actualDurationMinutes must be a finite number greater than or equal to 0');
  }
  if (!Number.isFinite(baseDurationMinutes) || baseDurationMinutes <= 0) {
    throw new Error('baseDurationMinutes must be a finite number greater than 0');
  }
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error('basePrice must be a finite number greater than or equal to 0');
  }

  return Math.round((actualDurationMinutes / baseDurationMinutes) * basePrice * 100) / 100;
}

/**
 * Price of a lesson in its duration unit. Teaching-unit types charge `basePrice` per UE,
 * so the duration is priced against one unit rather than converted to minutes.
 */
export function calculateLessonPrice(
  duration: number,
  durationUnit: DurationUnit,
  lessonType: { basePrice: number; baseDurationMinutes: number }
): number {
  const baseDuration = durationUnit === 'teaching_units' ? 1 : lessonType.baseDurationMinutes;
  return calculateSessionPrice(duration, baseDuration, lessonType.basePrice);
}
