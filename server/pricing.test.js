import { describe, it, expect } from 'vitest';
import { calculateLessonPrice, calculateSessionPrice } from './pricing.js';

describe('calculateSessionPrice', () => {
  it('calculates a proportional price rounded to 2 decimals', () => {
    expect(calculateSessionPrice(60, 45, 28)).toBe(37.33);
  });

  it('throws when the actual duration is negative or not finite', () => {
    expect(() => calculateSessionPrice(-1, 45, 28)).toThrow(/actualDurationMinutes/);
    expect(() => calculateSessionPrice(Number.NaN, 45, 28)).toThrow(/actualDurationMinutes/);
  });

  it('throws when base duration is not positive', () => {
    expect(() => calculateSessionPrice(60, 0, 28)).toThrow(/baseDurationMinutes/);
  });

  it('throws when base price is negative', () => {
    expect(() => calculateSessionPrice(60, 45, -1)).toThrow(/basePrice/);
  });
});

describe('calculateLessonPrice', () => {
  const perMinuteType = { baseDurationMinutes: 45, basePrice: 28 };
  const perUnitType = { baseDurationMinutes: 45, basePrice: 32 };

  it('prices minutes proportionally to the base duration', () => {
    expect(calculateLessonPrice(60, 'minutes', perMinuteType)).toBe(37.33);
  });

  it.each([
    [1, 32],
    [3.2, 102.4],
    [1.75, 56],
    [0.01, 0.32],
  ])('charges the base price per teaching unit (%j UE)', (units, expected) => {
    expect(calculateLessonPrice(units, 'teaching_units', perUnitType)).toBe(expected);
  });

  it('ignores the base duration for teaching units', () => {
    expect(calculateLessonPrice(2, 'teaching_units', { baseDurationMinutes: 60, basePrice: 30 })).toBe(60);
  });

  it('still rejects a negative price', () => {
    expect(() => calculateLessonPrice(1, 'teaching_units', { baseDurationMinutes: 45, basePrice: -1 })).toThrow(
      /basePrice/
    );
  });
});
