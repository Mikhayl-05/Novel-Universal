import type { BgmKey, VfxKey, WorkType } from '../../types/novel';

export type ChapterStatus = 'draft' | 'published' | 'archived';
export type NovelStatus = 'draft' | 'published' | 'archived';
export type VfxTriggerMode = 'scroll_40' | 'immediate' | 'none';
export type RevisionKind = 'autosave' | 'manual' | 'publish' | 'restore' | 'import';
export type SaveState = 'saved' | 'saving' | 'syncing' | 'offline' | 'error' | 'conflict';
export type StudioViewMode =
  | 'editor'
  | 'preview-chapter'
  | 'preview-novel'
  | 'preview-published';
export type MarginPreset = 'narrow' | 'normal' | 'wide';
export type NarrativeVariant = 'flashback' | 'chat' | 'letter' | 'timestamp' | 'note';

export interface TiptapMarkJson {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNodeJson {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNodeJson[];
  marks?: TiptapMarkJson[];
  text?: string;
}

export interface TiptapDocJson {
  type: 'doc';
  content: TiptapNodeJson[];
}

export interface AdminProfile {
  userId: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'super_admin';
  isActive: boolean;
}

export interface StudioNovel {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  synopsis: string;
  authorName: string;
  coverImageUrl: string | null;
  workType: WorkType;
  status: NovelStatus;
  defaultBgm: BgmKey;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterStudioMetadata {
  marginPreset?: MarginPreset;
  notes?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface StudioChapter {
  id: string;
  novelId: string;
  legacyId: string | null;
  legacyIndex: number | null;
  sortOrder: number;

  // Draft / Active workspace fields
  num: string;
  title: string;
  setting: string;
  feeling: string;
  isPrologue: boolean;
  isEnding: boolean;
  status: ChapterStatus;

  draftDoc: TiptapDocJson;
  draftHtml: string;
  draftBgm: BgmKey;
  draftBgmUrl: string | null;
  draftBgmVolume: number;
  draftBgmLoop: boolean;
  draftEffect: VfxKey;
  draftVfxTrigger: VfxTriggerMode;
  draftVfxDurationMs: number;
  draftMetadata: ChapterStudioMetadata;
  draftVersion: number;

  // Published snapshot fields
  publishedDoc: TiptapDocJson | null;
  publishedHtml: string | null;
  publishedNum: string | null;
  publishedTitle: string | null;
  publishedSetting: string | null;
  publishedFeeling: string | null;
  publishedIsPrologue: boolean | null;
  publishedIsEnding: boolean | null;
  publishedBgm: BgmKey | null;
  publishedBgmUrl: string | null;
  publishedBgmVolume: number | null;
  publishedBgmLoop: boolean | null;
  publishedEffect: VfxKey | null;
  publishedVfxTrigger: VfxTriggerMode | null;
  publishedVfxDurationMs: number | null;
  publishedAt: string | null;
  publishedVersion: number;

  updatedAt: string;
  createdAt: string;
}

export interface StudioChapterRevision {
  id: string;
  chapterId: string;
  revisionNumber: number;
  revisionKind: RevisionKind;
  num: string;
  title: string;
  setting: string;
  feeling: string | null;
  docJson: TiptapDocJson;
  htmlSnapshot: string;
  audioVfxSnapshot: {
    bgm?: BgmKey;
    bgm_url?: string | null;
    bgm_volume?: number;
    bgm_loop?: boolean;
    effect?: VfxKey;
    vfx_trigger?: VfxTriggerMode;
    vfx_duration_ms?: number;
  };
  createdAt: string;
}

export interface StudioChapterAsset {
  id: string;
  novelId: string;
  chapterId: string | null;
  assetType: 'image' | 'audio' | 'sfx' | 'cover' | 'attachment';
  label: string;
  assetKey: string | null;
  url: string;
  mimeType: string | null;
  byteSize: number | null;
  createdAt: string;
}

export interface DocumentOutlineItem {
  id: string;
  kind: 'heading' | 'chapter-heading' | 'scene-break' | 'dialogue' | 'cue';
  level: number;
  label: string;
  posIndex: number;
}

export interface DocumentMetrics {
  wordCount: number;
  characterCount: number;
  characterCountNoSpaces: number;
  pageCount: number;
  paragraphCount: number;
  dialogueCount: number;
}

export interface ConflictPayload {
  chapterId: string;
  localVersion: number;
  serverVersion: number;
  serverUpdatedAt: string;
  serverChapter: StudioChapter;
}

export interface LocalDraftBackup {
  chapterId: string;
  novelId: string;
  baseVersion: number;
  baseUpdatedAt: string;
  dirty: boolean;
  savedAt: number;
  patch: {
    num: string;
    title: string;
    setting: string;
    feeling: string;
    isPrologue: boolean;
    isEnding: boolean;
    draftDoc: TiptapDocJson;
    draftHtml: string;
    draftBgm: BgmKey;
    draftBgmUrl: string | null;
    draftBgmVolume: number;
    draftBgmLoop: boolean;
    draftEffect: VfxKey;
    draftVfxTrigger: VfxTriggerMode;
    draftVfxDurationMs: number;
    draftMetadata: ChapterStudioMetadata;
  };
}
