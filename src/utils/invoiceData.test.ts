import { describe, expect, it } from 'vitest';
import {
  formatInvoiceNumber,
  planInvoiceNumbers,
  canExportInvoice,
  getLessonsForInvoice,
  invoiceFilename,
  lessonsMissingPrice,
  mapLessonToInvoiceRow,
  canDownloadSchoolInvoice,
  partitionInvoicesBySchool,
  recipientAddressLines,
} from './invoiceData';
import { FAKE_SCHOOL, createLesson } from '../test/invoiceFixtures';

describe('filter and sort for a billed period', () => {
  it('keeps lessons from the start date through the end date, including across months', () => {
    const lessons = [
      createLesson({ id: 'before', date: '2026-08-24' }),
      createLesson({ id: 'aug', date: '2026-08-25' }),
      createLesson({ id: 'sep-late', date: '2026-09-21', createdAt: 2 }),
      createLesson({ id: 'sep-early', date: '2026-09-03', createdAt: 1 }),
      createLesson({ id: 'after', date: '2026-09-25' }),
    ];

    expect(
      getLessonsForInvoice(lessons, '2026-08-25', '2026-09-24').map((lesson) => lesson.id)
    ).toEqual(['aug', 'sep-early', 'sep-late']);
  });

  it('returns no lessons when the range is inverted or invalid', () => {
    expect(getLessonsForInvoice([createLesson()], '2026-09-30', '2026-09-01')).toEqual([]);
    expect(getLessonsForInvoice([createLesson()], '9', '2026-09-30')).toEqual([]);
  });
});

describe('export guards and totals', () => {
  it('blocks export when any lesson is missing a price', () => {
    const lessons = [
      createLesson({ id: 'priced', calculatedPrice: 56 }),
      createLesson({ id: 'missing', calculatedPrice: null }),
    ];
    expect(lessonsMissingPrice(lessons)).toHaveLength(1);
    expect(canExportInvoice(lessons)).toBe(false);
  });

  it('allows export when every lesson has a price', () => {
    const lessons = [
      createLesson({ id: 'a', calculatedPrice: 11.67 }),
      createLesson({ id: 'b', calculatedPrice: 50 }),
    ];
    expect(canExportInvoice(lessons)).toBe(true);
  });

  it('does not allow export when the period is empty', () => {
    expect(canExportInvoice([])).toBe(false);
  });
});

describe('mapLessonToInvoiceRow', () => {
  it('shows an em dash in the Name cell when the lesson has no student', () => {
    expect(mapLessonToInvoiceRow(createLesson({ studentName: '' }))[1]).toBe('—');
  });

  it('formats Honorarrechnung cells, using an em dash when the price is missing', () => {
    expect(
      mapLessonToInvoiceRow(
        createLesson({
          lessonTypeName: 'Type B',
          studentName: 'Alex',
          date: '2026-09-03',
          duration: 90,
          calculatedPrice: 56,
        })
      )
    ).toEqual(['Type B', 'Alex', '03.09.2026', '90 min', '56,00€']);
    expect(mapLessonToInvoiceRow(createLesson({ calculatedPrice: null }))[4]).toBe('—');
  });

  it('shows a teaching-unit lesson in UE', () => {
    const row = mapLessonToInvoiceRow(
      createLesson({ duration: 3.2, durationUnit: 'teaching_units', calculatedPrice: 102.4 })
    );
    expect(row[3]).toBe('3,2 UE');
    expect(row[4]).toBe('102,40€');
  });
});

describe('invoice filenames', () => {
  it('uses the school title and the billed from and to dates', () => {
    expect(invoiceFilename('Alpha Campus', '2026-08-25', '2026-09-24')).toBe(
      'Honorarrechnung-Alpha Campus-2026-08-25-to-2026-09-24.pdf'
    );
  });

  it('falls back when a date is not ISO', () => {
    expect(invoiceFilename('Alpha Campus', 'August', '2026-09-24')).toBe('Honorarrechnung-Alpha Campus.pdf');
  });
});

