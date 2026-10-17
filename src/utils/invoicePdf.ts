import type { jsPDF } from 'jspdf';
import type { InvoiceRecipient, InvoiceSettings, IssuedInvoice } from '../types/invoice';
import type { Lesson } from '../types/lesson';
import { formatDisplayDate, formatInvoicePrice, getTodayISO } from './format';
import {
  canExportInvoice,
  formatInvoiceNumber,
  getLessonsForInvoice,
  invoiceFilename,
  mapLessonToInvoiceRow,
  sumLessonPrices,
  type SchoolInvoice,
} from './invoiceData';

const LEGAL_TEXT =
  'Ich verpflichte mich, die Einkünfte aus dieser Tätigkeit ggü. dem Finanzamt anzumelden. Diese Leistungen sind nach § 19 UStG von der Umsatzsteuer befreit (Kleinunternehmerregelung). Bitte überweisen Sie den Gesamtbetrag innerhalb von 14 Tagen an das unten angegebene Konto.';

type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } };

export type CreateInvoicePdfOptions = {
  from: string;
  to: string;
  invoiceDate?: string;
  invoiceNumber?: string;
};

async function loadPdfLibraries() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - 18) return y;
  doc.addPage();
  return 20;
}

export async function createInvoicePdf(
  settings: InvoiceSettings,
  recipient: InvoiceRecipient,
  lessons: Lesson[],
  options: CreateInvoicePdfOptions
): Promise<jsPDF> {
  const periodLessons = getLessonsForInvoice(lessons, options.from, options.to);
  if (!canExportInvoice(periodLessons)) {
    throw new Error('Invoice export requires priced lessons for the selected period');
  }

  const { jsPDF, autoTable } = await loadPdfLibraries();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as PdfDoc;
  const left = 20;
  const right = 190;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${settings.issuerName}; ${settings.issuerStreet}; ${settings.issuerPostalCode} ${settings.issuerCity}`,
    left,
    16
  );

  doc.setFontSize(11);
  const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
  const recipientLines = [recipient.billingName, ...recipient.addressLines];
  const issuerLines = [
    settings.issuerName,
    settings.issuerStreet,
    `${settings.issuerPostalCode} ${settings.issuerCity}`,
    `Mobil: ${settings.issuerPhone}`,
    settings.issuerEmail,
  ];
  doc.text(recipientLines, left, 32);
  doc.text(issuerLines, right, 32, { align: 'right' });

  const headerBottom = 32 + Math.max(recipientLines.length, issuerLines.length) * lineHeight;
  const dateY = Math.max(68, headerBottom + 6);
  const invoiceDate = formatDisplayDate(options.invoiceDate ?? getTodayISO());
  doc.text(`Rechnungsdatum: ${invoiceDate}`, right, dateY, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Honorarrechnung', left, dateY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Steuernummer: ${settings.issuerTaxNumber}`, left, dateY + 22);
  const invoiceNumber = options.invoiceNumber?.trim() ?? '';
  doc.text(
    invoiceNumber ? `Rechnungsnummer: ${invoiceNumber}` : 'Rechnungsnummer:',
    right,
    dateY + 22,
    { align: 'right' }
  );

  const body = periodLessons.map(mapLessonToInvoiceRow);
  const total = formatInvoicePrice(sumLessonPrices(periodLessons));

  autoTable(doc, {
    startY: dateY + 30,
    margin: { left: 20, right: 20 },
    head: [['Unterricht', 'Name', 'Datum', 'Dauer', 'Kosten']],
    body,
    showHead: 'firstPage',
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: { top: 1.4, bottom: 1.4, left: 0, right: 1 },
      textColor: 30,
    },
    headStyles: { fontStyle: 'bold', textColor: 20 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 42 },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 36, halign: 'right' },
    },
  });

  let y = (doc.lastAutoTable?.finalY ?? dateY + 30) + 6;
  y = ensureSpace(doc, y, 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('insgesamt', left, y);
  doc.text(total, right, y, { align: 'right' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const legalLines = doc.splitTextToSize(LEGAL_TEXT, right - left);
  y = ensureSpace(doc, y, legalLines.length * 5 + 36);
  doc.text(legalLines, left, y);
  y += legalLines.length * 5 + 8;
  doc.text('Mit freundlichen Grüßen', left, y);
  y += 10;
  doc.text(settings.issuerName, left, y);
  y += 12;
  y = ensureSpace(doc, y, 6);
  doc.text(`IBAN ${settings.issuerIban} BIC ${settings.issuerBic}`, left, y);

  return doc;
}

/**
 * Saves one PDF per school. Without `issued` (or for a school missing from it) the PDF is a
 * draft with an empty Rechnungsnummer; an issued school gets its number and issue date.
 */
export async function downloadInvoicePdfs(
  settings: InvoiceSettings,
  invoices: SchoolInvoice[],
  options: CreateInvoicePdfOptions,
  issued: IssuedInvoice[] = []
): Promise<void> {
  const issuedBySchool = new Map(issued.map((entry) => [entry.schoolId, entry]));
  for (const invoice of invoices) {
    const entry = issuedBySchool.get(invoice.recipient.schoolId);
    const doc = await createInvoicePdf(settings, invoice.recipient, invoice.lessons, {
      ...options,
      ...(entry && {
        invoiceNumber: formatInvoiceNumber(entry.number, entry.year),
        invoiceDate: entry.issuedOn,
      }),
    });
    doc.save(invoiceFilename(invoice.recipient.title, options.from, options.to));
  }
}
