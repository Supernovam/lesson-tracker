import type { InvoiceRecipient, InvoiceSettings } from '../types/invoice';
import type { Lesson } from '../types/lesson';
import type { School } from '../types/school';

/** Synthetic parties for tests — never copy live issuer or school values into the repo. */
export const FAKE_INVOICE_SETTINGS: InvoiceSettings = {
  issuerName: 'Jane Issuer',
  issuerStreet: 'Example Str. 1',
  issuerPostalCode: '12345',
  issuerCity: 'Example City',
  issuerPhone: '00490000000000',
  issuerEmail: 'issuer@example.com',
  issuerTaxNumber: '00/ 000/ 00000',
  issuerIban: 'DE00 0000 0000 0000 0000 00',
  issuerBic: 'EXAMPLXX',
};

export const FAKE_SCHOOL: School = {
  id: 'school-alpha',
  title: 'Alpha Campus',
  billingName: 'Alpha Campus GmbH',
  address: 'Client Str. 2\n54321 Client City',
  createdAt: 1,
  updatedAt: 1,
};

export const FAKE_RECIPIENT: InvoiceRecipient = {
  schoolId: FAKE_SCHOOL.id,
  title: FAKE_SCHOOL.title,
  billingName: FAKE_SCHOOL.billingName,
  addressLines: ['Client Str. 2', '54321 Client City'],
};

export function createLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'lesson-1',
    studentName: 'Alex',
    date: '2026-09-03',
    duration: 60,
    comment: '',
    createdAt: 1,
    lessonTypeId: 'type-1',
    lessonTypeName: 'Type A',
    schoolId: FAKE_SCHOOL.id,
    schoolTitle: FAKE_SCHOOL.title,
    calculatedPrice: 37.33,
    ...overrides,
  };
}
