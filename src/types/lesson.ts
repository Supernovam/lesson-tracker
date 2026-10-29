import type { DurationUnit } from '../utils/durationUnit';

export interface Lesson {
  id: string;
  studentName: string;
  date: string;
  /** In `durationUnit`: minutes, or teaching units such as 3.2. */
  duration: number;
  durationUnit: DurationUnit;
  comment: string;
  createdAt: number;
  lessonTypeId: string | null;
  lessonTypeName: string | null;
  schoolId: string | null;
  schoolTitle: string | null;
  calculatedPrice: number | null;
}

export interface LessonFormData {
  studentName: string;
  date: string;
  duration: number;
  comment: string;
  lessonTypeId: string;
  schoolId: string;
}

export interface LessonValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof LessonFormData, string>>;
}
