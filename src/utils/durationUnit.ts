/** Length of one teaching unit (Unterrichtseinheit, UE) in minutes. */
export const TEACHING_UNIT_MINUTES = 45;

export type DurationUnit = 'minutes' | 'teaching_units';

export const DURATION_UNITS: readonly DurationUnit[] = ['minutes', 'teaching_units'];

/** Allowed lesson durations per unit. */
export const DURATION_LIMITS: Record<DurationUnit, { min: number; max: number }> = {
  minutes: { min: 1, max: 9999 },
  teaching_units: { min: 0.01, max: 20 },
};

export function isDurationUnit(value: unknown): value is DurationUnit {
  return DURATION_UNITS.includes(value as DurationUnit);
}

/**
 * Normalizes a lesson duration for its unit, or returns null when it is out of range.
 * Minutes are floored to whole minutes; teaching units must already have at most 2 decimals.
 */
export function normalizeDuration(value: number, unit: DurationUnit): number | null {
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

/** Duration in minutes, rounded to 2 decimals so 3.2 UE is 144 rather than 144.00000000000003. */
export function toMinutes(duration: number, unit: DurationUnit): number {
  if (unit === 'minutes') return duration;
  return Math.round(duration * TEACHING_UNIT_MINUTES * 100) / 100;
}
