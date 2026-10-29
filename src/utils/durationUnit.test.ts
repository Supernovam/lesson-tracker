import { describe, expect, it } from 'vitest';
import {
  DURATION_LIMITS,
  DURATION_UNITS,
  TEACHING_UNIT_MINUTES,
  isDurationUnit,
  baseQuantity,
  normalizeDuration,
  roundToUnit,
  toMinutes,
  type DurationUnit,
} from './durationUnit';

describe('duration unit constants', () => {
  it('fixes one teaching unit at 45 minutes', () => {
    expect(TEACHING_UNIT_MINUTES).toBe(45);
  });

  it('defines limits for every unit', () => {
    expect(DURATION_UNITS).toEqual(['minutes', 'teaching_units']);
    expect(Object.keys(DURATION_LIMITS).sort()).toEqual([...DURATION_UNITS].sort());
  });
});

describe('isDurationUnit', () => {
  it.each(['minutes', 'teaching_units'])('accepts %s', (unit) => {
    expect(isDurationUnit(unit)).toBe(true);
  });

  it.each(['hours', 'Minutes', '', null, undefined, 45])('rejects %j', (value) => {
    expect(isDurationUnit(value)).toBe(false);
  });
});

describe('normalizeDuration in minutes', () => {
  it.each([
    [1, 1],
    [60, 60],
    [9999, 9999],
    [60.9, 60],
  ])('turns %j into %j', (value, expected) => {
    expect(normalizeDuration(value, 'minutes')).toBe(expected);
  });

  it.each([0, 0.5, -5, 10000, Number.NaN, Infinity])('rejects %j', (value) => {
    expect(normalizeDuration(value, 'minutes')).toBeNull();
  });
});

describe('normalizeDuration in teaching units', () => {
  it.each([
    [0.01, 0.01],
    [1, 1],
    [3.2, 3.2],
    [1.75, 1.75],
    [20, 20],
  ])('keeps %j', (value, expected) => {
    expect(normalizeDuration(value, 'teaching_units')).toBe(expected);
  });

  it('absorbs floating-point noise within two decimals', () => {
    expect(normalizeDuration(0.1 + 0.2, 'teaching_units')).toBe(0.3);
  });

  it.each([1.755, 0.001])('rejects %j for having more than 2 decimals', (value) => {
    expect(normalizeDuration(value, 'teaching_units')).toBeNull();
  });

  it.each([0, -1, 20.01, Number.NaN, -Infinity])('rejects %j as out of range', (value) => {
    expect(normalizeDuration(value, 'teaching_units')).toBeNull();
  });
});

describe('toMinutes', () => {
  it('passes minutes through', () => {
    expect(toMinutes(145, 'minutes')).toBe(145);
  });

  it.each([
    [1, 45],
    [2, 90],
    [3.2, 144],
    [1.75, 78.75],
    [0.01, 0.45],
  ])('converts %j UE to %j minutes', (units, minutes) => {
    expect(toMinutes(units, 'teaching_units')).toBe(minutes);
  });
});

describe('roundToUnit', () => {
  it.each<[number, DurationUnit, number]>([
    [60.9, 'minutes', 60],
    [1.755, 'teaching_units', 1.76],
    [3.2, 'teaching_units', 3.2],
  ])('rounds %j %s to %j', (value, unit, expected) => {
    expect(roundToUnit(value, unit)).toBe(expected);
  });
});

describe('baseQuantity', () => {
  it('is the base minutes of a minutes type', () => {
    expect(baseQuantity('minutes', 150)).toBe(150);
  });

  it('is one unit for a teaching-unit type', () => {
    expect(baseQuantity('teaching_units', 45)).toBe(1);
  });
});
