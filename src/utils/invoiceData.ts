import type { InvoiceRecipient, IssuedInvoice } from '../types/invoice';
import type { Lesson } from '../types/lesson';
import type { School } from '../types/school';
import { formatDisplayDate, formatDuration, formatInvoicePrice, safeFilenamePart } from './format';
import { filterLessonsByDateRange, isIsoDate } from './dateRange';
import { sortLessons } from './lessonTableData';

export function getLessonsForInvoice(lessons: Lesson[], from: string, to: string): Lesson[] {
  return sortLessons(filterLessonsByDateRange(lessons, from, to), 'date', 'asc');
}

export function mapLessonToInvoiceRow(lesson: Lesson): [string, string, string, string, string] {
  return [
    lesson.lessonTypeName || '—',
    lesson.studentName || '—',
    formatDisplayDate(lesson.date),
    formatDuration(lesson.duration, lesson.durationUnit),
    lesson.calculatedPrice == null ? '—' : formatInvoicePrice(lesson.calculatedPrice),
  ];
}

export function lessonsMissingPrice(lessons: Lesson[]): Lesson[] {
  return lessons.filter((lesson) => lesson.calculatedPrice == null);
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

/**
 * Whether one school's invoice can be downloaded or issued on its own: its lessons are all
 * priced, and no lesson in the period lacks a known school (that lesson could belong to it).
 */
export function canDownloadSchoolInvoice(
  invoice: SchoolInvoice,
  unassigned: { missingSchool: Lesson[]; unknownSchool: Lesson[] }
): boolean {
  return (
    canExportInvoice(invoice.lessons) &&
    unassigned.missingSchool.length === 0 &&
    unassigned.unknownSchool.length === 0
  );
}

export function invoiceFilename(schoolTitle: string, from: string, to: string): string {
  const title = safeFilenamePart(schoolTitle);
  if (!isIsoDate(from) || !isIsoDate(to)) return `Honorarrechnung-${title}.pdf`;
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
