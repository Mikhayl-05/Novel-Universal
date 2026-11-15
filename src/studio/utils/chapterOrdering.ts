import type { WorkType } from '../../types/novel';
import type { StudioChapter } from '../types/studio';
import {
  EMPTY_TIPTAP_DOC,
  serializeTiptapDocToReaderHtml,
} from './novelContentCodec';

export function generateStableUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function normalizeSortOrders(chapters: StudioChapter[]): StudioChapter[] {
  return chapters.map((ch, idx) => ({
    ...ch,
    sortOrder: idx,
  }));
}

export function reorderChaptersByIds(
  chapters: StudioChapter[],
  draggedId: string,
  targetId: string,
): StudioChapter[] {
  if (draggedId === targetId) return chapters;
  const fromIdx = chapters.findIndex((c) => c.id === draggedId);
  const toIdx = chapters.findIndex((c) => c.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return chapters;

  const copy = [...chapters];
  const [moved] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, moved);
  return normalizeSortOrders(copy);
}

export function moveChapterByDelta(
  chapters: StudioChapter[],
  chapterId: string,
  delta: -1 | 1,
): StudioChapter[] {
  const idx = chapters.findIndex((c) => c.id === chapterId);
  if (idx === -1) return chapters;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= chapters.length) return chapters;
  return reorderChaptersByIds(chapters, chapterId, chapters[targetIdx].id);
}

