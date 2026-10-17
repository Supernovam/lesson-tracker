import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createInvoicePdf, downloadInvoicePdfs } from './invoicePdf';
import { FAKE_INVOICE_SETTINGS, FAKE_RECIPIENT, createLesson } from '../test/invoiceFixtures';
import type { jsPDF } from 'jspdf';

const savedDocs = vi.hoisted(() => [] as jsPDF[]);

// Capture docs passed to `save` instead of triggering a browser download.
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  class CapturingJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      this.save = (() => {
        savedDocs.push(this);
        return this;
      }) as unknown as jsPDF['save'];
    }
  }
  return { ...actual, jsPDF: CapturingJsPDF };
});

function pdfText(doc: { output: (type: 'arraybuffer') => ArrayBuffer }) {
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return new TextDecoder('latin1').decode(bytes);
}

function pdfContains(doc: { output: (type: 'arraybuffer') => ArrayBuffer }, snippet: string) {
  return pdfText(doc).includes(snippet);
}

function pdfCount(doc: { output: (type: 'arraybuffer') => ArrayBuffer }, snippet: string) {
  return pdfText(doc).split(snippet).length - 1;
}

const period = { from: '2026-08-25', to: '2026-09-24' };

describe('createInvoicePdf', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a Honorarrechnung with table structure and fake party details', async () => {
    const lessons = [
      createLesson({ id: 'a', studentName: 'Alex', date: '2026-08-25', duration: 60, calculatedPrice: 25.33 }),
      createLesson({
        id: 'b',
        studentName: 'Sam',
        date: '2026-09-07',
        duration: 90,
        lessonTypeName: 'AK-P',
        calculatedPrice: 38,
      }),
    ];

    const doc = await createInvoicePdf(FAKE_INVOICE_SETTINGS, FAKE_RECIPIENT, lessons, period);

    expect(pdfContains(doc, 'Honorarrechnung')).toBe(true);
    expect(pdfContains(doc, 'Unterricht')).toBe(true);
    expect(pdfContains(doc, 'insgesamt')).toBe(true);
    expect(pdfContains(doc, 'Jane Issuer')).toBe(true);
    expect(pdfContains(doc, 'East Campus GmbH')).toBe(true);
    expect(pdfContains(doc, 'Client Str. 2')).toBe(true);
    expect(pdfContains(doc, '54321 Client City')).toBe(true);
    expect(pdfContains(doc, 'Alex')).toBe(true);
    expect(pdfContains(doc, 'Rechnungsdatum: 21.09.2026')).toBe(true);
    expect(pdfContains(doc, 'Kleinunternehmerregelung')).toBe(true);
  });

  it('includes a previous-month lesson that falls in the billed period', async () => {
    const lessons = [
      createLesson({ id: 'aug', studentName: 'Mayumi', date: '2026-08-25', calculatedPrice: 25.33 }),
      createLesson({ id: 'sep', studentName: 'Alex', date: '2026-09-03', calculatedPrice: 38 }),
      createLesson({ id: 'after', studentName: 'Sam', date: '2026-09-25', calculatedPrice: 38 }),
    ];

    const doc = await createInvoicePdf(FAKE_INVOICE_SETTINGS, FAKE_RECIPIENT, lessons, period);

    expect(pdfContains(doc, 'Mayumi')).toBe(true);
    expect(pdfContains(doc, 'Alex')).toBe(true);
    expect(pdfContains(doc, 'Sam')).toBe(false);
  });

  it('prints insgesamt only once, after every lesson row', async () => {
    const lessons = Array.from({ length: 40 }, (_, index) =>
      createLesson({
        id: `lesson-${index}`,
        date: `2026-09-${String((index % 24) + 1).padStart(2, '0')}`,
        createdAt: index,
        calculatedPrice: 38,
      })
    );

    const doc = await createInvoicePdf(FAKE_INVOICE_SETTINGS, FAKE_RECIPIENT, lessons, period);

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdfCount(doc, 'insgesamt')).toBe(1);
  });

  it('throws when a lesson in the period has no price', async () => {
    await expect(
      createInvoicePdf(FAKE_INVOICE_SETTINGS, FAKE_RECIPIENT, [createLesson({ calculatedPrice: null })], period)
    ).rejects.toThrow(/priced lessons/);
  });
});

describe('Rechnungsnummer in PDFs', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    savedDocs.length = 0;
  });

  const lessons = [createLesson({ date: '2026-09-03', calculatedPrice: 38 })];
  const september = { from: '2026-09-01', to: '2026-09-30' };

  async function savedPdfs(issued?: Parameters<typeof downloadInvoicePdfs>[3]) {
    await downloadInvoicePdfs(
      FAKE_INVOICE_SETTINGS,
      [{ recipient: FAKE_RECIPIENT, lessons }],
      september,
      issued
    );
    return savedDocs;
  }

  it('leaves the number empty on a draft download', async () => {
    const [doc] = await savedPdfs();

    expect(pdfContains(doc, 'Rechnungsnummer:')).toBe(true);
    expect(pdfContains(doc, '/26')).toBe(false);
    expect(pdfContains(doc, 'Rechnungsdatum: 17.10.2026')).toBe(true);
  });

  it('prints the issued number and issue date when reprinting', async () => {
    const [doc] = await savedPdfs([
      { schoolId: FAKE_RECIPIENT.schoolId, ...september, year: 2026, number: 12, issuedOn: '2026-10-01' },
    ]);

    expect(pdfContains(doc, 'Rechnungsnummer: 12/26')).toBe(true);
    expect(pdfContains(doc, 'Rechnungsdatum: 01.10.2026')).toBe(true);
  });

  it('prints the first number of a new year as 01/yy', async () => {
    const [doc] = await savedPdfs([
      { schoolId: FAKE_RECIPIENT.schoolId, ...september, year: 2027, number: 1, issuedOn: '2027-01-01' },
    ]);

    expect(pdfContains(doc, 'Rechnungsnummer: 01/27')).toBe(true);
    expect(pdfContains(doc, 'Rechnungsdatum: 01.01.2027')).toBe(true);
  });
});
