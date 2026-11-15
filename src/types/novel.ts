export type ThemeMode = 'dark' | 'light';

export type WorkType = 'novel' | 'cerpen' | 'notes';

export type DrawerTab = 'all' | 'favorites';

export type BgmKey =
  | 'default'
  | 'about_you'
  | 'somebody'
  | 'robbers'
  | 'breathe'
  | 'watchsleep'
  | 'kota'
  | 'cute';

export type VfxKey =
  | 'none'
  | 'purple_butterfly'
  | 'pasir_jambu'
  | 'dust_motes'
  | 'red_fog'
  | 'ice_teh'
  | 'sketch_lines'
  | 'love_pop';

export type ChapterId = string;

export interface RawChapter {
  num: string;
  title: string;
  setting: string;
  feeling?: string;
  isPrologue?: boolean;
  isEnding?: boolean;
  bgm?: BgmKey;
  bgmUrl?: string | null;
  bgmVolume?: number;
  bgmLoop?: boolean;
  effect?: VfxKey;
  vfxTrigger?: 'scroll_40' | 'immediate' | 'none';
  vfxDurationMs?: number;
  content: string;
}

export interface Chapter extends RawChapter {
  id: ChapterId;
  legacyIndex?: number;
}

export interface PublishedWork {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  synopsis: string;
  authorName: string;
  coverImageUrl: string | null;
  workType: WorkType;
  defaultBgm: BgmKey;
  publishedChapterCount: number;
  firstChapterId: string | null;
  firstChapterBgm: BgmKey | null;
  firstChapterBgmUrl: string | null;
  updatedAt: string;
}

export interface NoteEntry {
  chapterId: ChapterId;
  chapterIndex?: number;
  note: string;
  updatedAt: number;
}

export type NotesStore = Record<ChapterId, NoteEntry>;

export interface SearchIndexEntry {
  chapterId: ChapterId;
  contentText: string;
  contentLower: string;
}

export interface SearchMatchInfo {
  matchTitle: boolean;
  snippetHtml: string | null;
}

export interface MigratedStorageState {
  currentChapterId: ChapterId;
  favorites: ChapterId[];
  notes: NotesStore;
  theme: ThemeMode;
  fontScale: number;
  focusMode: boolean;
  reduceMotion: boolean;
}
