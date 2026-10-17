import type { Lesson } from '../types/lesson';

/** European date display: DD.MM.YYYY. Single formatter keeps output consistent. */
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Formats an ISO date string (YYYY-MM-DD) for display in European style (e.g. "08.03.2026").
 * Uses Intl.DateTimeFormat so the format is consistent and timezone-safe.
 */
export function formatDisplayDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z');
  if (Number.isNaN(date.getTime())) return isoDate;
  return dateFormatter.format(date);
}

/**
 * Returns today's date in YYYY-MM-DD format for the date input default.
 */
export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats duration in minutes for display (e.g. "120 min").
 */
export function formatDuration(minutes: number): string {
  return `${minutes} min`;
}

const priceFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a euro amount for display (e.g. "19,00 €").
 */
export function formatPrice(amount: number): string {
  return priceFormatter.format(amount);
}

const invoicePriceFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Invoice table amounts match the Honorarrechnung layout (e.g. "22,67€").
 */
export function formatInvoicePrice(amount: number): string {
  return `${invoicePriceFormatter.format(amount)}€`;
}

/**
 * Names a lesson in messages and accessible labels: "lesson for Alex on 03.09.2026", or
 * "lesson on 03.09.2026" when no student name was entered.
 */
export function describeLesson(lesson: { studentName: string; date: string }): string {
  const student = lesson.studentName ? ` for ${lesson.studentName}` : '';
  return `lesson${student} on ${formatDisplayDate(lesson.date)}`;
}

/** Sum of lesson prices in euros, rounded to cents; unpriced lessons count as 0. */
export function sumLessonPrices(lessons: Lesson[]): number {
  return Math.round(lessons.reduce((sum, lesson) => sum + (lesson.calculatedPrice ?? 0), 0) * 100) / 100;
}

/** Makes text safe for a download filename: strips path and reserved characters. */
export function safeFilenamePart(value: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
  return cleaned || 'school';
}
