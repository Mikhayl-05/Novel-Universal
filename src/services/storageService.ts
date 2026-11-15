import type {
  ChapterId,
  MigratedStorageState,
  NotesStore,
  ThemeMode,
} from '../types/novel';
import {
  getWorkFavoritesKey,
  getWorkNotesKey,
  getWorkProgressKey,
  STORAGE_KEYS,
  type ProgressRecord,
  type StorageLike,
} from './storageMigration';

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function clampFontScale(scale: number): number {
  if (!Number.isFinite(scale)) return 100;
  return Math.max(50, Math.min(160, Math.round(scale)));
}

export function loadGlobalReaderPreferences(storageOverride?: StorageLike): {
  theme: ThemeMode;
  fontScale: number;
  focusMode: boolean;
  reduceMotion: boolean;
} {
  const storage = storageOverride ?? getBrowserStorage();
  const osPrefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!storage) {
    return {
      theme: 'dark',
      fontScale: 100,
      focusMode: false,
      reduceMotion: osPrefersReducedMotion,
    };
  }

  const rawTheme = storage.getItem(STORAGE_KEYS.THEME);
  const theme: ThemeMode = rawTheme === 'light' ? 'light' : 'dark';

  const rawScale = parseInt(storage.getItem(STORAGE_KEYS.FONT_SCALE) || '100', 10);
  const fontScale = clampFontScale(Number.isNaN(rawScale) ? 100 : rawScale);

  const focusMode = storage.getItem(STORAGE_KEYS.FOCUS_MODE) === 'true';

  const storedReduceMotion = storage.getItem(STORAGE_KEYS.REDUCE_MOTION);
  const reduceMotion =
    storedReduceMotion === 'true' ||
    (storedReduceMotion === null && osPrefersReducedMotion);

  return { theme, fontScale, focusMode, reduceMotion };
}

export function loadWorkReaderState(
  workSlug: string,
  validChapterIds?: ReadonlySet<string>,
  storageOverride?: StorageLike,
): {
  currentChapterId: ChapterId;
  favorites: ChapterId[];
  notes: NotesStore;
} {
  const storage = storageOverride ?? getBrowserStorage();
  if (!storage || !workSlug) {
    return { currentChapterId: '', favorites: [], notes: {} };
  }

  const progress = safeJsonParse<Partial<ProgressRecord> | null>(
    storage.getItem(getWorkProgressKey(workSlug)),
    null,
  );
  const rawProgressId = typeof progress?.chapterId === 'string' ? progress.chapterId : '';
  const currentChapterId =
    rawProgressId && (!validChapterIds || validChapterIds.has(rawProgressId))
      ? rawProgressId
      : '';

  const rawFavs = safeJsonParse<unknown>(
    storage.getItem(getWorkFavoritesKey(workSlug)),
    [],
  );
  const favorites = Array.isArray(rawFavs)
    ? rawFavs.filter(
        (id): id is string =>
          typeof id === 'string' && (!validChapterIds || validChapterIds.has(id)),
      )
    : [];

  const rawNotes = safeJsonParse<unknown>(
    storage.getItem(getWorkNotesKey(workSlug)),
    {},
  );
  const notes: NotesStore = {};
  if (rawNotes && typeof rawNotes === 'object' && !Array.isArray(rawNotes)) {
    for (const [id, entry] of Object.entries(rawNotes)) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { note?: unknown }).note === 'string' &&
        (!validChapterIds || validChapterIds.has(id))
      ) {
        notes[id] = entry as NotesStore[string];
      }
    }
  }

  return { currentChapterId, favorites, notes };
}

export function loadInitialStorageState(
  workSlug = '',
  validChapterIds?: ReadonlySet<string>,
  storageOverride?: StorageLike,
): MigratedStorageState {
  const prefs = loadGlobalReaderPreferences(storageOverride);
  const workState = loadWorkReaderState(workSlug, validChapterIds, storageOverride);
  return {
    ...prefs,
    ...workState,
  };
}

export function saveCurrentChapterProgress(
  workSlug: string,
  chapterId: ChapterId,
  storageOverride?: StorageLike,
): void {
  const storage = storageOverride ?? getBrowserStorage();
  if (!storage || !workSlug || !chapterId) return;
  const payload: ProgressRecord = { chapterId, updatedAt: Date.now() };
  storage.setItem(getWorkProgressKey(workSlug), JSON.stringify(payload));
}

export function saveFavorites(
  workSlug: string,
  favorites: ChapterId[],
  storageOverride?: StorageLike,
): void {
  const storage = storageOverride ?? getBrowserStorage();
  if (!storage || !workSlug) return;
  storage.setItem(getWorkFavoritesKey(workSlug), JSON.stringify(favorites));
}

export function saveNotesStore(
  workSlug: string,
  notes: NotesStore,
  storageOverride?: StorageLike,
): void {
  const storage = storageOverride ?? getBrowserStorage();
  if (!storage || !workSlug) return;
  storage.setItem(getWorkNotesKey(workSlug), JSON.stringify(notes));
}

export function saveThemePreference(
  theme: ThemeMode,
  storageOverride?: StorageLike,
): void {
  const storage = storageOverride ?? getBrowserStorage();
  storage?.setItem(STORAGE_KEYS.THEME, theme);
}

export function saveFontScalePreference(
  scale: number,
  storageOverride?: StorageLike,
): void {
  const storage = storageOverride ?? getBrowserStorage();
  storage?.setItem(STORAGE_KEYS.FONT_SCALE, String(clampFontScale(scale)));
}

export function saveFocusModePreference(
  isActive: boolean,
  storageOverride?: StorageLike,
): void {
  const storage = storageOverride ?? getBrowserStorage();
  storage?.setItem(STORAGE_KEYS.FOCUS_MODE, isActive ? 'true' : 'false');
}

export function saveReduceMotionPreference(
  isActive: boolean,
  storageOverride?: StorageLike,
): void {
  const storage = storageOverride ?? getBrowserStorage();
  storage?.setItem(STORAGE_KEYS.REDUCE_MOTION, isActive ? 'true' : 'false');
}

export function hasManualReduceMotionOverride(
  storageOverride?: StorageLike,
): boolean {
  const storage = storageOverride ?? getBrowserStorage();
  if (!storage) return false;
  return storage.getItem(STORAGE_KEYS.REDUCE_MOTION) !== null;
}