describe('school invoices', () => {
  const beta = {
    ...FAKE_SCHOOL,
    id: 'school-beta',
    title: 'Beta Campus',
    billingName: 'Beta Campus GmbH',
    address: 'Other Str. 9\n12345 Sampletown',
  };

  it('prints the address as one line per line break', () => {
    expect(recipientAddressLines('Client Str. 2\n54321 Client City')).toEqual([
      'Client Str. 2',
      '54321 Client City',
    ]);
  });

  it('builds one invoice per school and keeps lesson order', () => {
    const lessons = [
      createLesson({ id: 'alpha-late', date: '2026-09-10', schoolId: FAKE_SCHOOL.id }),
      createLesson({ id: 'beta', date: '2026-09-02', schoolId: beta.id, schoolTitle: beta.title }),
      createLesson({ id: 'alpha-early', date: '2026-09-01', schoolId: FAKE_SCHOOL.id }),
    ];

    const { invoices, missingSchool, unknownSchool } = partitionInvoicesBySchool(lessons, [
      beta,
      FAKE_SCHOOL,
    ]);

    expect(missingSchool).toEqual([]);
    expect(unknownSchool).toEqual([]);
    expect(invoices.map((invoice) => invoice.recipient.title)).toEqual(['Alpha Campus', 'Beta Campus']);
    expect(invoices[0].lessons.map((lesson) => lesson.id)).toEqual(['alpha-late', 'alpha-early']);
    expect(invoices[0].recipient.addressLines).toEqual(['Client Str. 2', '54321 Client City']);
    expect(invoices[1].recipient.billingName).toBe('Beta Campus GmbH');
  });

  it('separates lessons with no school from lessons whose school is missing', () => {
    const lessons = [
      createLesson({ id: 'none', schoolId: null, schoolTitle: null }),
      createLesson({ id: 'gone', schoolId: 'school-missing', schoolTitle: 'Gone' }),
      createLesson({ id: 'alpha' }),
    ];

    const { invoices, missingSchool, unknownSchool } = partitionInvoicesBySchool(lessons, [FAKE_SCHOOL]);

    expect(invoices.map((invoice) => invoice.lessons[0].id)).toEqual(['alpha']);
    expect(missingSchool.map((lesson) => lesson.id)).toEqual(['none']);
    expect(unknownSchool.map((lesson) => lesson.id)).toEqual(['gone']);
  });

  it('allows one school invoice while another school has an unpriced lesson', () => {
    const partition = partitionInvoicesBySchool(
      [
        createLesson({ id: 'alpha', schoolId: FAKE_SCHOOL.id, calculatedPrice: null }),
        createLesson({ id: 'beta', schoolId: beta.id, schoolTitle: beta.title }),
      ],
      [FAKE_SCHOOL, beta]
    );
    const [alphaInvoice, betaInvoice] = partition.invoices;

    expect(canDownloadSchoolInvoice(alphaInvoice, partition)).toBe(false);
    expect(canDownloadSchoolInvoice(betaInvoice, partition)).toBe(true);
  });

  it.each([
    ['no school', createLesson({ id: 'stray', schoolId: null, schoolTitle: null })],
    ['an unknown school', createLesson({ id: 'stray', schoolId: 'school-missing', schoolTitle: 'Gone' })],
  ])('blocks every school invoice while a lesson has %s', (_label, stray) => {
    const partition = partitionInvoicesBySchool([createLesson({ id: 'alpha' }), stray], [FAKE_SCHOOL]);

    expect(canDownloadSchoolInvoice(partition.invoices[0], partition)).toBe(false);
  });
});

describe('invoice numbers', () => {
  const beta = { ...FAKE_SCHOOL, id: 'school-beta', title: 'Beta Campus', billingName: 'Beta Campus GmbH' };
  const north = { ...FAKE_SCHOOL, id: 'school-north', title: 'North Campus', billingName: 'North Campus GmbH' };
  const issued = (schoolId: string, number: number) => ({
    schoolId,
    from: '2026-09-01',
    to: '2026-09-30',
    year: 2026,
    number,
    issuedOn: '2026-10-01',
  });

  it('formats {nn}/{yy} with a two-digit number', () => {
    expect(formatInvoiceNumber(12, 2026)).toBe('12/26');
    expect(formatInvoiceNumber(1, 2027)).toBe('01/27');
    expect(formatInvoiceNumber(3, 2005)).toBe('03/05');
    expect(formatInvoiceNumber(104, 2026)).toBe('104/26');
  });

  it('plans consecutive numbers in school title order', () => {
    const { invoices } = partitionInvoicesBySchool(
      [
        createLesson({ id: 'w', schoolId: beta.id }),
        createLesson({ id: 'e', schoolId: FAKE_SCHOOL.id }),
      ],
      [beta, FAKE_SCHOOL, north]
    );

    expect(planInvoiceNumbers(invoices, [], 10, 2026)).toEqual([
      { schoolId: FAKE_SCHOOL.id, title: 'Alpha Campus', label: '10/26' },
      { schoolId: beta.id, title: 'Beta Campus', label: '11/26' },
    ]);
  });

  it('skips schools without lessons and schools already issued for the period', () => {
    const { invoices } = partitionInvoicesBySchool(
      [
        createLesson({ id: 'e', schoolId: FAKE_SCHOOL.id }),
        createLesson({ id: 'w', schoolId: beta.id }),
      ],
      [FAKE_SCHOOL, beta, north]
    );

    expect(planInvoiceNumbers(invoices, [issued(FAKE_SCHOOL.id, 10)], 11, 2026)).toEqual([
      { schoolId: beta.id, title: 'Beta Campus', label: '11/26' },
    ]);
    expect(
      planInvoiceNumbers(invoices, [issued(FAKE_SCHOOL.id, 10), issued(beta.id, 11)], 12, 2026)
    ).toEqual([]);
  });
});
