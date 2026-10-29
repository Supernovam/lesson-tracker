/** Length of one teaching unit (Unterrichtseinheit, UE) in minutes. */
export const TEACHING_UNIT_MINUTES = 45;

export const DURATION_UNITS = ['minutes', 'teaching_units'];

/** Allowed lesson durations per unit. */
export const DURATION_LIMITS = {
  minutes: { min: 1, max: 9999 },
  teaching_units: { min: 0.01, max: 20 },
};

export function isDurationUnit(value) {
  return DURATION_UNITS.includes(value);
}

/**
 * Normalizes a lesson duration for its unit, or returns null when it is out of range.
 * Minutes are floored to whole minutes; teaching units must already have at most 2 decimals.
 */
export function normalizeDuration(value, unit) {
  if (!Number.isFinite(value)) return null;
  const { min, max } = DURATION_LIMITS[unit];
  const rounded = roundToUnit(value, unit);
  if (unit === 'teaching_units' && Math.abs(value - rounded) > 1e-8) return null;
  return rounded >= min && rounded <= max ? rounded : null;
}

/** Precision of a duration: whole minutes (floored), or teaching units to 2 decimals. */
export function roundToUnit(value, unit) {
  return unit === 'teaching_units' ? Math.round(value * 100) / 100 : Math.floor(value);
}

/** What a lesson type's base price buys: its base minutes, or one teaching unit. */
export function baseQuantity(unit, baseDurationMinutes) {
  return unit === 'teaching_units' ? 1 : baseDurationMinutes;
}

export function durationRangeError(unit) {
  const { min, max } = DURATION_LIMITS[unit];
  return unit === 'teaching_units'
    ? `duration must be between ${min} and ${max} teaching units with at most 2 decimal places`
    : `duration must be an integer between ${min} and ${max}`;
}
