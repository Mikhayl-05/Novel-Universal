import type { BgmKey, Chapter, PublishedWork, VfxKey, WorkType } from '../../types/novel';
import type {
  AdminProfile,
  ChapterStatus,
  ChapterStudioMetadata,
  NovelStatus,
  RevisionKind,
  StudioChapter,
  StudioChapterAsset,
  StudioChapterRevision,
  StudioNovel,
  TiptapDocJson,
  VfxTriggerMode,
} from '../types/studio';
import {
  EMPTY_TIPTAP_DOC,
  parseLegacyHtmlToTiptapDoc,
  serializeTiptapDocToReaderHtml,
} from '../utils/novelContentCodec';
import { getSupabaseClient, requireSupabaseClient } from './supabaseClient';

const STORAGE_BUCKET = 'novel-assets';

interface DbNovelRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  synopsis: string | null;
  author_name: string | null;
  cover_image_url: string | null;
  work_type: WorkType | null;
  status: NovelStatus;
  default_bgm: string | null;
  created_at: string;
  updated_at: string;
}

interface DbChapterRow {
  id: string;
  novel_id: string;
  legacy_id: string | null;
  legacy_index: number | null;
  sort_order: number;
  num: string;
  title: string;
  setting: string | null;
  feeling: string | null;
  is_prologue: boolean;
  is_ending: boolean;
  status: ChapterStatus;
  draft_doc: TiptapDocJson | null;
  draft_html: string | null;
  draft_bgm: string | null;
  draft_bgm_url: string | null;
  draft_bgm_volume: number | null;
  draft_bgm_loop: boolean | null;
  draft_effect: string | null;
  draft_vfx_trigger: VfxTriggerMode | null;
  draft_vfx_duration_ms: number | null;
  draft_metadata: ChapterStudioMetadata | null;
  draft_version: number;
  published_doc: TiptapDocJson | null;
  published_html: string | null;
  published_num: string | null;
  published_title: string | null;
  published_setting: string | null;
  published_feeling: string | null;
  published_is_prologue: boolean | null;
  published_is_ending: boolean | null;
  published_bgm: string | null;
  published_bgm_url: string | null;
  published_bgm_volume: number | null;
  published_bgm_loop: boolean | null;
  published_effect: string | null;
  published_vfx_trigger: VfxTriggerMode | null;
  published_vfx_duration_ms: number | null;
  published_at: string | null;
  published_version: number;
  created_at: string;
  updated_at: string;
}

export interface PublishedReaderChapter extends Chapter {
  bgmVolume?: number;
  bgmLoop?: boolean;
  vfxTrigger?: VfxTriggerMode;
  vfxDurationMs?: number;
}

export interface PublishedWorkReaderPayload {
  work: PublishedWork;
  chapters: PublishedReaderChapter[];
}

