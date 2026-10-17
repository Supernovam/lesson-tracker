import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoicesPage } from './InvoicesPage';
import { FAKE_INVOICE_SETTINGS, FAKE_SCHOOL, createLesson } from '../test/invoiceFixtures';
import { downloadInvoicePdfs } from '../utils/invoicePdf';

vi.mock('../hooks/useLessonStorage', () => ({
  useLessonStorage: vi.fn(),
}));

vi.mock('../hooks/useInvoiceSettings', () => ({
  useInvoiceSettings: vi.fn(),
}));

vi.mock('../hooks/useIssuedInvoices', () => ({
  useIssuedInvoices: vi.fn(),
}));

vi.mock('../hooks/useSchoolStorage', () => ({
  useSchoolStorage: vi.fn(),
}));

vi.mock('../utils/invoicePdf', () => ({
  downloadInvoicePdfs: vi.fn(),
}));

import { useLessonStorage } from '../hooks/useLessonStorage';
import { useInvoiceSettings } from '../hooks/useInvoiceSettings';
import { useSchoolStorage } from '../hooks/useSchoolStorage';
import { useIssuedInvoices } from '../hooks/useIssuedInvoices';
import type { IssuedInvoice } from '../types/invoice';

const mockedUseLessonStorage = vi.mocked(useLessonStorage);
const mockedUseInvoiceSettings = vi.mocked(useInvoiceSettings);
const mockedUseSchoolStorage = vi.mocked(useSchoolStorage);
const mockedDownload = vi.mocked(downloadInvoicePdfs);
const mockedUseIssuedInvoices = vi.mocked(useIssuedInvoices);
const mockedIssue = vi.fn();

const WEST_SCHOOL = {
  ...FAKE_SCHOOL,
  id: 'school-west',
  title: 'West Campus',
  billingName: 'West Campus GmbH',
  address: 'Other Str. 9\n10115 Berlin',
};

function mockIssued(invoices: IssuedInvoice[] = [], nextNumber = 12) {
  mockedUseIssuedInvoices.mockReturnValue({ status: 'ready', invoices, nextNumber, issue: mockedIssue });
}

function issuedFor(schoolId: string, number: number): IssuedInvoice {
  return { schoolId, from: '2026-09-01', to: '2026-09-30', year: 2026, number, issuedOn: '2026-09-20' };
}

function mockTwoSchoolPeriod() {
  mockedUseSchoolStorage.mockReturnValue({
    schools: [WEST_SCHOOL, FAKE_SCHOOL],
    status: 'ready',
    addSchool: vi.fn(),
    updateSchool: vi.fn(),
    deleteSchool: vi.fn(),
  });
  mockLessons([
    createLesson({ id: 'west', date: '2026-09-04', schoolId: WEST_SCHOOL.id, schoolTitle: WEST_SCHOOL.title }),
    createLesson({ id: 'east', date: '2026-09-03' }),
  ]);
}

function mockLessons(lessons: ReturnType<typeof createLesson>[], status: 'loading' | 'ready' | 'error' = 'ready') {
  mockedUseLessonStorage.mockReturnValue({
    lessons,
    status,
    addLesson: vi.fn(),
    updateLesson: vi.fn(),
    deleteLesson: vi.fn(),
  } as ReturnType<typeof useLessonStorage>);
}

