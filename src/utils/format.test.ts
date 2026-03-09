import { describe, it, expect, vi } from 'vitest';
import { formatDisplayDate, getTodayISO, formatDuration } from './format';

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
});
