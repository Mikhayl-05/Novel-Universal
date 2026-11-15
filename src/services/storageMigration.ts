export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEYS = {
  THEME: 'novel-theme',
  FONT_SCALE: 'novel-font-scale',
  FOCUS_MODE: 'novel-focus-mode',
  REDUCE_MOTION: 'novel-reduce-motion',
  STORAGE_VERSION: 'ruang-karya-storage-version',
} as const;

export const CURRENT_STORAGE_VERSION = '2';

export interface ProgressRecord {
  chapterId: string;
  updatedAt: number;
}

export function getWorkProgressKey(workSlug: string): string {
  return `ruang-karya:v2:progress:${workSlug}`;
}

export function getWorkFavoritesKey(workSlug: string): string {
  return `ruang-karya:v2:favorites:${workSlug}`;
}

export function getWorkNotesKey(workSlug: string): string {
  return `ruang-karya:v2:notes:${workSlug}`;
}
