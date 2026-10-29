import { describe, it, expect, vi } from 'vitest';
import { describeLesson, formatDisplayDate, safeFilenamePart, sumLessonPrices, getTodayISO, formatDuration, formatPrice, formatInvoicePrice, formatBaseDuration, formatUnitCountInput } from './format';

describe('formatDisplayDate', () => {
  it('formats YYYY-MM-DD to European style DD.MM.YYYY', () => {
    expect(formatDisplayDate('2025-03-08')).toBe('08.03.2025');
  });

  it('returns original string for invalid date', () => {
    expect(formatDisplayDate('invalid')).toBe('invalid');
  });

  it('handles end of year', () => {
    expect(formatDisplayDate('2024-12-31')).toBe('31.12.2024');
  });
});

describe('getTodayISO', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = getTodayISO();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
  });

  it('returns date in YYYY-MM-DD when system time is set', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-08T15:00:00'));
    const iso = getTodayISO();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(iso).toBe('2025-03-08');
    vi.useRealTimers();
  });
});

describe('formatDuration', () => {
  it('appends " min" to number', () => {
    expect(formatDuration(120)).toBe('120 min');
    expect(formatDuration(1)).toBe('1 min');
  });

  it('appends " min" when the unit is minutes', () => {
    expect(formatDuration(145, 'minutes')).toBe('145 min');
  });

  it.each([
    [3.2, '3,2 UE'],
    [1.75, '1,75 UE'],
    [2, '2 UE'],
    [0.01, '0,01 UE'],
    [12.5, '12,5 UE'],
  ])('shows %j teaching units with a German decimal comma', (units, expected) => {
    expect(formatDuration(units, 'teaching_units')).toBe(expected);
  });
});

describe('formatUnitCountInput', () => {
  it.each([
    [3.2, '3,2'],
    [1.75, '1,75'],
    [1, '1'],
    [20, '20'],
  ])('formats %j for the duration field as %j', (units, expected) => {
    expect(formatUnitCountInput(units)).toBe(expected);
  });
});

describe('formatBaseDuration', () => {
  it('shows the base minutes of a minutes type', () => {
    expect(formatBaseDuration({ baseDurationMinutes: 150, durationUnit: 'minutes' })).toBe('150 min');
  });

  it('shows one unit for a teaching-unit type', () => {
    expect(formatBaseDuration({ baseDurationMinutes: 45, durationUnit: 'teaching_units' })).toBe('1 UE');
  });
});

describe('formatPrice', () => {
  it('formats euro amounts with exactly two decimals', () => {
    expect(formatPrice(28)).toBe('28,00\u00A0€');
    expect(formatPrice(37.33)).toBe('37,33\u00A0€');
    expect(formatPrice(50)).toBe('50,00\u00A0€');
  });
});

describe('formatInvoicePrice', () => {
  it('formats euro amounts without a space before the symbol', () => {
    expect(formatInvoicePrice(28)).toBe('28,00€');
    expect(formatInvoicePrice(37.33)).toBe('37,33€');
    expect(formatInvoicePrice(1519)).toBe('1.519,00€');
  });
});

describe('describeLesson', () => {
  it('names the student and date', () => {
    expect(describeLesson({ studentName: 'Alex', date: '2026-09-03' })).toBe('lesson for Alex on 03.09.2026');
  });

  it('leaves out the student when there is no name', () => {
    expect(describeLesson({ studentName: '', date: '2026-09-03' })).toBe('lesson on 03.09.2026');
  });
});

describe('sumLessonPrices', () => {
  it('adds prices to the cent and counts unpriced lessons as 0', () => {
    const lesson = (calculatedPrice: number | null) => ({ calculatedPrice }) as Parameters<typeof sumLessonPrices>[0][number];
    expect(sumLessonPrices([lesson(11.67), lesson(50), lesson(null)])).toBe(61.67);
    expect(sumLessonPrices([lesson(0.1), lesson(0.2)])).toBe(0.3);
  });
});

describe('safeFilenamePart', () => {
  it('replaces reserved characters and collapses whitespace', () => {
    expect(safeFilenamePart('  Alpha/Campus:  Nord ')).toBe('Alpha-Campus- Nord');
    expect(safeFilenamePart('   ')).toBe('school');
  });
});
