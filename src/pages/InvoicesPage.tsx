import { useState } from 'react';
import { Download, FileCheck } from 'lucide-react';
import { DateRangeFields } from '../components/DateRangeFields';
import { useInvoiceSettings } from '../hooks/useInvoiceSettings';
import { useIssuedInvoices } from '../hooks/useIssuedInvoices';
import { useLessonStorage } from '../hooks/useLessonStorage';
import { useSchoolStorage } from '../hooks/useSchoolStorage';
import type { IssuedInvoice } from '../types/invoice';
import { currentCalendarMonthBounds, type DateRange } from '../utils/dateRange';
import { describeLesson, formatDisplayDate, formatInvoicePrice, getTodayISO } from '../utils/format';
import {
  canDownloadInvoices,
  formatInvoiceNumber,
  getLessonsForInvoice,
  lessonsMissingPrice,
  mapLessonToInvoiceRow,
  partitionInvoicesBySchool,
  planInvoiceNumbers,
  sumLessonPrices,
  type SchoolInvoice,
} from '../utils/invoiceData';
import { downloadInvoicePdfs } from '../utils/invoicePdf';

const invoiceCellClass = 'border border-slate-300 px-3 py-2';
const invoiceHeaderClass = `${invoiceCellClass} bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-700`;
const secondaryButtonClass =
  'inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass =
  'inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50';

// The billed period defaults to the current calendar month. Leftover classes from after
// the previous invoice (often the prior month) need a manual From date.

