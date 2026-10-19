import { useState } from 'react';
import { Download, FileCheck } from 'lucide-react';
import { Callout } from '../components/Callout';
import { DateRangeFields } from '../components/DateRangeFields';
import { useInvoiceSettings } from '../hooks/useInvoiceSettings';
import { useIssuedInvoices } from '../hooks/useIssuedInvoices';
import { useLessonStorage } from '../hooks/useLessonStorage';
import { useSchoolStorage } from '../hooks/useSchoolStorage';
import type { IssuedInvoice } from '../types/invoice';
import { currentCalendarMonthBounds, type DateRange } from '../utils/dateRange';
import {
  describeLesson,
  formatDisplayDate,
  formatInvoicePrice,
  getTodayISO,
  sumLessonPrices,
} from '../utils/format';
import {
  canDownloadSchoolInvoice,
  formatInvoiceNumber,
  getLessonsForInvoice,
  lessonsMissingPrice,
  mapLessonToInvoiceRow,
  partitionInvoicesBySchool,
  planInvoiceNumbers,
  type SchoolInvoice,
} from '../utils/invoiceData';
import { downloadInvoicePdfs } from '../utils/invoicePdf';

const invoiceCellClass = 'border border-slate-300 px-3 py-2';
const invoiceHeaderClass = `${invoiceCellClass} bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-700`;
const secondaryButtonClass =
  'inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass =
  'inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus:outline-hidden focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50';

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type IssueTarget = { kind: 'all' } | { kind: 'school'; schoolId: string };

// The billed period defaults to the current calendar month. Leftover classes from after
// the previous invoice (often the prior month) need a manual From date.