function mapNovelRow(row: DbNovelRow): StudioNovel {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? '',
    synopsis: row.synopsis ?? '',
    authorName: row.author_name ?? '',
    coverImageUrl: row.cover_image_url,
    workType: (row.work_type || 'novel') as WorkType,
    status: row.status,
    defaultBgm: (row.default_bgm || 'default') as BgmKey,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChapterRow(row: DbChapterRow): StudioChapter {
  const doc =
    row.draft_doc && row.draft_doc.type === 'doc'
      ? row.draft_doc
      : row.draft_html
        ? parseLegacyHtmlToTiptapDoc(row.draft_html)
        : EMPTY_TIPTAP_DOC;

  return {
    id: row.id,
    novelId: row.novel_id,
    legacyId: row.legacy_id,
    legacyIndex: row.legacy_index,
    sortOrder: row.sort_order,
    num: row.num,
    title: row.title,
    setting: row.setting ?? '',
    feeling: row.feeling ?? '',
    isPrologue: Boolean(row.is_prologue),
    isEnding: Boolean(row.is_ending),
    status: row.status,
    draftDoc: doc,
    draftHtml: row.draft_html ?? serializeTiptapDocToReaderHtml(doc),
    draftBgm: (row.draft_bgm || 'default') as BgmKey,
    draftBgmUrl: row.draft_bgm_url ?? null,
    draftBgmVolume: Number(row.draft_bgm_volume ?? 0.42),
    draftBgmLoop: row.draft_bgm_loop !== false,
    draftEffect: (row.draft_effect || 'none') as VfxKey,
    draftVfxTrigger: row.draft_vfx_trigger ?? 'scroll_40',
    draftVfxDurationMs: Number(row.draft_vfx_duration_ms ?? 25000),
    draftMetadata: row.draft_metadata ?? { marginPreset: 'normal' },
    draftVersion: row.draft_version ?? 1,
    publishedDoc: row.published_doc,
    publishedHtml: row.published_html,
    publishedNum: row.published_num,
    publishedTitle: row.published_title,
    publishedSetting: row.published_setting,
    publishedFeeling: row.published_feeling,
    publishedIsPrologue: row.published_is_prologue,
    publishedIsEnding: row.published_is_ending,
    publishedBgm: row.published_bgm as BgmKey | null,
    publishedBgmUrl: row.published_bgm_url ?? null,
    publishedBgmVolume:
      row.published_bgm_volume !== null ? Number(row.published_bgm_volume) : null,
    publishedBgmLoop: row.published_bgm_loop,
    publishedEffect: row.published_effect as VfxKey | null,
    publishedVfxTrigger: row.published_vfx_trigger,
    publishedVfxDurationMs: row.published_vfx_duration_ms,
    publishedAt: row.published_at,
    publishedVersion: row.published_version ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function verifyAdminAccess(userId: string): Promise<AdminProfile | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id, email, display_name, role, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
    role: data.role as 'admin' | 'super_admin',
    isActive: data.is_active,
  };
}

/**
 * Public Beranda query — fetches published works along with published chapter counts & opening audio info.
 */
export async function fetchPublishedWorksForBeranda(): Promise<PublishedWork[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data: novelsData, error: novelsErr } = await supabase
    .from('novels')
    .select('*')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (novelsErr || !novelsData || novelsData.length === 0) {
    return [];
  }

  const novelRows = novelsData as DbNovelRow[];
  const novelIds = novelRows.map((n) => n.id);

  const { data: pubData } = await supabase
    .from('chapter_publications')
    .select('chapter_id, novel_id, legacy_id, sort_order, bgm, bgm_url')
    .in('novel_id', novelIds)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  const grouped = new Map<
    string,
    {
      count: number;
      firstChapterId: string | null;
      firstChapterBgm: BgmKey | null;
      firstChapterBgmUrl: string | null;
    }
  >();

  for (const row of pubData || []) {
    const prev = grouped.get(row.novel_id);
    if (!prev) {
      grouped.set(row.novel_id, {
        count: 1,
        firstChapterId: row.legacy_id || row.chapter_id,
        firstChapterBgm: (row.bgm || 'default') as BgmKey,
        firstChapterBgmUrl: row.bgm_url ?? null,
      });
    } else {
      prev.count += 1;
    }
  }

  return novelRows.map((row) => {
    const stats = grouped.get(row.id);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle ?? '',
      synopsis: row.synopsis ?? '',
      authorName: row.author_name ?? '',
      coverImageUrl: row.cover_image_url,
      workType: (row.work_type || 'novel') as WorkType,
      defaultBgm: (row.default_bgm || 'default') as BgmKey,
      publishedChapterCount: stats?.count ?? 0,
      firstChapterId: stats?.firstChapterId ?? null,
      firstChapterBgm: stats?.firstChapterBgm ?? (row.default_bgm as BgmKey) ?? 'default',
      firstChapterBgmUrl: stats?.firstChapterBgmUrl ?? null,
      updatedAt: row.updated_at,
    };
  });
}

/**
 * Public Reader query — fetches a published work by slug and its published snapshots strictly from `chapter_publications`.
 * Anonymous users never touch the `chapters` draft table.
 */
