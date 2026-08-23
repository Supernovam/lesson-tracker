export interface Lesson {
  id: string;
  studentName: string;
  date: string;
  duration: number;
  comment: string;
  createdAt: number;
  lessonTypeId: string | null;
  lessonTypeName: string | null;
  calculatedPrice: number | null;
}

export interface LessonFormData {
  studentName: string;
  date: string;
  duration: number;
  comment: string;
  lessonTypeId: string;
}

export interface LessonValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof LessonFormData, string>>;
}