export function createNewChapterPayload(
  novelId: string,
  existingChapters: StudioChapter[],
  overrides?: Partial<StudioChapter> & { workType?: WorkType },
): StudioChapter {
  const now = new Date().toISOString();
  const nextOrder =
    existingChapters.length > 0
      ? Math.max(...existingChapters.map((c) => c.sortOrder)) + 1
      : 0;
  const nextNumber = existingChapters.filter((c) => !c.isPrologue).length + 1;
  const initialDoc = overrides?.draftDoc ?? {
    type: 'doc' as const,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
  };
  const draftHtml =
    overrides?.draftHtml ?? serializeTiptapDocToReaderHtml(initialDoc);

  const workType = overrides?.workType ?? 'novel';
  const defaultNum =
    workType === 'cerpen'
      ? nextNumber === 1
        ? 'Cerita Pendek'
        : `Bagian ${nextNumber}`
      : workType === 'notes'
        ? nextNumber === 1
          ? 'Catatan'
          : `Bagian ${nextNumber}`
        : `Bab ${nextNumber}`;

  const defaultTitle =
    workType === 'cerpen'
      ? 'Judul Cerpen Baru'
      : workType === 'notes'
        ? 'Catatan Tanpa Judul'
        : 'Bab Tanpa Judul';

  return {
    id: generateStableUuid(),
    novelId,
    legacyId: null,
    legacyIndex: null,
    sortOrder: nextOrder,
    num: overrides?.num ?? defaultNum,
    title: overrides?.title ?? defaultTitle,
    setting: overrides?.setting ?? '',
    feeling: overrides?.feeling ?? '',
    isPrologue: overrides?.isPrologue ?? false,
    isEnding: overrides?.isEnding ?? false,
    status: 'draft',
    draftDoc: initialDoc.content.length > 0 ? initialDoc : EMPTY_TIPTAP_DOC,
    draftHtml,
    draftBgm: overrides?.draftBgm ?? 'default',
    draftBgmUrl: overrides?.draftBgmUrl ?? null,
    draftBgmVolume: overrides?.draftBgmVolume ?? 0.42,
    draftBgmLoop: overrides?.draftBgmLoop ?? true,
    draftEffect: overrides?.draftEffect ?? 'none',
    draftVfxTrigger: overrides?.draftVfxTrigger ?? 'scroll_40',
    draftVfxDurationMs: overrides?.draftVfxDurationMs ?? 25000,
    draftMetadata: overrides?.draftMetadata ?? { marginPreset: 'normal' },
    draftVersion: overrides?.draftVersion ?? 1,
    publishedDoc: null,
    publishedHtml: null,
    publishedNum: null,
    publishedTitle: null,
    publishedSetting: null,
    publishedFeeling: null,
    publishedIsPrologue: null,
    publishedIsEnding: null,
    publishedBgm: null,
    publishedBgmUrl: null,
    publishedBgmVolume: null,
    publishedBgmLoop: null,
    publishedEffect: null,
    publishedVfxTrigger: null,
    publishedVfxDurationMs: null,
    publishedAt: null,
    publishedVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateChapterPayload(
  source: StudioChapter,
  existingChapters: StudioChapter[],
): { duplicated: StudioChapter; reordered: StudioChapter[] } {
  const now = new Date().toISOString();
  const duplicated: StudioChapter = {
    ...source,
    id: generateStableUuid(),
    legacyId: null,
    legacyIndex: null,
    num: `${source.num} (Salinan)`,
    title: `${source.title} (Salinan)`,
    status: 'draft',
    draftVersion: 1,
    publishedDoc: null,
    publishedHtml: null,
    publishedNum: null,
    publishedTitle: null,
    publishedSetting: null,
    publishedFeeling: null,
    publishedIsPrologue: null,
    publishedIsEnding: null,
    publishedBgm: null,
    publishedBgmUrl: null,
    publishedBgmVolume: null,
    publishedBgmLoop: null,
    publishedEffect: null,
    publishedVfxTrigger: null,
    publishedVfxDurationMs: null,
    publishedAt: null,
    publishedVersion: 0,
    createdAt: now,
    updatedAt: now,
  };

  const sourceIdx = existingChapters.findIndex((c) => c.id === source.id);
  const copy = [...existingChapters];
  const insertAt = sourceIdx === -1 ? copy.length : sourceIdx + 1;
  copy.splice(insertAt, 0, duplicated);
  const reordered = normalizeSortOrders(copy);
  const syncedDuplicated =
    reordered.find((c) => c.id === duplicated.id) ?? duplicated;

  return {
    duplicated: syncedDuplicated,
    reordered,
  };
}

export interface ConflictCheckInput {
  localBaseVersion: number;
  localBaseUpdatedAt: string;
  serverVersion: number;
  serverUpdatedAt: string;
}

export function detectVersionConflict(input: ConflictCheckInput): boolean {
  if (input.serverVersion > input.localBaseVersion) {
    return true;
  }
  if (
    input.serverUpdatedAt &&
    input.localBaseUpdatedAt &&
    Date.parse(input.serverUpdatedAt) > Date.parse(input.localBaseUpdatedAt) &&
    input.serverVersion !== input.localBaseVersion
  ) {
    return true;
  }
  return false;
}

export function hasUnpublishedChanges(chapter: StudioChapter): boolean {
  if (chapter.status === 'draft' || !chapter.publishedAt) return true;
  return (
    chapter.draftHtml !== (chapter.publishedHtml ?? '') ||
    chapter.num !== (chapter.publishedNum ?? '') ||
    chapter.title !== (chapter.publishedTitle ?? '') ||
    chapter.setting !== (chapter.publishedSetting ?? '') ||
    (chapter.feeling || '') !== (chapter.publishedFeeling || '') ||
    chapter.isPrologue !== Boolean(chapter.publishedIsPrologue) ||
    chapter.isEnding !== Boolean(chapter.publishedIsEnding) ||
    chapter.draftBgm !== (chapter.publishedBgm ?? 'default') ||
    (chapter.draftBgmUrl ?? null) !== (chapter.publishedBgmUrl ?? null) ||
    chapter.draftEffect !== (chapter.publishedEffect ?? 'none')
  );
}

/**
 * Determines whether the ProseMirror instance should call `setContent`.
 * Autosave `draftVersion` increments MUST NOT trigger `setContent`, otherwise the
 * author's typing cursor jumps back to position 0 mid-keystroke.
 */
export function shouldReloadEditorDocument(input: {
  loadedChapterId: string | null;
  nextChapterId: string | null;
  syncedReloadCounter: number;
  reloadCounter: number;
}): boolean {
  if (!input.nextChapterId) return false;
  if (input.loadedChapterId !== input.nextChapterId) return true;
  return input.syncedReloadCounter !== input.reloadCounter;
}

export function shouldClearPendingSave(
  dispatchedSeq: number,
  latestEditSeq: number,
): boolean {
  return latestEditSeq <= dispatchedSeq;
}

/**
 * Merges server-assigned version/timestamp metadata after autosave completes.
 * When newer keystrokes were entered while the network request was in flight,
 * preserve the newer local draft content instead of overwriting it with the stale response.
 */
export function mergeSyncedChapterMetadata(
  current: StudioChapter,
  synced: StudioChapter,
  preserveNewerLocalEdits: boolean,
): StudioChapter {
  if (!preserveNewerLocalEdits) {
    return synced;
  }
  return {
    ...current,
    status: synced.status,
    draftVersion: synced.draftVersion,
    updatedAt: synced.updatedAt,
    publishedAt: synced.publishedAt,
    publishedVersion: synced.publishedVersion,
  };
}

export function hasLocalBackupChanges(
  chapter: StudioChapter,
  patch: {
    num: string;
    title: string;
    setting: string;
    feeling: string;
    isPrologue: boolean;
    isEnding: boolean;
    draftHtml: string;
    draftBgm: string;
    draftBgmUrl: string | null;
    draftBgmVolume: number;
    draftBgmLoop: boolean;
    draftEffect: string;
    draftVfxTrigger: string;
    draftVfxDurationMs: number;
  },
): boolean {
  return (
    chapter.num !== patch.num ||
    chapter.title !== patch.title ||
    chapter.setting !== patch.setting ||
    (chapter.feeling || '') !== (patch.feeling || '') ||
    chapter.isPrologue !== patch.isPrologue ||
    chapter.isEnding !== patch.isEnding ||
    chapter.draftHtml !== patch.draftHtml ||
    chapter.draftBgm !== patch.draftBgm ||
    (chapter.draftBgmUrl ?? null) !== (patch.draftBgmUrl ?? null) ||
    chapter.draftBgmVolume !== patch.draftBgmVolume ||
    chapter.draftBgmLoop !== patch.draftBgmLoop ||
    chapter.draftEffect !== patch.draftEffect ||
    chapter.draftVfxTrigger !== patch.draftVfxTrigger ||
    chapter.draftVfxDurationMs !== patch.draftVfxDurationMs
  );
}