describe('InvoicesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-21T12:00:00Z'));
    mockedDownload.mockReset();
    mockedIssue.mockReset();
    mockIssued();
    mockedUseInvoiceSettings.mockReturnValue({
      settings: FAKE_INVOICE_SETTINGS,
      status: 'ready',
    });
    mockedUseSchoolStorage.mockReturnValue({
      schools: [FAKE_SCHOOL],
      status: 'ready',
      addSchool: vi.fn(),
      updateSchool: vi.fn(),
      deleteSchool: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults the billed period to the current calendar month', () => {
    mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: 38 })]);

    render(<InvoicesPage />);

    expect((screen.getByLabelText(/invoice period start date/i) as HTMLInputElement).value).toBe(
      '2026-09-01'
    );
    expect((screen.getByLabelText(/invoice period end date/i) as HTMLInputElement).value).toBe(
      '2026-09-30'
    );
  });

  it('previews and downloads lessons in the from-to period, including the previous month', () => {
    const lessons = [
      createLesson({ id: 'aug', studentName: 'Mayumi', date: '2026-08-25', calculatedPrice: 25.33 }),
      createLesson({ id: 'sep', studentName: 'Alex', date: '2026-09-03', calculatedPrice: 38 }),
      createLesson({ id: 'after', studentName: 'Sam', date: '2026-09-25', calculatedPrice: 38 }),
    ];
    mockLessons(lessons);

    render(<InvoicesPage />);

    fireEvent.change(screen.getByLabelText(/invoice period start date/i), {
      target: { value: '2026-08-25' },
    });
    fireEvent.change(screen.getByLabelText(/invoice period end date/i), {
      target: { value: '2026-09-24' },
    });

    const preview = screen.getByRole('table', { name: /invoice preview/i });
    expect(preview.textContent).toContain('Mayumi');
    expect(preview.textContent).toContain('Alex');
    expect(preview.textContent).not.toContain('Sam');
    expect(preview.textContent).toContain('Unterricht');
    expect(preview.textContent).toContain('insgesamt');

    expect(screen.getByLabelText(/invoice preview summary/i).textContent).toMatch(
      /1 invoice for 2 lessons in this period/i
    );
    expect(screen.getByLabelText(/invoice preview summary/i).textContent).toContain('63,33€');
    expect(screen.getByRole('region', { name: /invoice for east campus gmbh/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /download invoice pdf/i }));

    expect(mockedDownload).toHaveBeenCalledWith(
      FAKE_INVOICE_SETTINGS,
      [
        expect.objectContaining({
          recipient: expect.objectContaining({ billingName: 'East Campus GmbH' }),
          lessons: [expect.objectContaining({ id: 'aug' }), expect.objectContaining({ id: 'sep' })],
        }),
      ],
      { from: '2026-08-25', to: '2026-09-24' }
    );
  });

  it('downloads one PDF per school in the period', () => {
    const west = {
      ...FAKE_SCHOOL,
      id: 'school-west',
      title: 'West Campus',
      billingName: 'West Campus GmbH',
      address: 'Other Str. 9\n10115 Berlin',
    };
    mockedUseSchoolStorage.mockReturnValue({
      schools: [FAKE_SCHOOL, west],
      status: 'ready',
      addSchool: vi.fn(),
      updateSchool: vi.fn(),
      deleteSchool: vi.fn(),
    });
    const lessons = [
      createLesson({ id: 'east', studentName: 'Alex', date: '2026-09-03', calculatedPrice: 38 }),
      createLesson({
        id: 'west',
        studentName: 'Mayumi',
        date: '2026-09-04',
        schoolId: west.id,
        schoolTitle: west.title,
        calculatedPrice: 25,
      }),
    ];
    mockLessons(lessons);

    render(<InvoicesPage />);

    expect(screen.getByLabelText(/invoice preview summary/i).textContent).toMatch(/2 invoices for 2 lessons/i);
    expect(screen.getAllByRole('table', { name: /invoice preview/i })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /download invoice pdfs/i }));

    expect(mockedDownload).toHaveBeenCalledWith(
      FAKE_INVOICE_SETTINGS,
      [
        expect.objectContaining({ recipient: expect.objectContaining({ title: 'East Campus' }) }),
        expect.objectContaining({ recipient: expect.objectContaining({ title: 'West Campus' }) }),
      ],
      { from: '2026-09-01', to: '2026-09-30' }
    );
  });

  it('blocks download when a lesson in the period has no price', () => {
    mockLessons([
      createLesson({ studentName: 'Alex', date: '2026-09-03', calculatedPrice: null }),
    ]);

    render(<InvoicesPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/needs a price/i);
    expect(screen.getByRole('alert').textContent).toMatch(/No price for Alex on 03.09.2026/);
    expect(
      (screen.getByRole('button', { name: /download invoice pdf/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('blocks download when a lesson in the period has no school', () => {
    mockLessons([
      createLesson({
        studentName: 'Alex',
        date: '2026-09-03',
        schoolId: null,
        schoolTitle: null,
        calculatedPrice: 38,
      }),
    ]);

    render(<InvoicesPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/needs a school/i);
    expect(screen.getByRole('alert').textContent).toMatch(/No school for Alex on 03.09.2026/);
    expect(
      (screen.getByRole('button', { name: /download invoice pdf/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('blocks download when invoice details are missing', () => {
    mockedUseInvoiceSettings.mockReturnValue({ settings: null, status: 'missing' });
    mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: 38 })]);

    render(<InvoicesPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/not configured/i);
    expect(
      (screen.getByRole('button', { name: /download invoice pdf/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('does not allow From to be set after To', () => {
    mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: 38 })]);

    render(<InvoicesPage />);

    const fromInput = screen.getByLabelText(/invoice period start date/i) as HTMLInputElement;
    const toInput = screen.getByLabelText(/invoice period end date/i) as HTMLInputElement;

    expect(fromInput.max).toBe('2026-09-30');
    expect(toInput.min).toBe('2026-09-01');

    fireEvent.change(fromInput, { target: { value: '2026-10-15' } });
    expect(fromInput.value).toBe('2026-09-30');

    fireEvent.change(toInput, { target: { value: '2026-08-01' } });
    expect(toInput.value).toBe('2026-09-30');
  });

  it('shows a loading state instead of an empty period while data is fetching', () => {
    mockLessons([], 'loading');
    mockedUseInvoiceSettings.mockReturnValue({ settings: null, status: 'loading' });
    mockedUseSchoolStorage.mockReturnValue({
      schools: [],
      status: 'loading',
      addSchool: vi.fn(),
      updateSchool: vi.fn(),
      deleteSchool: vi.fn(),
    });

    render(<InvoicesPage />);

    expect(screen.getByRole('status').textContent).toMatch(/loading invoice data/i);
    expect(screen.queryByText(/no lessons in this period/i)).toBeNull();
    expect(screen.queryByRole('table', { name: /invoice preview/i })).toBeNull();
  });

  describe('issuing Rechnungsnummern', () => {
    it('draft download does not issue a number', () => {
      mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: 38 })]);

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /download invoice pdf/i }));

      expect(mockedIssue).not.toHaveBeenCalled();
      expect(mockedDownload).toHaveBeenCalledWith(FAKE_INVOICE_SETTINGS, expect.any(Array), {
        from: '2026-09-01',
        to: '2026-09-30',
      });
    });

    it('confirms the numbers in school title order before issuing', async () => {
      mockTwoSchoolPeriod();
      const issued = [issuedFor(FAKE_SCHOOL.id, 12), issuedFor(WEST_SCHOOL.id, 13)];
      mockedIssue.mockResolvedValueOnce(issued);

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /^issue invoices$/i }));

      const confirm = screen.getByRole('group', { name: /confirm issuing invoices/i });
      expect(confirm.textContent).toContain('East Campus → 12/26');
      expect(confirm.textContent).toContain('West Campus → 13/26');
      const confirmText = confirm.textContent ?? '';
      expect(confirmText.indexOf('East Campus')).toBeLessThan(confirmText.indexOf('West Campus'));
      expect(mockedIssue).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /confirm and download/i }));

      expect(mockedIssue).toHaveBeenCalledWith([FAKE_SCHOOL.id, WEST_SCHOOL.id], '2026-09-21');
      await waitFor(() =>
        expect(mockedDownload).toHaveBeenCalledWith(
          FAKE_INVOICE_SETTINGS,
          [
            expect.objectContaining({ recipient: expect.objectContaining({ title: 'East Campus' }) }),
            expect.objectContaining({ recipient: expect.objectContaining({ title: 'West Campus' }) }),
          ],
          { from: '2026-09-01', to: '2026-09-30' },
          issued
        )
      );
    });

    it('cancel leaves numbers unassigned', () => {
      mockTwoSchoolPeriod();

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /^issue invoices$/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('group', { name: /confirm issuing invoices/i })).toBeNull();
      expect(mockedIssue).not.toHaveBeenCalled();
    });

    it('shows issued numbers, offers Download again, and only issues the remaining school', async () => {
      mockTwoSchoolPeriod();
      const eastIssued = issuedFor(FAKE_SCHOOL.id, 12);
      mockIssued([eastIssued], 13);

      render(<InvoicesPage />);

      const east = screen.getByRole('region', { name: /invoice for east campus gmbh/i });
      expect(east.textContent).toContain('Issued as 12/26 on 20.09.2026');
      expect(screen.getByRole('region', { name: /invoice for west campus gmbh/i }).textContent).not.toContain(
        'Issued as'
      );

      fireEvent.click(screen.getByRole('button', { name: /download issued invoice 12\/26 again/i }));
      await waitFor(() =>
        expect(mockedDownload).toHaveBeenCalledWith(
          FAKE_INVOICE_SETTINGS,
          [expect.objectContaining({ recipient: expect.objectContaining({ title: 'East Campus' }) })],
          { from: '2026-09-01', to: '2026-09-30' },
          [eastIssued]
        )
      );
      expect(mockedIssue).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /^issue invoice$/i }));
      const confirm = screen.getByRole('group', { name: /confirm issuing invoices/i });
      expect(confirm.textContent).toContain('West Campus → 13/26');
      expect(confirm.textContent).not.toContain('East Campus');
    });

    it('disables Issue once every school in the period has a number', () => {
      mockTwoSchoolPeriod();
      mockIssued([issuedFor(FAKE_SCHOOL.id, 12), issuedFor(WEST_SCHOOL.id, 13)], 14);

      render(<InvoicesPage />);

      expect((screen.getByRole('button', { name: /^issue invoice/i }) as HTMLButtonElement).disabled).toBe(true);
      expect(
        (screen.getByRole('button', { name: /download invoice pdfs/i }) as HTMLButtonElement).disabled
      ).toBe(false);
    });

    it('blocks issuing while lessons in the period are unpriced', () => {
      mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: null })]);

      render(<InvoicesPage />);

      expect((screen.getByRole('button', { name: /^issue invoice$/i }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('numbers the first invoice of a new year 01/yy', () => {
      vi.setSystemTime(new Date('2027-01-01T09:00:00Z'));
      mockLessons([createLesson({ date: '2026-12-10', calculatedPrice: 38 })]);
      mockIssued([], 1);

      render(<InvoicesPage />);
      fireEvent.change(screen.getByLabelText(/invoice period start date/i), { target: { value: '2026-12-01' } });
      fireEvent.change(screen.getByLabelText(/invoice period end date/i), { target: { value: '2026-12-31' } });
      fireEvent.click(screen.getByRole('button', { name: /^issue invoice$/i }));

      expect(mockedUseIssuedInvoices).toHaveBeenLastCalledWith('2026-12-01', '2026-12-31', 2027);
      expect(screen.getByRole('group', { name: /confirm issuing invoices/i }).textContent).toContain(
        'East Campus → 01/27'
      );
    });
  });
});
