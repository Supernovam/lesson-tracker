import { describe, it, expect } from 'vitest';
import { calculateSessionPrice } from './pricing.js';

describe('calculateSessionPrice', () => {
  it('calculates a proportional price rounded to 2 decimals', () => {
    expect(calculateSessionPrice(60, 45, 19)).toBe(25.33);
  });
});