function InvoicePreviewTable({
  invoice,
  issued,
  canDownload,
  onDownloadAgain,
}: {
  invoice: SchoolInvoice;
  issued: IssuedInvoice | undefined;
  canDownload: boolean;
  onDownloadAgain: () => void;
}) {
  const total = sumLessonPrices(invoice.lessons);

  return (
    <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-6" aria-label={`Invoice for ${invoice.recipient.billingName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Invoice preview</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Honorarrechnung</h3>
        </div>
        {issued && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-slate-700">
              Issued as {formatInvoiceNumber(issued.number, issued.year)} on {formatDisplayDate(issued.issuedOn)}
            </p>
            <button
              type="button"
              onClick={onDownloadAgain}
              disabled={!canDownload}
              className={secondaryButtonClass}
              aria-label={`Download issued invoice ${formatInvoiceNumber(issued.number, issued.year)} again`}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Download again
            </button>
          </div>
        )}
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-slate-800">
        {invoice.recipient.billingName}
        {invoice.recipient.addressLines.length > 0 ? `\n${invoice.recipient.addressLines.join('\n')}` : ''}
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm" aria-label={`Invoice preview for ${invoice.recipient.billingName}`}>
          <thead>
            <tr>
              <th scope="col" className={invoiceHeaderClass}>
                Unterricht
              </th>
              <th scope="col" className={invoiceHeaderClass}>
                Name
              </th>
              <th scope="col" className={invoiceHeaderClass}>
                Datum
              </th>
              <th scope="col" className={invoiceHeaderClass}>
                Dauer
              </th>
              <th scope="col" className={`${invoiceHeaderClass} text-right`}>
                Kosten
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lessons.map((lesson) => {
              const [lessonType, studentName, date, duration, price] = mapLessonToInvoiceRow(lesson);
              return (
                <tr key={lesson.id}>
                  <td className={`${invoiceCellClass} text-slate-700`}>{lessonType}</td>
                  <td className={`${invoiceCellClass} text-slate-800`}>{studentName}</td>
                  <td className={`${invoiceCellClass} text-slate-700`}>{date}</td>
                  <td className={`${invoiceCellClass} text-slate-700`}>{duration}</td>
                  <td className={`${invoiceCellClass} text-right tabular-nums text-slate-800`}>{price}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4} className={`${invoiceCellClass} text-left font-semibold text-slate-900`}>
                insgesamt
              </th>
              <td className={`${invoiceCellClass} text-right font-semibold tabular-nums text-slate-900`}>
                {formatInvoicePrice(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function InvoicesPage() {
  const { lessons, status: lessonStatus } = useLessonStorage();
  const { schools, status: schoolStatus } = useSchoolStorage();
  const invoice = useInvoiceSettings();
  const [period, setPeriod] = useState<DateRange>(currentCalendarMonthBounds);
  const { from, to } = period;
  const [exportError, setExportError] = useState<string | null>(null);
  const [isConfirmingIssue, setIsConfirmingIssue] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const invoiceYear = Number(getTodayISO().slice(0, 4));
  const issuedInvoices = useIssuedInvoices(from, to, invoiceYear);

  const isLoading = lessonStatus === 'loading' || schoolStatus === 'loading' || invoice.status === 'loading';
  const periodLessons = getLessonsForInvoice(lessons, from, to);
  const unpricedLessons = lessonsMissingPrice(periodLessons);
  const { invoices, missingSchool, unknownSchool } = partitionInvoicesBySchool(periodLessons, schools);
  const estimatedTotal = sumLessonPrices(periodLessons);
  const exportable =
    invoice.status === 'ready' && schoolStatus === 'ready' && canDownloadInvoices(periodLessons, schools);
  const plannedNumbers =
    issuedInvoices.status === 'ready'
      ? planInvoiceNumbers(invoices, issuedInvoices.invoices, issuedInvoices.nextNumber, invoiceYear)
      : [];
  const canIssue = exportable && !isIssuing && plannedNumbers.length > 0;
  const issuedBySchool = new Map(issuedInvoices.invoices.map((entry) => [entry.schoolId, entry]));

  function handlePeriodChange(next: DateRange) {
    setPeriod(next);
    setIsConfirmingIssue(false);
  }

  async function handleConfirmIssue() {
    if (!canIssue || invoice.status !== 'ready') return;
    setExportError(null);
    setIsIssuing(true);
    let issued: IssuedInvoice[];
    try {
      issued = await issuedInvoices.issue(
        plannedNumbers.map((planned) => planned.schoolId),
        getTodayISO()
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to issue invoices.');
      setIsIssuing(false);
      return;
    }
    setIsConfirmingIssue(false);
    setIsIssuing(false);
    const issuedSchoolIds = new Set(issued.map((entry) => entry.schoolId));
    try {
      await downloadInvoicePdfs(
        invoice.settings,
        invoices.filter((schoolInvoice) => issuedSchoolIds.has(schoolInvoice.recipient.schoolId)),
        { from, to },
        issued
      );
    } catch (err) {
      setExportError(
        `Invoice numbers were issued, but the PDF could not be created. Use Download again. ${
          err instanceof Error ? err.message : ''
        }`.trim()
      );
    }
  }

  async function handleDownloadAgain(schoolInvoice: SchoolInvoice, issued: IssuedInvoice) {
    if (!exportable || invoice.status !== 'ready') return;
    setExportError(null);
    try {
      await downloadInvoicePdfs(invoice.settings, [schoolInvoice], { from, to }, [issued]);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to create the invoice PDF.');
    }
  }

  async function handleExport() {
    if (!exportable || invoice.status !== 'ready') return;
    setExportError(null);
    try {
      await downloadInvoicePdfs(invoice.settings, invoices, { from, to });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to create the invoice PDF.');
    }
  }

  const downloadLabel = invoices.length > 1 ? 'Download PDFs' : 'Download PDF';

  return (
    <section aria-label="Export invoices">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Invoices</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFields
              idPrefix="invoice"
              ariaLabelPrefix="Invoice period"
              range={period}
              onChange={handlePeriodChange}
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={!exportable}
              className={secondaryButtonClass}
              aria-label={invoices.length > 1 ? 'Download invoice PDFs' : 'Download invoice PDF'}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              {downloadLabel}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingIssue(true)}
              disabled={!canIssue || isConfirmingIssue}
              className={primaryButtonClass}
            >
              <FileCheck className="h-4 w-4 shrink-0" aria-hidden />
              {plannedNumbers.length > 1 ? 'Issue invoices' : 'Issue invoice'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Download creates a draft without a Rechnungsnummer. Issue assigns the next numbers and downloads the final
            PDFs.
          </p>

          {isConfirmingIssue && plannedNumbers.length > 0 && (
            <div
              className="rounded-md border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700"
              role="group"
              aria-label="Confirm issuing invoices"
            >
              <p className="font-medium text-slate-900">
                Issue {plannedNumbers.length} invoice{plannedNumbers.length === 1 ? '' : 's'} dated{' '}
                {formatDisplayDate(getTodayISO())}? These numbers cannot be reused.
              </p>
              <ul className="mt-2 list-disc pl-5">
                {plannedNumbers.map((planned) => (
                  <li key={planned.schoolId}>
                    {planned.title} → {planned.label}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={handleConfirmIssue} disabled={!canIssue} className={primaryButtonClass}>
                  {isIssuing ? 'Issuing…' : 'Confirm and download'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingIssue(false)}
                  disabled={isIssuing}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {invoice.status === 'missing' && (
            <p className="text-sm text-red-600" role="alert">
              Invoice details are not configured in the database, so a PDF cannot be created.
            </p>
          )}
          {invoice.status === 'error' && (
            <p className="text-sm text-red-600" role="alert">
              Invoice details could not be loaded. Try again after signing in.
            </p>
          )}
          {schoolStatus === 'error' && (
            <p className="text-sm text-red-600" role="alert">
              Schools could not be loaded, so a PDF cannot be created.
            </p>
          )}
          {issuedInvoices.status === 'error' && (
            <p className="text-sm text-red-600" role="alert">
              Issued invoice numbers could not be loaded, so invoices cannot be issued.
            </p>
          )}
          {exportError && (
            <p className="text-sm text-red-600" role="alert">
              {exportError}
            </p>
          )}
        </div>

        <div className="bg-slate-50 p-4 sm:p-6">
          {isLoading ? (
            <p
              className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500"
              role="status"
            >
              Loading invoice data…
            </p>
          ) : periodLessons.length === 0 ? (
            <p
              className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500"
              role="status"
            >
              No lessons in this period. Adjust the dates to include billed classes.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600" aria-label="Invoice preview summary">
                {invoices.length} invoice{invoices.length === 1 ? '' : 's'} for {periodLessons.length} lesson
                {periodLessons.length === 1 ? '' : 's'} in this period. Estimated total {formatInvoicePrice(estimatedTotal)}.
              </p>
              {unpricedLessons.length > 0 && (
                <div className="text-sm text-red-600" role="alert">
                  <p>Every lesson in this period needs a price before you can export.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {unpricedLessons.map((lesson) => (
                      <li key={lesson.id}>
                        No price for the {describeLesson(lesson)}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {missingSchool.length > 0 && (
                <div className="text-sm text-red-600" role="alert">
                  <p>Every lesson in this period needs a school before you can export.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {missingSchool.map((lesson) => (
                      <li key={lesson.id}>
                        No school for the {describeLesson(lesson)}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {unknownSchool.length > 0 && (
                <div className="text-sm text-red-600" role="alert">
                  <p>A lesson’s school could not be loaded, so a PDF cannot be created.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {unknownSchool.map((lesson) => (
                      <li key={lesson.id}>
                        Unknown school for the {describeLesson(lesson)}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {invoices.map((schoolInvoice) => {
                const issued = issuedBySchool.get(schoolInvoice.recipient.schoolId);
                return (
                  <InvoicePreviewTable
                    key={schoolInvoice.recipient.schoolId}
                    invoice={schoolInvoice}
                    issued={issued}
                    canDownload={exportable}
                    onDownloadAgain={() => issued && handleDownloadAgain(schoolInvoice, issued)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