export async function fetchPublishedWorkAndChaptersBySlug(
  slug: string,
): Promise<PublishedWorkReaderPayload | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !slug) return null;

  const { data: novelData, error: novelErr } = await supabase
    .from('novels')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (novelErr || !novelData) {
    return null;
  }

  const novelRow = novelData as DbNovelRow;

  const { data: pubData, error: pubErr } = await supabase
    .from('chapter_publications')
    .select(
      'chapter_id, legacy_id, legacy_index, sort_order, num, title, setting, feeling, is_prologue, is_ending, content_html, bgm, bgm_url, bgm_volume, bgm_loop, effect, vfx_trigger, vfx_duration_ms',
    )
    .eq('novel_id', novelRow.id)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (pubErr || !pubData) {
    return null;
  }

  const chapters: PublishedReaderChapter[] = pubData.map((row, idx) => ({
    id: row.legacy_id || row.chapter_id,
    legacyIndex: row.legacy_index ?? idx,
    num: row.num,
    title: row.title,
    setting: row.setting ?? '',
    feeling: row.feeling ?? undefined,
    isPrologue: Boolean(row.is_prologue),
    isEnding: Boolean(row.is_ending),
    bgm: (row.bgm || novelRow.default_bgm || 'default') as BgmKey,
    bgmUrl: row.bgm_url ?? null,
    bgmVolume: Number(row.bgm_volume ?? 0.42),
    bgmLoop: row.bgm_loop !== false,
    effect: (row.effect || 'none') as VfxKey,
    vfxTrigger: (row.vfx_trigger || 'scroll_40') as VfxTriggerMode,
    vfxDurationMs: Number(row.vfx_duration_ms ?? 25000),
    content: row.content_html,
  }));

  const first = chapters[0] ?? null;

  return {
    work: {
      id: novelRow.id,
      slug: novelRow.slug,
      title: novelRow.title,
      subtitle: novelRow.subtitle ?? '',
      synopsis: novelRow.synopsis ?? '',
      authorName: novelRow.author_name ?? '',
      coverImageUrl: novelRow.cover_image_url,
      workType: (novelRow.work_type || 'novel') as WorkType,
      defaultBgm: (novelRow.default_bgm || 'default') as BgmKey,
      publishedChapterCount: chapters.length,
      firstChapterId: first?.id ?? null,
      firstChapterBgm: first?.bgm ?? (novelRow.default_bgm as BgmKey) ?? 'default',
      firstChapterBgmUrl: first?.bgmUrl ?? null,
      updatedAt: novelRow.updated_at,
    },
    chapters,
  };
}

export async function fetchNovels(): Promise<StudioNovel[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('novels')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as DbNovelRow[]).map(mapNovelRow);
}

