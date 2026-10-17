import { describe, it, expect } from 'vitest';
import { calculateSessionPrice } from './pricing';

describe('calculateSessionPrice', () => {
  it('calculates a proportional price rounded to 2 decimals', () => {
    expect(calculateSessionPrice(60, 45, 28)).toBe(37.33);
  });

  it('returns the base price when duration matches the base duration', () => {
    expect(calculateSessionPrice(150, 150, 50)).toBe(50);
  });

  it('returns 0 when actual duration is 0', () => {
    expect(calculateSessionPrice(0, 45, 28)).toBe(0);
  });

  it('throws when base duration is not positive', () => {
    expect(() => calculateSessionPrice(60, 0, 28)).toThrow(/baseDurationMinutes/);
    expect(() => calculateSessionPrice(60, -45, 28)).toThrow(/baseDurationMinutes/);
  });

  it('throws when base price is negative', () => {
    expect(() => calculateSessionPrice(60, 45, -1)).toThrow(/basePrice/);
  });
});
