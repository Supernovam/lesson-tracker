export interface School {
  id: string;
  title: string;
  billingName: string;
  address: string;
  createdAt: number;
  updatedAt: number;
}

export interface SchoolFormData {
  title: string;
  billingName: string;
  address: string;
}

export interface SchoolValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof SchoolFormData, string>>;
}
