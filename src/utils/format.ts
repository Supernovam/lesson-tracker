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
