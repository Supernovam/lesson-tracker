export interface InvoiceSettings {
  issuerName: string;
  issuerStreet: string;
  issuerPostalCode: string;
  issuerCity: string;
  issuerPhone: string;
  issuerEmail: string;
  issuerTaxNumber: string;
  issuerIban: string;
  issuerBic: string;
}

export interface InvoiceRecipient {
  schoolId: string;
  title: string;
  billingName: string;
  addressLines: string[];
}

/** A Rechnungsnummer persisted for one school and billing period. */
export interface IssuedInvoice {
  schoolId: string;
  from: string;
  to: string;
  year: number;
  number: number;
  issuedOn: string;
}
