import { describe, it, expect } from 'vitest';
import {
  validateLessonForm,
  validateLessonTypeForm,
  validateSchoolForm,
  parseDecimalInput,
  parseDuration,
} from './validation';

const validLesson = {
  studentName: 'Alex Smith',
  date: '2025-03-08',
  duration: 120,
  comment: 'Great progress',
  lessonTypeId: 'type-1',
  schoolId: 'school-1',
};

describe('validateLessonForm', () => {
  const validData = validLesson;

  it('returns valid for correct data', () => {
    const result = validateLessonForm(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it.each(['', '   \t  '])('accepts an empty student name (%j)', (studentName) => {
    const result = validateLessonForm({ ...validData, studentName });
    expect(result.valid).toBe(true);
    expect(result.errors.studentName).toBeUndefined();
  });

  it('returns error when date is empty', () => {
    const result = validateLessonForm({ ...validData, date: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.date).toBe('Date is required');
  });

  it('returns error when date is invalid', () => {
    const result = validateLessonForm({ ...validData, date: 'not-a-date' });
    expect(result.valid).toBe(false);
    expect(result.errors.date).toBe('Please enter a valid date');
  });

  it('returns error when duration is zero', () => {
    const result = validateLessonForm({ ...validData, duration: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.duration).toContain('positive integer');
  });

  it('returns error when duration is negative', () => {
    const result = validateLessonForm({ ...validData, duration: -5 });
    expect(result.valid).toBe(false);
    expect(result.errors.duration).toBeDefined();
  });

  it('returns error when duration is not an integer', () => {
    const result = validateLessonForm({ ...validData, duration: 45.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.duration).toBeDefined();
  });

  it('returns error when duration exceeds max', () => {
    const result = validateLessonForm({ ...validData, duration: 10000 });
    expect(result.valid).toBe(false);
    expect(result.errors.duration).toContain('9999');
  });

  it('accepts valid comment as optional (empty)', () => {
    const result = validateLessonForm({ ...validData, comment: '' });
    expect(result.valid).toBe(true);
  });

  it('returns error when lesson type is missing', () => {
    const result = validateLessonForm({ ...validData, lessonTypeId: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.lessonTypeId).toBe('Lesson type is required');
  });

  it('returns error when school is missing', () => {
    const result = validateLessonForm({ ...validData, schoolId: '  ' });
    expect(result.valid).toBe(false);
    expect(result.errors.schoolId).toBe('School is required');
  });
});

describe('validateLessonForm in teaching units', () => {
  const validData = { ...validLesson, duration: 3.2 };

  it.each([0.01, 1, 3.2, 1.75, 20])('accepts %j UE', (duration) => {
    expect(validateLessonForm({ ...validData, duration }, 'teaching_units').valid).toBe(true);
  });

  it.each([0, -1, 1.755, 20.01, Number.NaN])('rejects %j UE', (duration) => {
    const result = validateLessonForm({ ...validData, duration }, 'teaching_units');
    expect(result.valid).toBe(false);
    expect(result.errors.duration).toBe('Duration must be between 0,01 and 20 UE, with at most 2 decimals');
  });

  it('still requires whole minutes for a minutes type', () => {
    expect(validateLessonForm(validData, 'minutes').errors.duration).toMatch(/positive integer/);
    expect(validateLessonForm(validData).errors.duration).toMatch(/positive integer/);
  });
});

describe('parseDuration', () => {
  it('returns 1 for values below 1', () => {
    expect(parseDuration(0)).toBe(1);
    expect(parseDuration(-10)).toBe(1);
    expect(parseDuration(0.5)).toBe(1);
  });

  it('returns floor of valid number', () => {
    expect(parseDuration(120)).toBe(120);
    expect(parseDuration(45.9)).toBe(45);
  });

  it('clamps to 9999 for values above max', () => {
    expect(parseDuration(10000)).toBe(9999);
    expect(parseDuration(99999)).toBe(9999);
  });

  it('returns 1 for non-finite or NaN', () => {
    expect(parseDuration(NaN)).toBe(1);
    expect(parseDuration(Infinity)).toBe(9999);
  });
});

describe('parseDuration in teaching units', () => {
  it.each([
    [3.2, 3.2],
    [1.755, 1.76],
    [1.754, 1.75],
    [0, 0.01],
    [-2, 0.01],
    [25, 20],
    [Infinity, 20],
    [Number.NaN, 0.01],
  ])('turns %j into %j', (value, expected) => {
    expect(parseDuration(value, 'teaching_units')).toBe(expected);
  });
});

describe('parseDecimalInput', () => {
  it.each([
    ['3,2', 3.2],
    ['3.2', 3.2],
    [' 1,75 ', 1.75],
    ['20', 20],
  ])('reads %j as %j', (raw, expected) => {
    expect(parseDecimalInput(raw)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1,2,3'])('gives NaN for %j', (raw) => {
    expect(parseDecimalInput(raw)).toBeNaN();
  });
});

describe('validateLessonTypeForm', () => {
  const validData = {
    name: 'Private Course',
    basePrice: 28,
    baseDurationMinutes: 45,
    durationUnit: 'minutes' as const,
  };

  it('returns valid for correct data', () => {
    const result = validateLessonTypeForm(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('returns error when name is empty or whitespace', () => {
    expect(validateLessonTypeForm({ ...validData, name: '' }).errors.name).toBe('Name is required');
    expect(validateLessonTypeForm({ ...validData, name: '   ' }).errors.name).toBe('Name is required');
  });

  it('returns error when base price is missing', () => {
    const result = validateLessonTypeForm({ ...validData, basePrice: Number.NaN });
    expect(result.valid).toBe(false);
    expect(result.errors.basePrice).toBe('Base price is required');
  });

  it('returns error when base price is negative', () => {
    const result = validateLessonTypeForm({ ...validData, basePrice: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors.basePrice).toBe('Base price must be 0 or greater');
  });

  it('returns error when base price has more than 2 decimal places', () => {
    const result = validateLessonTypeForm({ ...validData, basePrice: 28.999 });
    expect(result.valid).toBe(false);
    expect(result.errors.basePrice).toBe('Base price must have at most 2 decimal places');
  });

  it('accepts a zero base price', () => {
    const result = validateLessonTypeForm({ ...validData, basePrice: 0 });
    expect(result.valid).toBe(true);
  });

  it('does not check the base duration of a teaching-unit type', () => {
    const result = validateLessonTypeForm({ ...validData, durationUnit: 'teaching_units', baseDurationMinutes: 0 });
    expect(result.valid).toBe(true);
  });

  it('still checks the price of a teaching-unit type', () => {
    const result = validateLessonTypeForm({ ...validData, durationUnit: 'teaching_units', basePrice: -1 });
    expect(result.errors.basePrice).toBe('Base price must be 0 or greater');
  });

  it('returns error when duration is invalid', () => {
    expect(validateLessonTypeForm({ ...validData, baseDurationMinutes: 0 }).valid).toBe(false);
    expect(validateLessonTypeForm({ ...validData, baseDurationMinutes: 45.5 }).valid).toBe(false);
    expect(validateLessonTypeForm({ ...validData, baseDurationMinutes: 10000 }).errors.baseDurationMinutes)
      .toContain('9999');
  });
});

describe('validateSchoolForm', () => {
  it('returns valid for a title, billing name, and address', () => {
    const result = validateSchoolForm({
      title: 'Alpha Campus',
      billingName: 'Alpha Campus GmbH',
      address: 'Main St\n12345 Sampletown',
    });
    expect(result.valid).toBe(true);
  });

  it('requires a title, billing name, and address', () => {
    const result = validateSchoolForm({ title: '  ', billingName: '\n', address: '\n' });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBe('Title is required');
    expect(result.errors.billingName).toBe('Billing name is required');
    expect(result.errors.address).toBe('Address is required');
  });
});
