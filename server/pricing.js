/**
 * Proportional session price: (actual duration / base duration) * base price,
 * rounded to 2 decimal places.
 */
export function calculateSessionPrice(
  actualDurationMinutes,
  baseDurationMinutes,
  basePrice
) {
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