export async function createNovel(input: {
  title: string;
  subtitle?: string;
  synopsis?: string;
  authorName?: string;
  workType?: WorkType;
  coverImageUrl?: string | null;
  status?: NovelStatus;
}): Promise<StudioNovel> {
  const supabase = requireSupabaseClient();
  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = `${slugBase || 'karya'}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('novels')
    .insert({
      slug,
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() ?? '',
      synopsis: input.synopsis?.trim() ?? '',
      author_name: input.authorName?.trim() ?? '',
      work_type: input.workType ?? 'novel',
      cover_image_url: input.coverImageUrl?.trim() || null,
      status: input.status ?? 'published',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Gagal membuat karya baru.');
  return mapNovelRow(data as DbNovelRow);
}

export async function updateNovel(
  novelId: string,
  patch: {
    title?: string;
    subtitle?: string;
    synopsis?: string;
    authorName?: string;
    workType?: WorkType;
    coverImageUrl?: string | null;
    status?: NovelStatus;
  },
): Promise<StudioNovel> {
  const supabase = requireSupabaseClient();
  const payload: Record<string, unknown> = {};
  if (typeof patch.title === 'string') payload.title = patch.title.trim();
  if (typeof patch.subtitle === 'string') payload.subtitle = patch.subtitle.trim();
  if (typeof patch.synopsis === 'string') payload.synopsis = patch.synopsis.trim();
  if (typeof patch.authorName === 'string') payload.author_name = patch.authorName.trim();
  if (patch.workType) payload.work_type = patch.workType;
  if (patch.coverImageUrl !== undefined) {
    payload.cover_image_url = patch.coverImageUrl ? patch.coverImageUrl.trim() : null;
  }
  if (patch.status) payload.status = patch.status;

  const { data, error } = await supabase
    .from('novels')
    .update(payload)
    .eq('id', novelId)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Gagal memperbarui pengaturan karya.');
  }
  return mapNovelRow(data as DbNovelRow);
}

export async function deleteNovelById(novelId: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.from('novels').delete().eq('id', novelId);
  if (error) throw new Error(error.message);
}

export async function fetchChaptersByNovel(novelId: string): Promise<StudioChapter[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('novel_id', novelId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as DbChapterRow[]).map(mapChapterRow);
}

export async function fetchChapterById(chapterId: string): Promise<StudioChapter> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', chapterId)
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Gagal memuat ulang bab dari server.');
  }
  return mapChapterRow(data as DbChapterRow);
}

export async function insertChapter(chapter: StudioChapter): Promise<StudioChapter> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('chapters')
    .insert({
      id: chapter.id,
      novel_id: chapter.novelId,
      legacy_id: chapter.legacyId,
      legacy_index: chapter.legacyIndex,
      sort_order: chapter.sortOrder,
      num: chapter.num,
      title: chapter.title,
      setting: chapter.setting,
      feeling: chapter.feeling || null,
      is_prologue: chapter.isPrologue,
      is_ending: chapter.isEnding,
      status: chapter.status,
      draft_doc: chapter.draftDoc,
      draft_html: chapter.draftHtml,
      draft_bgm: chapter.draftBgm,
      draft_bgm_url: chapter.draftBgmUrl,
      draft_bgm_volume: chapter.draftBgmVolume,
      draft_bgm_loop: chapter.draftBgmLoop,
      draft_effect: chapter.draftEffect,
      draft_vfx_trigger: chapter.draftVfxTrigger,
      draft_vfx_duration_ms: chapter.draftVfxDurationMs,
      draft_metadata: chapter.draftMetadata,
      draft_version: chapter.draftVersion,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Gagal menyimpan bab baru.');
  return mapChapterRow(data as DbChapterRow);
}

export async function deleteChapterById(chapterId: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.from('chapters').delete().eq('id', chapterId);
  if (error) throw new Error(error.message);
}

export async function updateChapterStatusById(
  chapterId: string,
  status: ChapterStatus,
): Promise<StudioChapter> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('chapters')
    .update({ status })
    .eq('id', chapterId)
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Gagal mengubah status bab.');
  return mapChapterRow(data as DbChapterRow);
}

export async function persistChapterSortOrders(
  orderedChapters: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  const supabase = requireSupabaseClient();
  await Promise.all(
    orderedChapters.map(async ({ id, sortOrder }) => {
      const { error } = await supabase
        .from('chapters')
        .update({ sort_order: sortOrder })
        .eq('id', id);
      if (error) throw new Error(error.message);

      await supabase
        .from('chapter_publications')
        .update({ sort_order: sortOrder })
        .eq('chapter_id', id);
    }),
  );
}

export interface SaveDraftPatch {
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
}

export type OptimisticSaveResult =
  | { kind: 'ok'; chapter: StudioChapter }
  | { kind: 'conflict'; serverChapter: StudioChapter };

export async function saveChapterDraftWithConcurrency(
  chapterId: string,
  expectedVersion: number,
  patch: SaveDraftPatch,
  forceOverwrite = false,
): Promise<OptimisticSaveResult> {
  const supabase = requireSupabaseClient();

  let effectiveVersion = expectedVersion;
  if (forceOverwrite) {
    const { data: latestRow, error: latestErr } = await supabase
      .from('chapters')
      .select('draft_version')
      .eq('id', chapterId)
      .single();
    if (latestErr || !latestRow) {
      throw new Error(latestErr?.message || 'Bab tidak ditemukan saat force overwrite.');
    }
    effectiveVersion = Number(latestRow.draft_version ?? expectedVersion);
  }

  const nextVersion = effectiveVersion + 1;
  const { data, error } = await supabase
    .from('chapters')
    .update({
      num: patch.num,
      title: patch.title,
      setting: patch.setting,
      feeling: patch.feeling || null,
      is_prologue: patch.isPrologue,
      is_ending: patch.isEnding,
      draft_doc: patch.draftDoc,
      draft_html: patch.draftHtml,
      draft_bgm: patch.draftBgm,
      draft_bgm_url: patch.draftBgmUrl,
      draft_bgm_volume: patch.draftBgmVolume,
      draft_bgm_loop: patch.draftBgmLoop,
      draft_effect: patch.draftEffect,
      draft_vfx_trigger: patch.draftVfxTrigger,
      draft_vfx_duration_ms: patch.draftVfxDurationMs,
      draft_metadata: patch.draftMetadata,
      draft_version: nextVersion,
    })
    .eq('id', chapterId)
    .eq('draft_version', effectiveVersion)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const { data: currentServer, error: fetchErr } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', chapterId)
      .single();
    if (fetchErr || !currentServer) {
      throw new Error(fetchErr?.message || 'Terjadi konflik versi dokumen.');
    }
    return {
      kind: 'conflict',
      serverChapter: mapChapterRow(currentServer as DbChapterRow),
    };
  }

  return {
    kind: 'ok',
    chapter: mapChapterRow(data as DbChapterRow),
  };
}

export async function publishChapterRpc(chapterId: string): Promise<StudioChapter> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc('publish_chapter', {
    p_chapter_id: chapterId,
  });
  if (error || !data) {
    throw new Error(error?.message || 'Gagal memublikasikan bab.');
  }
  return mapChapterRow(data as DbChapterRow);
}

export async function fetchChapterRevisions(
  chapterId: string,
): Promise<StudioChapterRevision[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('chapter_revisions')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('revision_number', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    chapterId: row.chapter_id,
    revisionNumber: row.revision_number,
    revisionKind: row.revision_kind as RevisionKind,
    num: row.num,
    title: row.title,
    setting: row.setting ?? '',
    feeling: row.feeling,
    docJson: row.doc_json as TiptapDocJson,
    htmlSnapshot: row.html_snapshot,
    audioVfxSnapshot: row.audio_vfx_snapshot ?? {},
    createdAt: row.created_at,
  }));
}

export async function createChapterRevision(
  chapter: StudioChapter,
  kind: RevisionKind,
): Promise<StudioChapterRevision> {
  const supabase = requireSupabaseClient();
  const { data: latestRev } = await supabase
    .from('chapter_revisions')
    .select('revision_number')
    .eq('chapter_id', chapter.id)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNum = Number(latestRev?.revision_number ?? 0) + 1;
  const { data, error } = await supabase
    .from('chapter_revisions')
    .insert({
      chapter_id: chapter.id,
      revision_number: nextNum,
      revision_kind: kind,
      num: chapter.num,
      title: chapter.title,
      setting: chapter.setting,
      feeling: chapter.feeling || null,
      doc_json: chapter.draftDoc,
      html_snapshot: chapter.draftHtml,
      audio_vfx_snapshot: {
        bgm: chapter.draftBgm,
        bgm_url: chapter.draftBgmUrl,
        bgm_volume: chapter.draftBgmVolume,
        bgm_loop: chapter.draftBgmLoop,
        effect: chapter.draftEffect,
        vfx_trigger: chapter.draftVfxTrigger,
        vfx_duration_ms: chapter.draftVfxDurationMs,
      },
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message || 'Gagal membuat revision.');
  return {
    id: data.id,
    chapterId: data.chapter_id,
    revisionNumber: data.revision_number,
    revisionKind: data.revision_kind as RevisionKind,
    num: data.num,
    title: data.title,
    setting: data.setting ?? '',
    feeling: data.feeling,
    docJson: data.doc_json as TiptapDocJson,
    htmlSnapshot: data.html_snapshot,
    audioVfxSnapshot: data.audio_vfx_snapshot ?? {},
    createdAt: data.created_at,
  };
}

export async function fetchNovelAssets(
  novelId: string,
): Promise<StudioChapterAsset[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('chapter_assets')
    .select('*')
    .eq('novel_id', novelId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    novelId: row.novel_id,
    chapterId: row.chapter_id,
    assetType: row.asset_type,
    label: row.label,
    assetKey: row.asset_key,
    url: row.url,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    createdAt: row.created_at,
  }));
}

export async function registerNovelAsset(input: {
  novelId: string;
  chapterId?: string | null;
  assetType: 'image' | 'audio' | 'sfx' | 'cover' | 'attachment';
  label: string;
  assetKey?: string | null;
  url: string;
  mimeType?: string | null;
  byteSize?: number | null;
}): Promise<StudioChapterAsset> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('chapter_assets')
    .insert({
      novel_id: input.novelId,
      chapter_id: input.chapterId ?? null,
      asset_type: input.assetType,
      label: input.label.trim(),
      asset_key: input.assetKey ?? null,
      url: input.url.trim(),
      mime_type: input.mimeType ?? null,
      byte_size: input.byteSize ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Gagal menyimpan aset.');
  return {
    id: data.id,
    novelId: data.novel_id,
    chapterId: data.chapter_id,
    assetType: data.asset_type,
    label: data.label,
    assetKey: data.asset_key,
    url: data.url,
    mimeType: data.mime_type,
    byteSize: data.byte_size,
    createdAt: data.created_at,
  };
}

/**
 * Uploads an audio, SFX, image, or cover file directly to Supabase Storage (`novel-assets` bucket)
 * and registers the resulting public URL in `chapter_assets`.
 */
export async function uploadNovelAssetFile(input: {
  novelId: string;
  chapterId?: string | null;
  assetType: 'image' | 'audio' | 'sfx' | 'cover' | 'attachment';
  file: File;
  label?: string;
}): Promise<StudioChapterAsset> {
  const supabase = requireSupabaseClient();
  const cleanName = input.file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const storagePath = `${input.novelId}/${input.assetType}/${Date.now()}-${cleanName || 'asset'}`;

  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: input.file.type || undefined,
    });

  if (uploadErr) {
    throw new Error(
      `Gagal mengunggah file ke Storage (${STORAGE_BUCKET}): ${uploadErr.message}`,
    );
  }

  const { data: pubUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  const label =
    input.label?.trim() ||
    input.file.name.replace(/\.[^.]+$/, '') ||
    `${input.assetType}-${Date.now()}`;

  return registerNovelAsset({
    novelId: input.novelId,
    chapterId: input.chapterId ?? null,
    assetType: input.assetType,
    label,
    assetKey: storagePath,
    url: pubUrlData.publicUrl,
    mimeType: input.file.type || null,
    byteSize: input.file.size,
  });
}

/**
 * Uploads a standalone cover image directly to Supabase Storage (before or after work creation).
 */
export async function uploadCoverImageFile(file: File): Promise<string> {
  const supabase = requireSupabaseClient();
  const cleanName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const storagePath = `covers/${Date.now()}-${cleanName || 'cover.jpg'}`;

  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadErr) {
    throw new Error(
      `Gagal mengunggah sampul ke Storage (${STORAGE_BUCKET}): ${uploadErr.message}`,
    );
  }

  const { data: pubUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return pubUrlData.publicUrl;
}

export async function deleteNovelAsset(asset: StudioChapterAsset): Promise<void> {
  const supabase = requireSupabaseClient();
  if (asset.assetKey && asset.url.includes(`/${STORAGE_BUCKET}/`)) {
    await supabase.storage.from(STORAGE_BUCKET).remove([asset.assetKey]).catch(() => {});
  }
  const { error } = await supabase.from('chapter_assets').delete().eq('id', asset.id);
  if (error) throw new Error(error.message);
}

export function subscribeToNovelChapterUpdates(
  novelId: string,
  onRemoteChapterUpdate: (chapter: StudioChapter) => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`studio-chapters:${novelId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chapters',
        filter: `novel_id=eq.${novelId}`,
      },
      (payload) => {
        if (payload.new) {
          onRemoteChapterUpdate(mapChapterRow(payload.new as DbChapterRow));
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
