export interface LessonType {
  id: string;
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export interface LessonTypeFormData {
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
}

export interface LessonTypeValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof LessonTypeFormData, string>>;
}
