import { describe, it, expect } from 'vitest';
import { validateLessonForm, validateLessonTypeForm, parseDuration } from './validation';

describe('validateLessonForm', () => {
  const validData = {
    studentName: 'Alex Smith',
    date: '2025-03-08',
    duration: 120,
    comment: 'Great progress',
    lessonTypeId: 'type-1',
  };

  it('returns valid for correct data', () => {
    const result = validateLessonForm(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('returns error when student name is empty', () => {
    const result = validateLessonForm({ ...validData, studentName: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.studentName).toBe('Student name is required');
  });

  it('returns error when student name is only whitespace', () => {
    const result = validateLessonForm({ ...validData, studentName: '   \t  ' });
    expect(result.valid).toBe(false);
    expect(result.errors.studentName).toBe('Student name is required');
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

describe('validateLessonTypeForm', () => {
  const validData = {
    name: 'Private Course',
    basePrice: 19,
    baseDurationMinutes: 45,
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
    const result = validateLessonTypeForm({ ...validData, basePrice: 19.999 });
    expect(result.valid).toBe(false);
    expect(result.errors.basePrice).toBe('Base price must have at most 2 decimal places');
  });

  it('accepts a zero base price', () => {
    const result = validateLessonTypeForm({ ...validData, basePrice: 0 });
    expect(result.valid).toBe(true);
  });

  it('returns error when duration is invalid', () => {
    expect(validateLessonTypeForm({ ...validData, baseDurationMinutes: 0 }).valid).toBe(false);
    expect(validateLessonTypeForm({ ...validData, baseDurationMinutes: 45.5 }).valid).toBe(false);
    expect(validateLessonTypeForm({ ...validData, baseDurationMinutes: 10000 }).errors.baseDurationMinutes)
      .toContain('9999');
  });
});
