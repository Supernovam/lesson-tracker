import type { DurationUnit } from '../utils/durationUnit';

export interface LessonType {
  id: string;
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  durationUnit: DurationUnit;
  /** Lessons using this type; the unit cannot change while it is above 0. */
  lessonCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface LessonTypeFormData {
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  durationUnit: DurationUnit;
}

export interface LessonTypeValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof LessonTypeFormData, string>>;
}
