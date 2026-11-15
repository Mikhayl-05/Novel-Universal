import type { StudioNovelSummary } from '../types/studio';

export const DEFAULT_DAILY_WORD_TARGET = 1000;
export const MIN_DAILY_WORD_TARGET = 50;
export const MAX_DAILY_WORD_TARGET = 50000;

export interface HubWritingStats {
  totalWords: number;
  totalChapters: number;
  activeProjectsCount: number;
  publishedProjectsCount: number;
  draftProjectsCount: number;
  archivedProjectsCount: number;
}

export interface DailyWritingProgress {
  date: string;
  baselineWords: number;
  wordsToday: number;
}

export interface KeyValueStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function clampDailyWordTarget(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_DAILY_WORD_TARGET;
  const rounded = Math.round(raw);
  return Math.min(MAX_DAILY_WORD_TARGET, Math.max(MIN_DAILY_WORD_TARGET, rounded));
}

export function computeHubWritingStats(
  works: StudioNovelSummary[],
): HubWritingStats {
  let totalWords = 0;
  let totalChapters = 0;
  let publishedProjectsCount = 0;
  let draftProjectsCount = 0;
  let archivedProjectsCount = 0;

  for (const work of works) {
    totalWords += Math.max(0, work.wordCount || 0);
    totalChapters += Math.max(0, work.chapterCount || 0);
    if (work.status === 'archived') {
      archivedProjectsCount += 1;
    } else if (work.status === 'published') {
      publishedProjectsCount += 1;
    } else {
      draftProjectsCount += 1;
    }
  }

  return {
    totalWords,
    totalChapters,
    activeProjectsCount: publishedProjectsCount + draftProjectsCount,
    publishedProjectsCount,
    draftProjectsCount,
    archivedProjectsCount,
  };
}

function getBrowserStorage(storage?: KeyValueStorageLike | null): KeyValueStorageLike | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function targetStorageKey(userKey?: string | null): string {
  return `novel-studio-daily-target:${userKey || 'default'}`;
}

function progressStorageKey(userKey?: string | null): string {
  return `novel-studio-daily-progress:${userKey || 'default'}`;
}

export function loadDailyWordTarget(
  userKey?: string | null,
  storage?: KeyValueStorageLike | null,
): number {
  const store = getBrowserStorage(storage);
  if (!store) return DEFAULT_DAILY_WORD_TARGET;
  const raw = store.getItem(targetStorageKey(userKey));
  if (!raw) return DEFAULT_DAILY_WORD_TARGET;
  const parsed = Number(raw);
  return Number.isFinite(parsed)
    ? clampDailyWordTarget(parsed)
    : DEFAULT_DAILY_WORD_TARGET;
}

export function saveDailyWordTarget(
  target: number,
  userKey?: string | null,
  storage?: KeyValueStorageLike | null,
): number {
  const clamped = clampDailyWordTarget(target);
  const store = getBrowserStorage(storage);
  if (store) {
    store.setItem(targetStorageKey(userKey), String(clamped));
  }
  return clamped;
}

export function syncDailyWritingProgress(
  totalWords: number,
  options?: {
    userKey?: string | null;
    todayKey?: string;
    storage?: KeyValueStorageLike | null;
  },
): DailyWritingProgress {
  const today = options?.todayKey ?? getLocalDateKey();
  const safeTotal = Math.max(0, Math.round(totalWords));
  const store = getBrowserStorage(options?.storage);
  const key = progressStorageKey(options?.userKey);

  if (!store) {
    return {
      date: today,
      baselineWords: safeTotal,
      wordsToday: 0,
    };
  }

  let existing: DailyWritingProgress | null = null;
  try {
    const raw = store.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DailyWritingProgress>;
      if (
        typeof parsed.date === 'string' &&
        typeof parsed.baselineWords === 'number' &&
        Number.isFinite(parsed.baselineWords)
      ) {
        existing = {
          date: parsed.date,
          baselineWords: Math.max(0, parsed.baselineWords),
          wordsToday: Math.max(0, Number(parsed.wordsToday ?? 0)),
        };
      }
    }
  } catch {
    existing = null;
  }

  let next: DailyWritingProgress;
  if (!existing || existing.date !== today) {
    next = {
      date: today,
      baselineWords: safeTotal,
      wordsToday: 0,
    };
  } else {
    const nextBaseline =
      safeTotal < existing.baselineWords ? safeTotal : existing.baselineWords;
    next = {
      date: today,
      baselineWords: nextBaseline,
      wordsToday: Math.max(0, safeTotal - nextBaseline),
    };
  }

  try {
    store.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors cleanly
  }

  return next;
}