function InvoicePreviewTable({
  invoice,
  issued,
  canDownload,
  nextNumberLabel,
  canIssue,
  isConfirmingIssue,
  isIssuing,
  onDownloadDraft,
  onDownloadAgain,
  onIssue,
  onConfirmIssue,
  onCancelIssue,
}: {
  invoice: SchoolInvoice;
  issued: IssuedInvoice | undefined;
  canDownload: boolean;
  nextNumberLabel: string | null;
  canIssue: boolean;
  isConfirmingIssue: boolean;
  isIssuing: boolean;
  onDownloadDraft: () => void;
  onDownloadAgain: () => void;
  onIssue: () => void;
  onConfirmIssue: () => void;
  onCancelIssue: () => void;
}) {
  const total = sumLessonPrices(invoice.lessons);
  const { title } = invoice.recipient;
  const hasUnpricedLessons = lessonsMissingPrice(invoice.lessons).length > 0;

  return (
    <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-6" aria-label={`Invoice for ${invoice.recipient.billingName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Invoice preview</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Honorarrechnung</h3>
        </div>
        {issued ? (
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
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onDownloadDraft}
              disabled={!canDownload}
              className={secondaryButtonClass}
              aria-label={`Download draft invoice for ${title}`}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Download draft
            </button>
            <button
              type="button"
              onClick={onIssue}
              disabled={!canIssue || isConfirmingIssue}
              className={primaryButtonClass}
              aria-label={
                nextNumberLabel ? `Issue invoice for ${title} as ${nextNumberLabel}` : `Issue invoice for ${title}`
              }
            >
              <FileCheck className="h-4 w-4 shrink-0" aria-hidden />
              {nextNumberLabel ? `Issue as ${nextNumberLabel}` : 'Issue'}
            </button>
          </div>
        )}
      </div>
      {!issued && hasUnpricedLessons && (
        <div className="mt-3">
          <Callout tone="warning" title="Not ready to issue">
            Price every lesson for this school before issuing its invoice.
          </Callout>
        </div>
      )}
      {isConfirmingIssue && (
        <div
          className="mt-3 rounded-md border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700"
          role="group"
          aria-label={`Confirm issuing invoice for ${title}`}
        >
          <p className="font-medium text-slate-900">
            Issue invoice for {title}
            {nextNumberLabel ? ` as ${nextNumberLabel}` : ''} dated {formatDisplayDate(getTodayISO())}? This number
            cannot be reused.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onConfirmIssue} disabled={!canIssue} className={primaryButtonClass}>
              {isIssuing ? 'Issuing…' : 'Confirm and download'}
            </button>
            <button type="button" onClick={onCancelIssue} disabled={isIssuing} className={secondaryButtonClass}>
              Cancel
            </button>
          </div>
        </div>
      )}
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
  // Which Issue confirmation is open: the toolbar's Issue all, one school's card, or none.
  const [confirmingIssue, setConfirmingIssue] = useState<IssueTarget | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const invoiceYear = Number(getTodayISO().slice(0, 4));
  const issuedInvoices = useIssuedInvoices(from, to, invoiceYear);

  const isLoading = lessonStatus === 'loading' || schoolStatus === 'loading' || invoice.status === 'loading';
  const periodLessons = getLessonsForInvoice(lessons, from, to);
  const unpricedLessons = lessonsMissingPrice(periodLessons);
  const { invoices, missingSchool, unknownSchool } = partitionInvoicesBySchool(periodLessons, schools);
  const estimatedTotal = sumLessonPrices(periodLessons);
  const unassigned = { missingSchool, unknownSchool };
  const canDownloadSchool = (schoolInvoice: SchoolInvoice) =>
    invoice.status === 'ready' && schoolStatus === 'ready' && canDownloadSchoolInvoice(schoolInvoice, unassigned);
  const exportable = invoices.length > 0 && invoices.every(canDownloadSchool);
  const plannedNumbers =
    issuedInvoices.status === 'ready'
      ? planInvoiceNumbers(invoices, issuedInvoices.invoices, issuedInvoices.nextNumber, invoiceYear)
      : [];
  const canIssue = exportable && !isIssuing && plannedNumbers.length > 0;
  const issuedBySchool = new Map(issuedInvoices.invoices.map((entry) => [entry.schoolId, entry]));
  const nextNumberLabel =
    issuedInvoices.status === 'ready' ? formatInvoiceNumber(issuedInvoices.nextNumber, invoiceYear) : null;
  const canIssueSchool = (schoolInvoice: SchoolInvoice) =>
    canDownloadSchool(schoolInvoice) &&
    !isIssuing &&
    nextNumberLabel !== null &&
    !issuedBySchool.has(schoolInvoice.recipient.schoolId);

  function handlePeriodChange(next: DateRange) {
    setPeriod(next);
    setConfirmingIssue(null);
  }

  async function handleConfirmIssue() {
    if (!confirmingIssue || invoice.status !== 'ready') return;
    if (confirmingIssue.kind === 'all' && !canIssue) return;
    const target = confirmingIssue;
    const plannedSchoolIds = new Set(plannedNumbers.map((planned) => planned.schoolId));
    const toIssue = invoices.filter((schoolInvoice) =>
      target.kind === 'all'
        ? plannedSchoolIds.has(schoolInvoice.recipient.schoolId)
        : schoolInvoice.recipient.schoolId === target.schoolId && canIssueSchool(schoolInvoice)
    );
    if (toIssue.length === 0) return;
    setExportError(null);
    setIsIssuing(true);
    let issued: IssuedInvoice[];
    try {
      issued = await issuedInvoices.issue(
        toIssue.map((schoolInvoice) => schoolInvoice.recipient.schoolId),
        getTodayISO()
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to issue invoices.');
      setIsIssuing(false);
      return;
    }
    setConfirmingIssue(null);
    setIsIssuing(false);
    const issuedSchoolIds = new Set(issued.map((entry) => entry.schoolId));
    try {
      await downloadInvoicePdfs(
        invoice.settings,
        toIssue.filter((schoolInvoice) => issuedSchoolIds.has(schoolInvoice.recipient.schoolId)),
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

  async function handleDownloadSchool(schoolInvoice: SchoolInvoice, issued?: IssuedInvoice) {
    if (!canDownloadSchool(schoolInvoice) || invoice.status !== 'ready') return;
    setExportError(null);
    try {
      await downloadInvoicePdfs(invoice.settings, [schoolInvoice], { from, to }, issued ? [issued] : []);
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

  return (
    <section aria-label="Export invoices">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Invoices</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
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
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Download all drafts
            </button>
            <button
              type="button"
              onClick={() => setConfirmingIssue({ kind: 'all' })}
              disabled={!canIssue || confirmingIssue?.kind === 'all'}
              className={primaryButtonClass}
            >
              <FileCheck className="h-4 w-4 shrink-0" aria-hidden />
              Issue all invoices
            </button>
          </div>
          <p className="text-xs text-slate-500">
            A draft has no Rechnungsnummer. Issuing assigns the next number and downloads the final PDF — per invoice
            below, or all invoices at once in school order.
          </p>

          {confirmingIssue?.kind === 'all' && (
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
                  onClick={() => setConfirmingIssue(null)}
                  disabled={isIssuing}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {invoice.status === 'missing' && (
            <Callout tone="error" title="Invoice details missing">
              Invoice details are not configured in the database, so a PDF cannot be created.
            </Callout>
          )}
          {invoice.status === 'error' && (
            <Callout tone="error" title="Invoice details could not be loaded">
              Try again after signing in.
            </Callout>
          )}
          {schoolStatus === 'error' && (
            <Callout tone="error" title="Schools could not be loaded">
              A PDF cannot be created until the schools load.
            </Callout>
          )}
          {issuedInvoices.status === 'error' && (
            <Callout tone="error" title="Invoice numbers could not be loaded">
              Issued invoice numbers could not be loaded, so invoices cannot be issued.
            </Callout>
          )}
          {exportError && (
            <Callout tone="error" title="Something went wrong" onDismiss={() => setExportError(null)}>
              {exportError}
            </Callout>
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
                <Callout
                  tone="error"
                  title={`${countLabel(unpricedLessons.length, 'lesson needs', 'lessons need')} a price`}
                >
                  <p>Every lesson needs a price before its school’s invoice can be exported or issued.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {unpricedLessons.map((lesson) => (
                      <li key={lesson.id}>
                        No price for the {describeLesson(lesson)}.
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}
              {missingSchool.length > 0 && (
                <Callout
                  tone="error"
                  title={`${countLabel(missingSchool.length, 'lesson needs', 'lessons need')} a school`}
                >
                  <p>Every lesson in this period needs a school before you can export.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {missingSchool.map((lesson) => (
                      <li key={lesson.id}>
                        No school for the {describeLesson(lesson)}.
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}
              {unknownSchool.length > 0 && (
                <Callout tone="error" title="Unknown school">
                  <p>A lesson’s school could not be loaded, so a PDF cannot be created.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {unknownSchool.map((lesson) => (
                      <li key={lesson.id}>
                        Unknown school for the {describeLesson(lesson)}.
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}
              {invoices.map((schoolInvoice) => {
                const { schoolId } = schoolInvoice.recipient;
                const issued = issuedBySchool.get(schoolId);
                return (
                  <InvoicePreviewTable
                    key={schoolId}
                    invoice={schoolInvoice}
                    issued={issued}
                    canDownload={canDownloadSchool(schoolInvoice)}
                    nextNumberLabel={nextNumberLabel}
                    canIssue={canIssueSchool(schoolInvoice)}
                    isConfirmingIssue={confirmingIssue?.kind === 'school' && confirmingIssue.schoolId === schoolId}
                    isIssuing={isIssuing}
                    onDownloadDraft={() => handleDownloadSchool(schoolInvoice)}
                    onDownloadAgain={() => issued && handleDownloadSchool(schoolInvoice, issued)}
                    onIssue={() => setConfirmingIssue({ kind: 'school', schoolId })}
                    onConfirmIssue={handleConfirmIssue}
                    onCancelIssue={() => setConfirmingIssue(null)}
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
