export interface Lesson {
  id: string;
  studentName: string;
  date: string;
  duration: number;
  comment: string;
  createdAt: number;
}

export interface LessonFormData {
  studentName: string;
  date: string;
  duration: number;
  comment: string;
}

export interface LessonValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof LessonFormData, string>>;
}
