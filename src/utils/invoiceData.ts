import type { InvoiceRecipient, IssuedInvoice } from '../types/invoice';
import type { Lesson } from '../types/lesson';
import type { School } from '../types/school';
import { formatDisplayDate, formatDuration, formatInvoicePrice } from './format';
import { sortLessons } from './lessonTableData';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function calendarMonthBounds(year: number, monthIndex: number): { from: string; to: string } {
  const month = monthIndex + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function currentCalendarMonthBounds(): { from: string; to: string } {
  const now = new Date();
  return calendarMonthBounds(now.getFullYear(), now.getMonth());
}

export function filterLessonsByDateRange(lessons: Lesson[], from: string, to: string): Lesson[] {
  if (!ISO_DATE_PATTERN.test(from) || !ISO_DATE_PATTERN.test(to) || from > to) return [];
  return lessons.filter((lesson) => lesson.date >= from && lesson.date <= to);
}

export function getLessonsForInvoice(lessons: Lesson[], from: string, to: string): Lesson[] {
  return sortLessons(filterLessonsByDateRange(lessons, from, to), 'date', 'asc');
}

export function mapLessonToInvoiceRow(lesson: Lesson): [string, string, string, string, string] {
  return [
    lesson.lessonTypeName || '—',
    lesson.studentName,
    formatDisplayDate(lesson.date),
    formatDuration(lesson.duration),
    lesson.calculatedPrice == null ? '—' : formatInvoicePrice(lesson.calculatedPrice),
  ];
}

export function lessonsMissingPrice(lessons: Lesson[]): Lesson[] {
  return lessons.filter((lesson) => lesson.calculatedPrice == null);
}

export function sumLessonPrices(lessons: Lesson[]): number {
  return Math.round(lessons.reduce((sum, lesson) => sum + (lesson.calculatedPrice ?? 0), 0) * 100) / 100;
}

export function constrainInvoiceFrom(from: string, to: string): string {
  if (ISO_DATE_PATTERN.test(from) && ISO_DATE_PATTERN.test(to) && from > to) return to;
  return from;
}

export function constrainInvoiceTo(from: string, to: string): string {
  if (ISO_DATE_PATTERN.test(from) && ISO_DATE_PATTERN.test(to) && to < from) return from;
  return to;
}

export function recipientAddressLines(address: string): string[] {
  return address.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim());
}

export type SchoolInvoice = {
  recipient: InvoiceRecipient;
  lessons: Lesson[];
};

export function partitionInvoicesBySchool(lessons: Lesson[], schools: School[]): {
  invoices: SchoolInvoice[];
  missingSchool: Lesson[];
  unknownSchool: Lesson[];
} {
  const schoolsById = new Map(schools.map((school) => [school.id, school]));
  const grouped = new Map<string, Lesson[]>();
  const missingSchool: Lesson[] = [];
  const unknownSchool: Lesson[] = [];

  for (const lesson of lessons) {
    if (!lesson.schoolId) {
      missingSchool.push(lesson);
      continue;
    }
    const school = schoolsById.get(lesson.schoolId);
    if (!school) {
      unknownSchool.push(lesson);
      continue;
    }
    const group = grouped.get(school.id) ?? [];
    group.push(lesson);
    grouped.set(school.id, group);
  }

  const invoices = [...grouped.entries()]
    .flatMap(([schoolId, groupLessons]) => {
      const school = schoolsById.get(schoolId);
      if (!school) return [];
      return [
        {
          recipient: {
            schoolId,
            title: school.title,
            billingName: school.billingName,
            addressLines: recipientAddressLines(school.address),
          },
          lessons: groupLessons,
        },
      ];
    })
    .sort((a, b) => a.recipient.title.localeCompare(b.recipient.title, undefined, { sensitivity: 'base' }));

  return { invoices, missingSchool, unknownSchool };
}

export function canDownloadInvoices(lessons: Lesson[], schools: School[]): boolean {
  if (!canExportInvoice(lessons)) return false;
  const { missingSchool, unknownSchool } = partitionInvoicesBySchool(lessons, schools);
  return missingSchool.length === 0 && unknownSchool.length === 0;
}

function safeFilenamePart(value: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
  return cleaned || 'school';
}

export function invoiceFilename(schoolTitle: string, from: string, to: string): string {
  const title = safeFilenamePart(schoolTitle);
  if (!ISO_DATE_PATTERN.test(from) || !ISO_DATE_PATTERN.test(to)) return `Honorarrechnung-${title}.pdf`;
  return `Honorarrechnung-${title}-${from}-to-${to}.pdf`;
}

export function canExportInvoice(lessons: Lesson[]): boolean {
  return lessons.length > 0 && lessonsMissingPrice(lessons).length === 0;
}

/** Rechnungsnummer as printed: `{nn}/{yy}`, e.g. `12/26` or `01/27`. */
export function formatInvoiceNumber(number: number, year: number): string {
  return `${String(number).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
}

export type PlannedInvoiceNumber = {
  schoolId: string;
  title: string;
  label: string;
};

/**
 * Numbers an Issue click would assign: schools in the period without an issued number,
 * in school-title order (the order `partitionInvoicesBySchool` returns), from `nextNumber`.
 */
export function planInvoiceNumbers(
  invoices: SchoolInvoice[],
  issued: IssuedInvoice[],
  nextNumber: number,
  year: number
): PlannedInvoiceNumber[] {
  const issuedSchoolIds = new Set(issued.map((entry) => entry.schoolId));
  return invoices
    .filter((invoice) => !issuedSchoolIds.has(invoice.recipient.schoolId))
    .map((invoice, index) => ({
      schoolId: invoice.recipient.schoolId,
      title: invoice.recipient.title,
      label: formatInvoiceNumber(nextNumber + index, year),
    }));
}
