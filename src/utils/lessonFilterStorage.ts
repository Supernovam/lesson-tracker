import { isPlausibleDate } from './dateRange';
import { ALL_DATES, type LessonPeriod } from './lessonTableData';

const STORAGE_KEY = 'lesson-tracker:lesson-filters';

/** Filter choices the user changed on the lesson list; missing fields fall back to defaults. */
export type SavedLessonFilters = {
  period?: LessonPeriod;
  schoolId?: string;
};

function readStorage(): SavedLessonFilters {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const { period, schoolId } = parsed as Record<string, unknown>;
    const saved: SavedLessonFilters = {};
    if (period === ALL_DATES) {
      saved.period = ALL_DATES;
    } else if (period && typeof period === 'object') {
      const { from, to } = period as Record<string, unknown>;
      if (isPlausibleDate(from) && isPlausibleDate(to) && from <= to) saved.period = { from, to };
    }
    if (typeof schoolId === 'string' && schoolId) saved.schoolId = schoolId;
    return saved;
  } catch {
    // Storage blocked or corrupt: behave as if nothing was saved.
    return {};
  }
}

export function loadLessonFilters(): SavedLessonFilters {
  return readStorage();
}

export function saveLessonFilters(update: SavedLessonFilters): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStorage(), ...update }));
  } catch {
    // Storage blocked or full: the filter still applies for this visit.
  }
}
