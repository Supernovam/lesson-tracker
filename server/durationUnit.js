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

  if (unit === 'teaching_units') {
    const rounded = Math.round(value * 100) / 100;
    if (Math.abs(value - rounded) > 1e-8) return null;
    return rounded >= min && rounded <= max ? rounded : null;
  }

  const whole = Math.floor(value);
  return whole >= min && whole <= max ? whole : null;
}

export function durationRangeError(unit) {
  const { min, max } = DURATION_LIMITS[unit];
  return unit === 'teaching_units'
    ? `duration must be between ${min} and ${max} teaching units with at most 2 decimal places`
    : `duration must be an integer between ${min} and ${max}`;
}
