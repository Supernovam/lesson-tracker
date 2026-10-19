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
  id: 'school-beta',
  title: 'Beta Campus',
  billingName: 'Beta Campus GmbH',
  address: 'Other Str. 9\n12345 Sampletown',
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
    createLesson({ id: 'beta', date: '2026-09-04', schoolId: WEST_SCHOOL.id, schoolTitle: WEST_SCHOOL.title }),
    createLesson({ id: 'alpha', date: '2026-09-03' }),
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
    mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: 56 })]);

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
      createLesson({ id: 'aug', studentName: 'Robin', date: '2026-08-25', calculatedPrice: 37.33 }),
      createLesson({ id: 'sep', studentName: 'Alex', date: '2026-09-03', calculatedPrice: 56 }),
      createLesson({ id: 'after', studentName: 'Sam', date: '2026-09-25', calculatedPrice: 56 }),
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
    expect(preview.textContent).toContain('Robin');
    expect(preview.textContent).toContain('Alex');
    expect(preview.textContent).not.toContain('Sam');
    expect(preview.textContent).toContain('Unterricht');
    expect(preview.textContent).toContain('insgesamt');

    expect(screen.getByLabelText(/invoice preview summary/i).textContent).toMatch(
      /1 invoice for 2 lessons in this period/i
    );
    expect(screen.getByLabelText(/invoice preview summary/i).textContent).toContain('93,33€');
    expect(screen.getByRole('region', { name: /invoice for alpha campus gmbh/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /download all drafts/i }));

    expect(mockedDownload).toHaveBeenCalledWith(
      FAKE_INVOICE_SETTINGS,
      [
        expect.objectContaining({
          recipient: expect.objectContaining({ billingName: 'Alpha Campus GmbH' }),
          lessons: [expect.objectContaining({ id: 'aug' }), expect.objectContaining({ id: 'sep' })],
        }),
      ],
      { from: '2026-08-25', to: '2026-09-24' }
    );
  });

  it('downloads one PDF per school in the period', () => {
    const beta = {
      ...FAKE_SCHOOL,
      id: 'school-beta',
      title: 'Beta Campus',
      billingName: 'Beta Campus GmbH',
      address: 'Other Str. 9\n12345 Sampletown',
    };
    mockedUseSchoolStorage.mockReturnValue({
      schools: [FAKE_SCHOOL, beta],
      status: 'ready',
      addSchool: vi.fn(),
      updateSchool: vi.fn(),
      deleteSchool: vi.fn(),
    });
    const lessons = [
      createLesson({ id: 'alpha', studentName: 'Alex', date: '2026-09-03', calculatedPrice: 56 }),
      createLesson({
        id: 'beta',
        studentName: 'Robin',
        date: '2026-09-04',
        schoolId: beta.id,
        schoolTitle: beta.title,
        calculatedPrice: 25,
      }),
    ];
    mockLessons(lessons);

    render(<InvoicesPage />);

    expect(screen.getByLabelText(/invoice preview summary/i).textContent).toMatch(/2 invoices for 2 lessons/i);
    expect(screen.getAllByRole('table', { name: /invoice preview/i })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /download all drafts/i }));

    expect(mockedDownload).toHaveBeenCalledWith(
      FAKE_INVOICE_SETTINGS,
      [
        expect.objectContaining({ recipient: expect.objectContaining({ title: 'Alpha Campus' }) }),
        expect.objectContaining({ recipient: expect.objectContaining({ title: 'Beta Campus' }) }),
      ],
      { from: '2026-09-01', to: '2026-09-30' }
    );
  });

  it('blocks download when a lesson in the period has no price', () => {
    mockLessons([
      createLesson({ studentName: 'Alex', date: '2026-09-03', calculatedPrice: null }),
    ]);

    render(<InvoicesPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/1 lesson needs a price/i);
    expect(screen.getByRole('alert').textContent).toMatch(/No price for the lesson for Alex on 03.09.2026/);
    expect(
      (screen.getByRole('button', { name: /download all drafts/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('counts unpriced lessons in the error title', () => {
    mockLessons([
      createLesson({ id: 'first', date: '2026-09-03', calculatedPrice: null }),
      createLesson({ id: 'second', date: '2026-09-04', calculatedPrice: null }),
    ]);

    render(<InvoicesPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/^2 lessons need a price/);
  });

  it('names a lesson without a student by its date in the guard message', () => {
    mockLessons([createLesson({ studentName: '', date: '2026-09-03', calculatedPrice: null })]);

    render(<InvoicesPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/No price for the lesson on 03.09.2026/);
  });

  it('blocks download when a lesson in the period has no school', () => {
    mockLessons([
      createLesson({
        studentName: 'Alex',
        date: '2026-09-03',
        schoolId: null,
        schoolTitle: null,
        calculatedPrice: 56,
      }),
    ]);

    render(<InvoicesPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/needs a school/i);
    expect(screen.getByRole('alert').textContent).toMatch(/No school for the lesson for Alex on 03.09.2026/);
    expect(
      (screen.getByRole('button', { name: /download all drafts/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('blocks download when invoice details are missing', () => {
    mockedUseInvoiceSettings.mockReturnValue({ settings: null, status: 'missing' });
    mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: 56 })]);

    render(<InvoicesPage />);

    expect(screen.getByRole('alert').textContent).toMatch(/not configured/i);
    expect(
      (screen.getByRole('button', { name: /download all drafts/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('does not allow From to be set after To', () => {
    mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: 56 })]);

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
      mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: 56 })]);

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /download all drafts/i }));

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
      fireEvent.click(screen.getByRole('button', { name: /^issue all invoices$/i }));

      const confirm = screen.getByRole('group', { name: /confirm issuing invoices/i });
      expect(confirm.textContent).toContain('Alpha Campus → 12/26');
      expect(confirm.textContent).toContain('Beta Campus → 13/26');
      const confirmText = confirm.textContent ?? '';
      expect(confirmText.indexOf('Alpha Campus')).toBeLessThan(confirmText.indexOf('Beta Campus'));
      expect(mockedIssue).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /confirm and download/i }));

      expect(mockedIssue).toHaveBeenCalledWith([FAKE_SCHOOL.id, WEST_SCHOOL.id], '2026-09-21');
      await waitFor(() =>
        expect(mockedDownload).toHaveBeenCalledWith(
          FAKE_INVOICE_SETTINGS,
          [
            expect.objectContaining({ recipient: expect.objectContaining({ title: 'Alpha Campus' }) }),
            expect.objectContaining({ recipient: expect.objectContaining({ title: 'Beta Campus' }) }),
          ],
          { from: '2026-09-01', to: '2026-09-30' },
          issued
        )
      );
    });

    it('cancel leaves numbers unassigned', () => {
      mockTwoSchoolPeriod();

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /^issue all invoices$/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('group', { name: /confirm issuing invoices/i })).toBeNull();
      expect(mockedIssue).not.toHaveBeenCalled();
    });

    it('shows issued numbers, offers Download again, and only issues the remaining school', async () => {
      mockTwoSchoolPeriod();
      const alphaIssued = issuedFor(FAKE_SCHOOL.id, 12);
      mockIssued([alphaIssued], 13);

      render(<InvoicesPage />);

      const alpha = screen.getByRole('region', { name: /invoice for alpha campus gmbh/i });
      expect(alpha.textContent).toContain('Issued as 12/26 on 20.09.2026');
      expect(screen.getByRole('region', { name: /invoice for beta campus gmbh/i }).textContent).not.toContain(
        'Issued as'
      );

      fireEvent.click(screen.getByRole('button', { name: /download issued invoice 12\/26 again/i }));
      await waitFor(() =>
        expect(mockedDownload).toHaveBeenCalledWith(
          FAKE_INVOICE_SETTINGS,
          [expect.objectContaining({ recipient: expect.objectContaining({ title: 'Alpha Campus' }) })],
          { from: '2026-09-01', to: '2026-09-30' },
          [alphaIssued]
        )
      );
      expect(mockedIssue).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /^issue all invoices$/i }));
      const confirm = screen.getByRole('group', { name: /confirm issuing invoices/i });
      expect(confirm.textContent).toContain('Beta Campus → 13/26');
      expect(confirm.textContent).not.toContain('Alpha Campus');
    });

    it('disables Issue once every school in the period has a number', () => {
      mockTwoSchoolPeriod();
      mockIssued([issuedFor(FAKE_SCHOOL.id, 12), issuedFor(WEST_SCHOOL.id, 13)], 14);

      render(<InvoicesPage />);

      expect((screen.getByRole('button', { name: /^issue all invoices$/i }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.queryByRole('button', { name: /^issue invoice for/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /download draft invoice/i })).toBeNull();
      expect(
        (screen.getByRole('button', { name: /download all drafts/i }) as HTMLButtonElement).disabled
      ).toBe(false);
    });

    it('blocks issuing while lessons in the period are unpriced', () => {
      mockLessons([createLesson({ date: '2026-09-03', calculatedPrice: null })]);

      render(<InvoicesPage />);

      expect((screen.getByRole('button', { name: /^issue all invoices$/i }) as HTMLButtonElement).disabled).toBe(true);
      expect(
        (screen.getByRole('button', { name: /issue invoice for alpha campus/i }) as HTMLButtonElement).disabled
      ).toBe(true);
    });

    it('numbers the first invoice of a new year 01/yy', () => {
      vi.setSystemTime(new Date('2027-01-01T09:00:00Z'));
      mockLessons([createLesson({ date: '2026-12-10', calculatedPrice: 56 })]);
      mockIssued([], 1);

      render(<InvoicesPage />);
      fireEvent.change(screen.getByLabelText(/invoice period start date/i), { target: { value: '2026-12-01' } });
      fireEvent.change(screen.getByLabelText(/invoice period end date/i), { target: { value: '2026-12-31' } });
      expect(screen.getByRole('button', { name: /issue invoice for alpha campus as 01\/27/i })).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /^issue all invoices$/i }));

      expect(mockedUseIssuedInvoices).toHaveBeenLastCalledWith('2026-12-01', '2026-12-31', 2027);
      expect(screen.getByRole('group', { name: /confirm issuing invoices/i }).textContent).toContain(
        'Alpha Campus → 01/27'
      );
    });
  });
  describe('issuing one invoice at a time', () => {
    it('offers each card the next free number and issues only that school after confirming', async () => {
      mockTwoSchoolPeriod();
      const betaIssued = issuedFor(WEST_SCHOOL.id, 12);
      mockedIssue.mockResolvedValueOnce([betaIssued]);

      render(<InvoicesPage />);

      expect(screen.getByRole('button', { name: /issue invoice for alpha campus as 12\/26/i })).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /issue invoice for beta campus as 12\/26/i }));

      const confirm = screen.getByRole('group', { name: /confirm issuing invoice for beta campus/i });
      expect(confirm.textContent).toContain('Issue invoice for Beta Campus as 12/26 dated 21.09.2026');
      expect(screen.queryByRole('group', { name: /confirm issuing invoice for alpha campus/i })).toBeNull();
      expect(mockedIssue).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /confirm and download/i }));

      expect(mockedIssue).toHaveBeenCalledWith([WEST_SCHOOL.id], '2026-09-21');
      await waitFor(() =>
        expect(mockedDownload).toHaveBeenCalledWith(
          FAKE_INVOICE_SETTINGS,
          [expect.objectContaining({ recipient: expect.objectContaining({ title: 'Beta Campus' }) })],
          { from: '2026-09-01', to: '2026-09-30' },
          [betaIssued]
        )
      );
      expect(screen.queryByRole('group', { name: /confirm issuing invoice for beta campus/i })).toBeNull();
    });

    it('cancel closes the card confirmation without issuing', () => {
      mockTwoSchoolPeriod();

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /issue invoice for alpha campus/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('group', { name: /confirm issuing invoice for alpha campus/i })).toBeNull();
      expect(mockedIssue).not.toHaveBeenCalled();
    });

    it('keeps only one confirmation open at a time, switching from either entry point', () => {
      mockTwoSchoolPeriod();

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /^issue all invoices$/i }));
      fireEvent.click(screen.getByRole('button', { name: /issue invoice for alpha campus/i }));

      expect(screen.queryByRole('group', { name: /confirm issuing invoices/i })).toBeNull();
      expect(screen.getByRole('group', { name: /confirm issuing invoice for alpha campus/i })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /^issue all invoices$/i }));

      expect(screen.queryByRole('group', { name: /confirm issuing invoice for alpha campus/i })).toBeNull();
      expect(screen.getByRole('group', { name: /confirm issuing invoices/i })).toBeDefined();
    });

    it('keeps Cancel reachable when issued numbers fail to load while a card confirmation is open', () => {
      mockTwoSchoolPeriod();

      const { rerender } = render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /issue invoice for alpha campus/i }));
      mockedUseIssuedInvoices.mockReturnValue({ status: 'error', invoices: [], nextNumber: null, issue: mockedIssue });
      rerender(<InvoicesPage />);

      const confirm = screen.getByRole('group', { name: /confirm issuing invoice for alpha campus/i });
      expect(confirm.textContent).toContain('Issue invoice for Alpha Campus dated');
      expect((screen.getByRole('button', { name: /confirm and download/i }) as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('group', { name: /confirm issuing invoice for alpha campus/i })).toBeNull();
      expect(mockedIssue).not.toHaveBeenCalled();
    });

    it('keeps Cancel reachable when the Issue all list empties while it is open', () => {
      mockTwoSchoolPeriod();

      const { rerender } = render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /^issue all invoices$/i }));
      mockIssued([issuedFor(FAKE_SCHOOL.id, 12), issuedFor(WEST_SCHOOL.id, 13)], 14);
      rerender(<InvoicesPage />);

      expect((screen.getByRole('button', { name: /confirm and download/i }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('group', { name: /confirm issuing invoices/i })).toBeNull();
      expect((screen.getByRole('button', { name: /^issue all invoices$/i }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows the issued state on the card and moves the next number up for the others', () => {
      mockTwoSchoolPeriod();
      mockIssued([issuedFor(FAKE_SCHOOL.id, 12)], 13);

      render(<InvoicesPage />);

      const alpha = screen.getByRole('region', { name: /invoice for alpha campus gmbh/i });
      expect(alpha.textContent).toContain('Issued as 12/26');
      expect(screen.queryByRole('button', { name: /issue invoice for alpha campus/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /download draft invoice for alpha campus/i })).toBeNull();
      expect(screen.getByRole('button', { name: /issue invoice for beta campus as 13\/26/i })).toBeDefined();
    });

    it('lets Beta be issued while Alpha has an unpriced lesson, and blocks Issue all', async () => {
      mockTwoSchoolPeriod();
      mockLessons([
        createLesson({ id: 'alpha', date: '2026-09-03', calculatedPrice: null }),
        createLesson({ id: 'beta', date: '2026-09-04', schoolId: WEST_SCHOOL.id, schoolTitle: WEST_SCHOOL.title }),
      ]);
      mockedIssue.mockResolvedValueOnce([issuedFor(WEST_SCHOOL.id, 12)]);

      render(<InvoicesPage />);

      expect((screen.getByRole('button', { name: /^issue all invoices$/i }) as HTMLButtonElement).disabled).toBe(true);
      expect(
        (screen.getByRole('button', { name: /download all drafts/i }) as HTMLButtonElement).disabled
      ).toBe(true);
      const alphaIssue = screen.getByRole('button', { name: /issue invoice for alpha campus/i }) as HTMLButtonElement;
      const alphaDraft = screen.getByRole('button', {
        name: /download draft invoice for alpha campus/i,
      }) as HTMLButtonElement;
      expect(alphaIssue.disabled).toBe(true);
      expect(alphaDraft.disabled).toBe(true);
      expect(screen.getByRole('region', { name: /invoice for alpha campus gmbh/i }).textContent).toMatch(
        /not ready to issue.*price every lesson for this school/i
      );
      expect(screen.getByRole('region', { name: /invoice for beta campus gmbh/i }).textContent).not.toMatch(
        /price every lesson/i
      );
      expect(screen.getByRole('alert').textContent).toMatch(
        /every lesson needs a price before its school’s invoice can be exported or issued/i
      );

      fireEvent.click(screen.getByRole('button', { name: /issue invoice for beta campus as 12\/26/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm and download/i }));

      expect(mockedIssue).toHaveBeenCalledWith([WEST_SCHOOL.id], '2026-09-21');
      await waitFor(() => expect(mockedDownload).toHaveBeenCalledTimes(1));
    });

    it.each([
      ['no school', { schoolId: null, schoolTitle: null }],
      ['an unknown school', { schoolId: 'school-missing', schoolTitle: 'Gone' }],
    ])('blocks every card while a lesson has %s', (_label, schoolFields) => {
      mockLessons([
        createLesson({ id: 'alpha', date: '2026-09-03' }),
        createLesson({ id: 'stray', date: '2026-09-05', ...schoolFields }),
      ]);

      render(<InvoicesPage />);

      expect(
        (screen.getByRole('button', { name: /issue invoice for alpha campus/i }) as HTMLButtonElement).disabled
      ).toBe(true);
      expect(
        (screen.getByRole('button', { name: /download draft invoice for alpha campus/i }) as HTMLButtonElement)
          .disabled
      ).toBe(true);
      expect((screen.getByRole('button', { name: /^issue all invoices$/i }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('blocks card issuing while issued numbers cannot be loaded', () => {
      mockLessons([createLesson({ date: '2026-09-03' })]);
      mockedUseIssuedInvoices.mockReturnValue({ status: 'error', invoices: [], nextNumber: null, issue: mockedIssue });

      render(<InvoicesPage />);

      const issue = screen.getByRole('button', { name: /^issue invoice for alpha campus$/i }) as HTMLButtonElement;
      expect(issue.disabled).toBe(true);
      expect(issue.textContent).toBe('Issue');
      expect(
        (screen.getByRole('button', { name: /download draft invoice for alpha campus/i }) as HTMLButtonElement)
          .disabled
      ).toBe(false);
    });

    it('downloads a single draft from its card without issuing', () => {
      mockTwoSchoolPeriod();

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /download draft invoice for beta campus/i }));

      expect(mockedIssue).not.toHaveBeenCalled();
      expect(mockedDownload).toHaveBeenCalledWith(
        FAKE_INVOICE_SETTINGS,
        [expect.objectContaining({ recipient: expect.objectContaining({ title: 'Beta Campus' }) })],
        { from: '2026-09-01', to: '2026-09-30' },
        []
      );
    });

    it('keeps the confirmation open and shows the error when issuing fails', async () => {
      mockTwoSchoolPeriod();
      mockedIssue.mockRejectedValueOnce(new Error('Server unavailable'));

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /issue invoice for alpha campus/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm and download/i }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Server unavailable');
      fireEvent.click(screen.getByRole('button', { name: /dismiss message/i }));
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('group', { name: /confirm issuing invoice for alpha campus/i })).toBeDefined();
      expect(mockedDownload).not.toHaveBeenCalled();
    });

    it('asks to use Download again when the PDF fails after issuing', async () => {
      mockTwoSchoolPeriod();
      mockedIssue.mockResolvedValueOnce([issuedFor(FAKE_SCHOOL.id, 12)]);
      mockedDownload.mockRejectedValueOnce(new Error('PDF failed'));

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /issue invoice for alpha campus/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm and download/i }));

      expect((await screen.findByRole('alert')).textContent).toMatch(/numbers were issued.*download again.*pdf failed/i);
    });

    it('closes an open card confirmation when the period changes', () => {
      mockTwoSchoolPeriod();

      render(<InvoicesPage />);
      fireEvent.click(screen.getByRole('button', { name: /issue invoice for alpha campus/i }));
      fireEvent.change(screen.getByLabelText(/invoice period start date/i), { target: { value: '2026-09-02' } });

      expect(screen.queryByRole('group', { name: /confirm issuing invoice for alpha campus/i })).toBeNull();
    });
  });
});
