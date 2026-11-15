import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEditor } from '@tiptap/react';
import {
  ArrowLeft,
  Check,
  CloudOff,
  ExternalLink,
  Eye,
  Loader2,
  LogOut,
  Moon,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Save,
  Sun,
  UploadCloud,
  X,
} from 'lucide-react';
import { VisualEffectsLayer } from '../../components/VisualEffectsLayer';
import type { VfxKey, WorkType } from '../../types/novel';
import { AdminLoginView } from '../components/AdminLoginView';
import { DocumentWorkspaceCanvas } from '../components/DocumentWorkspaceCanvas';
import { SlashCommandMenu } from '../components/SlashCommandMenu';
import { StudioHubView } from '../components/StudioHubView';
import { StudioInspectorPanel } from '../components/StudioInspectorPanel';
import { StudioLivePreview } from '../components/StudioLivePreview';
import { StudioMenuBar } from '../components/StudioMenuBar';
import {
  StudioMobileDock,
  StudioMobileFormatSheet,
  StudioMobileMoreSheet,
  type MobileSheetKind,
} from '../components/StudioMobileDock';
import {
  ConflictBanner,
  DeleteChapterModal,
  InsertLinkModal,
  NewWorkModal,
  PublishModal,
  ShortcutsModal,
  WordCountModal,
  WorkSettingsModal,
} from '../components/StudioModals';
import { StudioSidebar } from '../components/StudioSidebar';
import { StudioToolbar } from '../components/StudioToolbar';
import { createNovelEditorExtensions } from '../editor/novelExtensions';
import { useStudioAuth } from '../hooks/useStudioAuth';
import { useStudioAutosave } from '../hooks/useStudioAutosave';
import {
  createChapterRevision,
  createNovel,
  deleteChapterById,
  deleteNovelById,
  fetchChapterById,
  fetchChaptersByNovel,
  fetchNovelsWithStats,
  insertChapter,
  persistChapterSortOrders,
  publishChapterRpc,
  updateChapterStatusById,
  updateNovel,
  type SaveDraftPatch,
} from '../services/studioRepository';
import type {
  DocumentOutlineItem,
  FlushSaveResult,
  MarginPreset,
  NovelStatus,
  StudioChapter,
  StudioChapterAsset,
  StudioChapterRevision,
  StudioNovel,
  StudioNovelSummary,
  StudioViewMode,
  TiptapDocJson,
} from '../types/studio';
import {
  createNewChapterPayload,
  duplicateChapterPayload,
  mergeSyncedChapterMetadata,
  moveChapterByDelta,
  reorderChaptersByIds,
  shouldReloadEditorDocument,
} from '../utils/chapterOrdering';
import {
  EMPTY_TIPTAP_DOC,
  extractDocumentMetrics,
  extractDocumentOutline,
  serializeTiptapDocToReaderHtml,
} from '../utils/novelContentCodec';

const STUDIO_THEME_STORAGE_KEY = 'novel-studio-theme';

function toSummaryFromNovel(
  novel: StudioNovel,
  chapterList: StudioChapter[] = [],
): StudioNovelSummary {
  const latest = chapterList[chapterList.length - 1] ?? null;
  return {
    ...novel,
    chapterCount: chapterList.length,
    publishedCount: chapterList.filter((c) => c.status === 'published').length,
    draftCount: chapterList.filter((c) => c.status === 'draft').length,
    latestChapterId: latest?.id ?? null,
    latestChapterNum: latest?.num ?? null,
    latestChapterTitle: latest?.title ?? null,
    lastActivityAt: latest?.updatedAt ?? novel.updatedAt,
  };
}

export function NovelStudioPage() {
  const auth = useStudioAuth();

  const [studioTheme, setStudioTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY) === 'light'
      ? 'light'
      : 'dark';
  });

  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
  );
  const [studioScreen, setStudioScreen] = useState<'hub' | 'workspace'>('hub');
  const [novels, setNovels] = useState<StudioNovelSummary[]>([]);
  const [loadingHub, setLoadingHub] = useState(false);

  const [activeNovelId, setActiveNovelId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<StudioChapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const [viewMode, setViewMode] = useState<StudioViewMode>('editor');
  const [zoom, setZoom] = useState(1);
  const [showSidebar, setShowSidebar] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 960 : true,
  );
  const [showInspector, setShowInspector] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1180 : true,
  );
  const [showRuler, setShowRuler] = useState(true);
  const [mobileSheet, setMobileSheet] = useState<MobileSheetKind>(null);
  const [findOpen, setFindOpen] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudioChapter | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newNovelOpen, setNewNovelOpen] = useState(false);
  const [creatingNovel, setCreatingNovel] = useState(false);
  const [workSettingsTarget, setWorkSettingsTarget] = useState<StudioNovel | null>(null);
  const [savingWorkSettings, setSavingWorkSettings] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkInitialHref, setLinkInitialHref] = useState('');
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [editorReloadCounter, setEditorReloadCounter] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [testVfx, setTestVfx] = useState<{
    key: number;
    effect: VfxKey;
    durationMs: number;
  } | null>(null);

  const isProgrammaticLoadRef = useRef(false);
  const chaptersRef = useRef<StudioChapter[]>([]);
  const activeChapterRef = useRef<StudioChapter | null>(null);
  const handleManualSaveRef = useRef<(() => Promise<void>) | null>(null);
  const slashKeyDownRef = useRef<((key: string) => boolean) | null>(null);

  const activeNovel = useMemo(
    () => novels.find((n) => n.id === activeNovelId) ?? null,
    [novels, activeNovelId],
  );

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === activeChapterId) ?? chapters[0] ?? null,
    [chapters, activeChapterId],
  );
  chaptersRef.current = chapters;
  activeChapterRef.current = activeChapter;

  const commitChaptersState = useCallback(
    (next: StudioChapter[] | ((prev: StudioChapter[]) => StudioChapter[])) => {
      const resolved =
        typeof next === 'function' ? next(chaptersRef.current) : next;
      chaptersRef.current = resolved;
      setChapters(resolved);
      return resolved;
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => {
      setIsMobileViewport(mq.matches);
      if (!mq.matches) {
        setMobileSheet(null);
      }
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const toggleStudioTheme = useCallback(() => {
    setStudioTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // Apply studio body & theme classes exclusively while /editor is mounted
  useEffect(() => {
    document.body.classList.add('studio-mode');
    document.title = 'Ruang Karya — Studio Editor';
    return () => {
      document.body.classList.remove(
        'studio-mode',
        'studio-theme-dark',
        'studio-theme-light',
      );
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('studio-theme-dark', studioTheme === 'dark');
    document.body.classList.toggle('studio-theme-light', studioTheme === 'light');
  }, [studioTheme]);

  // Listen to VFX test triggers inside studio editor
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ effect?: VfxKey; durationMs?: number }>)
        .detail;
      if (!detail?.effect || detail.effect === 'none') return;
      setTestVfx({
        key: Date.now(),
        effect: detail.effect,
        durationMs: detail.durationMs ?? 25000,
      });
    };
    window.addEventListener('studio:test-vfx', handler);
    return () => window.removeEventListener('studio:test-vfx', handler);
  }, []);

  const handleChapterSynced = useCallback(
    (
      synced: StudioChapter,
      preserveNewerLocalEdits: boolean,
      forceReloadEditor = false,
    ) => {
      commitChaptersState((prev) =>
        prev.map((c) =>
          c.id === synced.id
            ? mergeSyncedChapterMetadata(c, synced, preserveNewerLocalEdits)
            : c,
        ),
      );
      if (forceReloadEditor) {
        setEditorReloadCounter((n) => n + 1);
      }
    },
    [commitChaptersState],
  );

  const handleRecoverLocalBackup = useCallback(
    (chapterId: string, patch: SaveDraftPatch, _baseUpdatedAt: string) => {
      commitChaptersState((prev) =>
        prev.map((ch) =>
          ch.id === chapterId
            ? {
                ...ch,
                ...patch,
              }
            : ch,
        ),
      );
      setEditorReloadCounter((n) => n + 1);
      showNotice('Perubahan lokal yang sempat tertunda dipulihkan & disinkronkan…');
    },
    [commitChaptersState, showNotice],
  );

  const autosave = useStudioAutosave({
    novelId: activeNovelId,
    activeChapter,
    onChapterSynced: handleChapterSynced,
    onRecoverLocalBackup: handleRecoverLocalBackup,
  });

  const reportSaveResult = useCallback(
    (res: FlushSaveResult) => {
      if (res.status === 'saved') {
        showNotice('Tersimpan ke Supabase.');
      } else if (res.status === 'noop') {
        showNotice(res.message || 'Semua perubahan sudah tersimpan di Supabase.');
      } else if (res.status === 'offline') {
        showNotice(
          res.message || 'Sedang offline. Perubahan aman di penyimpanan lokal.',
        );
      } else if (res.status === 'conflict') {
        showNotice(
          res.message || 'Konflik versi terdeteksi. Pilih tindakan di banner.',
        );
      } else {
        showNotice(res.message || 'Gagal menyinkronkan ke Supabase.');
      }
    },
    [showNotice],
  );

  const handleManualSave = useCallback(async () => {
    const result = await autosave.flushSave();
    reportSaveResult(result);
  }, [autosave, reportSaveResult]);
  handleManualSaveRef.current = handleManualSave;

  const updateChapterLocalAndQueueSave = useCallback(
    (chapterId: string, updater: (prev: StudioChapter) => StudioChapter) => {
      const target = chaptersRef.current.find((c) => c.id === chapterId);
      if (!target) return;
      const updated = updater(target);

      commitChaptersState((prev) =>
        prev.map((ch) => (ch.id === chapterId ? updated : ch)),
      );
      if (activeChapterRef.current?.id === chapterId) {
        activeChapterRef.current = updated;
      }

      autosave.scheduleSave(updated.id, updated.draftVersion, {
        num: updated.num,
        title: updated.title,
        setting: updated.setting,
        feeling: updated.feeling,
        isPrologue: updated.isPrologue,
        isEnding: updated.isEnding,
        draftDoc: updated.draftDoc,
        draftHtml: updated.draftHtml,
        draftBgm: updated.draftBgm,
        draftBgmUrl: updated.draftBgmUrl,
        draftBgmVolume: updated.draftBgmVolume,
        draftBgmLoop: updated.draftBgmLoop,
        draftEffect: updated.draftEffect,
        draftVfxTrigger: updated.draftVfxTrigger,
        draftVfxDurationMs: updated.draftVfxDurationMs,
        draftMetadata: updated.draftMetadata,
      });
    },
    [autosave, commitChaptersState],
  );

  const openLinkModalFromEditor = useCallback(() => {
    setLinkModalOpen(true);
  }, []);

  const extensions = useMemo(
    () =>
      createNovelEditorExtensions({
        onSaveShortcut: () => {
          void handleManualSaveRef.current?.();
        },
        onLinkShortcut: () => {
          openLinkModalFromEditor();
        },
        slashKeyDownRef,
      }),
    [openLinkModalFromEditor],
  );

  const editor = useEditor({
    extensions,
    content: activeChapter?.draftDoc ?? EMPTY_TIPTAP_DOC,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: ed }) => {
      if (isProgrammaticLoadRef.current) return;
      const current = activeChapterRef.current;
      if (!current) return;
      const docJson = ed.getJSON() as TiptapDocJson;
      const readerHtml = serializeTiptapDocToReaderHtml(docJson);
      updateChapterLocalAndQueueSave(current.id, (prev) => ({
        ...prev,
        draftDoc: docJson,
        draftHtml: readerHtml,
      }));
    },
  });

  // Update initial href when link modal opens
  useEffect(() => {
    if (!linkModalOpen || !editor) return;
    const attrs = editor.getAttributes('link') as { href?: string };
    setLinkInitialHref(attrs.href || '');
  }, [linkModalOpen, editor]);

  // Synchronize Tiptap editor ONLY when switching active chapter OR explicit reload/recovery.
  const loadedChapterIdRef = useRef<string | null>(null);
  const syncedReloadCounterRef = useRef<number>(0);
  useEffect(() => {
    if (!editor || !activeChapter || studioScreen !== 'workspace') return;
    const shouldReload = shouldReloadEditorDocument({
      loadedChapterId: loadedChapterIdRef.current,
      nextChapterId: activeChapter.id,
      syncedReloadCounter: syncedReloadCounterRef.current,
      reloadCounter: editorReloadCounter,
    });
    if (!shouldReload) return;

    loadedChapterIdRef.current = activeChapter.id;
    syncedReloadCounterRef.current = editorReloadCounter;

    isProgrammaticLoadRef.current = true;
    editor.commands.setContent(activeChapter.draftDoc ?? EMPTY_TIPTAP_DOC, {
      emitUpdate: false,
    });
    isProgrammaticLoadRef.current = false;
  }, [editor, activeChapter, editorReloadCounter, studioScreen]);

  const refreshHubWorks = useCallback(async () => {
    setLoadingHub(true);
    try {
      const list = await fetchNovelsWithStats();
      setNovels(list);
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : 'Gagal memuat daftar karya.',
      );
    } finally {
      setLoadingHub(false);
    }
  }, [showNotice]);

  // Load project summaries for Beranda Studio once authenticated
  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setNovels([]);
      commitChaptersState([]);
      setActiveNovelId(null);
      setActiveChapterId(null);
      setStudioScreen('hub');
      return;
    }

    let cancelled = false;
    setLoadingHub(true);
    void fetchNovelsWithStats()
      .then((list) => {
        if (!cancelled) {
          setNovels(list);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          showNotice(
            err instanceof Error ? err.message : 'Gagal memuat daftar karya.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHub(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.status, commitChaptersState, showNotice]);

  // Global Ctrl/Cmd+S shortcut
  useEffect(() => {
    if (auth.status !== 'authenticated' || studioScreen !== 'workspace') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleManualSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [auth.status, studioScreen, handleManualSave]);

  const openNovelInWorkspace = useCallback(
    async (novelId: string, preferredChapterId?: string | null) => {
      if (studioScreen === 'workspace' && activeChapterRef.current) {
        await autosave.flushSave();
      }
      setActiveNovelId(novelId);
      setLoadingWorkspace(true);
      setStudioScreen('workspace');
      setViewMode('editor');
      setMobileSheet(null);
      try {
        const chList = await fetchChaptersByNovel(novelId);
        commitChaptersState(chList);
        const focusChapter =
          (preferredChapterId &&
            chList.find((c) => c.id === preferredChapterId)) ||
          chList[0] ||
          null;
        setActiveChapterId(focusChapter?.id ?? null);
        setEditorReloadCounter((n) => n + 1);
      } catch (err) {
        showNotice(
          err instanceof Error ? err.message : 'Gagal memuat naskah karya.',
        );
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [autosave, commitChaptersState, showNotice, studioScreen],
  );

  const handleBackToHub = useCallback(async () => {
    await autosave.flushSave();
    setMobileSheet(null);
    setFindOpen(false);
    setViewMode('editor');
    setStudioScreen('hub');
    void refreshHubWorks();
  }, [autosave, refreshHubWorks]);

  const handleSelectNovel = async (novelId: string) => {
    if (!novelId || novelId === activeNovelId) return;
    await openNovelInWorkspace(novelId);
  };

  const handleSelectChapter = async (chapterId: string) => {
    if (chapterId === activeChapterId) {
      setMobileSheet(null);
      return;
    }
    await autosave.flushSave();
    setActiveChapterId(chapterId);
    if (isMobileViewport) {
      setMobileSheet(null);
    } else if (window.innerWidth < 960) {
      setShowSidebar(false);
    }
  };

  const handleNewChapter = async () => {
    if (!activeNovelId) {
      setNewNovelOpen(true);
      return;
    }
    await autosave.flushSave();
    const payload = createNewChapterPayload(activeNovelId, chapters, {
      workType: activeNovel?.workType ?? 'novel',
    });
    const saved = await insertChapter(payload);
    commitChaptersState((prev) => [...prev, saved]);
    setActiveChapterId(saved.id);
    setViewMode('editor');
    setMobileSheet(null);
    showNotice(`Bagian baru "${saved.num}" dibuat.`);
  };

  const handleDuplicateChapter = async (source: StudioChapter) => {
    await autosave.flushSave();
    const { duplicated, reordered } = duplicateChapterPayload(source, chapters);
    const saved = await insertChapter(duplicated);
    const nextList = reordered.map((c) => (c.id === duplicated.id ? saved : c));
    commitChaptersState(nextList);
    await persistChapterSortOrders(
      nextList.map((c) => ({ id: c.id, sortOrder: c.sortOrder })),
    );
    setActiveChapterId(saved.id);
    showNotice(`"${source.title}" berhasil diduplikasi.`);
  };

  const handleArchiveToggle = async (target: StudioChapter) => {
    const nextStatus =
      target.status === 'archived'
        ? target.publishedAt
          ? 'published'
          : 'draft'
        : 'archived';
    const updated = await updateChapterStatusById(target.id, nextStatus);
    commitChaptersState((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );
    showNotice(
      nextStatus === 'archived'
        ? `"${updated.title}" diarsipkan.`
        : `"${updated.title}" dipulihkan dari arsip.`,
    );
  };

  const handleConfirmDeleteChapter = async (target: StudioChapter) => {
    setDeleting(true);
    try {
      await deleteChapterById(target.id);
      const remaining = chapters.filter((c) => c.id !== target.id);
      commitChaptersState(remaining);
      if (activeChapterId === target.id) {
        setActiveChapterId(remaining[0]?.id ?? null);
      }
      setDeleteTarget(null);
      showNotice(`"${target.title}" dihapus permanen.`);
    } finally {
      setDeleting(false);
    }
  };

  const handleReorderChapters = async (draggedId: string, targetId: string) => {
    const reordered = reorderChaptersByIds(chapters, draggedId, targetId);
    commitChaptersState(reordered);
    await persistChapterSortOrders(
      reordered.map((c) => ({ id: c.id, sortOrder: c.sortOrder })),
    );
  };

  const handleMoveChapterDelta = async (chapterId: string, delta: -1 | 1) => {
    const reordered = moveChapterByDelta(chapters, chapterId, delta);
    commitChaptersState(reordered);
    await persistChapterSortOrders(
      reordered.map((c) => ({ id: c.id, sortOrder: c.sortOrder })),
    );
  };

  const handleConfirmPublish = async () => {
    if (!activeChapter) return;
    setPublishing(true);
    try {
      const saveResult = await autosave.flushSave();
      if (
        saveResult.status === 'conflict' ||
        saveResult.status === 'offline' ||
        saveResult.status === 'error'
      ) {
        reportSaveResult(saveResult);
        return;
      }
      const published = await publishChapterRpc(activeChapter.id);
      await createChapterRevision(published, 'publish').catch(() => {});
      commitChaptersState((prev) =>
        prev.map((c) => (c.id === published.id ? published : c)),
      );
      setPublishOpen(false);
      showNotice(`"${published.title}" resmi dipublikasikan ke Reader.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Gagal memublikasikan.');
    } finally {
      setPublishing(false);
    }
  };

  const handleRestoreRevision = async (rev: StudioChapterRevision) => {
    if (!activeChapter || !editor) return;
    const restoredDoc = rev.docJson;
    const restoredHtml = serializeTiptapDocToReaderHtml(restoredDoc);
    isProgrammaticLoadRef.current = true;
    editor.commands.setContent(restoredDoc, { emitUpdate: false });
    isProgrammaticLoadRef.current = false;

    updateChapterLocalAndQueueSave(activeChapter.id, (prev) => ({
      ...prev,
      num: rev.num,
      title: rev.title,
      setting: rev.setting,
      feeling: rev.feeling ?? '',
      draftDoc: restoredDoc,
      draftHtml: restoredHtml,
      draftBgm: rev.audioVfxSnapshot.bgm ?? prev.draftBgm,
      draftBgmUrl: rev.audioVfxSnapshot.bgm_url ?? prev.draftBgmUrl,
      draftBgmVolume: rev.audioVfxSnapshot.bgm_volume ?? prev.draftBgmVolume,
      draftBgmLoop: rev.audioVfxSnapshot.bgm_loop ?? prev.draftBgmLoop,
      draftEffect: rev.audioVfxSnapshot.effect ?? prev.draftEffect,
      draftVfxTrigger: rev.audioVfxSnapshot.vfx_trigger ?? prev.draftVfxTrigger,
      draftVfxDurationMs:
        rev.audioVfxSnapshot.vfx_duration_ms ?? prev.draftVfxDurationMs,
    }));

    const flushed = await autosave.flushSave();
    if (flushed.status === 'saved' && flushed.chapter) {
      await createChapterRevision(flushed.chapter, 'restore').catch(() => {});
    }
    showNotice(`Versi #${rev.revisionNumber} dipulihkan ke draft aktif.`);
  };

  const handleInsertBlock = useCallback(
    (blockType: string) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      switch (blockType) {
        case 'dialogueBlock':
          chain
            .insertContent({
              type: 'dialogueBlock',
              attrs: { speaker: 'Tokoh', align: 'left' },
              content: [{ type: 'text', text: '"Tulis dialog di sini..."' }],
            })
            .run();
          break;
        case 'innerThoughtBlock':
          chain
            .insertContent({
              type: 'innerThoughtBlock',
              attrs: { tone: 'reflective' },
              content: [{ type: 'text', text: 'Monolog batin karakter...' }],
            })
            .run();
          break;
        case 'customNarrativeBlock':
          chain
            .insertContent({
              type: 'customNarrativeBlock',
              attrs: { variant: 'flashback', label: 'Flashback' },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Tulis adegan naratif khusus...' },
                  ],
                },
              ],
            })
            .run();
          break;
        case 'sceneBreak':
          chain
            .insertContent({
              type: 'sceneBreak',
              attrs: { symbol: '✦ ✦ ✦', style: 'ornament' },
            })
            .run();
          break;
        case 'pageBreak':
          chain
            .insertContent({
              type: 'pageBreak',
              attrs: { label: 'Page Break' },
            })
            .run();
          break;
        case 'sfxBlock':
          chain
            .insertContent({
              type: 'sfxBlock',
              attrs: {
                cueName: 'Efek Suara',
                audioUrl: '/audio/cute.mp3',
                trigger: 'scroll',
                volume: 0.7,
              },
            })
            .run();
          break;
        case 'vfxBlock':
          chain
            .insertContent({
              type: 'vfxBlock',
              attrs: {
                effect: 'dust_motes',
                trigger: 'scroll',
                durationMs: 25000,
              },
            })
            .run();
          break;
        case 'bgmCue':
          chain
            .insertContent({
              type: 'bgmCue',
              attrs: {
                bgmKey: 'about_you',
                action: 'play',
                volume: 0.42,
                loop: true,
              },
            })
            .run();
          break;
        case 'chapterHeading':
          chain
            .insertContent({
              type: 'chapterHeading',
              attrs: {
                num: activeChapter?.num || 'Bagian Baru',
                title: activeChapter?.title || 'Sub-bab Baru',
                setting: activeChapter?.setting || '',
              },
            })
            .run();
          break;
        case 'imageBlock':
          chain
            .insertContent({
              type: 'imageBlock',
              attrs: {
                src: '/asset/preview.jpg',
                alt: 'Ilustrasi adegan',
                caption: '',
                width: 'normal',
              },
            })
            .run();
          break;
        default:
          break;
      }
    },
    [editor, activeChapter],
  );

  const handleInsertAsset = (asset: StudioChapterAsset) => {
    if (!editor) return;
    if (asset.assetType === 'image') {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'imageBlock',
          attrs: {
            src: asset.url,
            alt: asset.label,
            caption: asset.label,
            width: 'normal',
          },
        })
        .run();
      if (isMobileViewport) setMobileSheet(null);
      showNotice(`Gambar "${asset.label}" disisipkan.`);
    } else if (asset.assetType === 'sfx') {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'sfxBlock',
          attrs: {
            cueName: asset.label,
            audioUrl: asset.url,
            trigger: 'scroll',
            volume: 0.7,
          },
        })
        .run();
      if (isMobileViewport) setMobileSheet(null);
      showNotice(`SFX "${asset.label}" disisipkan.`);
    }
  };

  const handleJumpToOutlineItem = (item: DocumentOutlineItem) => {
    if (!editor) return;
    let currentTopIndex = 0;
    let targetPos = 1;
    editor.state.doc.forEach((_node, offset) => {
      if (currentTopIndex === item.posIndex) {
        targetPos = offset + 1;
      }
      currentTopIndex += 1;
    });
    editor.chain().focus().setTextSelection(targetPos).scrollIntoView().run();
    if (isMobileViewport) setMobileSheet(null);
  };

  const handleCreateWork = async (input: {
    title: string;
    subtitle: string;
    authorName: string;
    synopsis: string;
    workType: WorkType;
    coverImageUrl: string | null;
    status: NovelStatus;
  }) => {
    setCreatingNovel(true);
    try {
      const created = await createNovel(input);
      const starterPayload = createNewChapterPayload(created.id, [], {
        workType: created.workType,
        num:
          created.workType === 'cerpen'
            ? 'Cerita Pendek'
            : created.workType === 'notes'
              ? 'Catatan'
              : 'Bab 1',
        title: created.title,
      });
      const starterChapter = await insertChapter(starterPayload);

      const summary = toSummaryFromNovel(created, [starterChapter]);
      setNovels((prev) => [summary, ...prev]);
      setActiveNovelId(created.id);
      commitChaptersState([starterChapter]);
      setActiveChapterId(starterChapter.id);
      setEditorReloadCounter((n) => n + 1);
      setStudioScreen('workspace');
      setViewMode('editor');
      setNewNovelOpen(false);
      showNotice(`Karya "${created.title}" berhasil dibuat.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Gagal membuat karya baru.');
    } finally {
      setCreatingNovel(false);
    }
  };

  const handleSaveWorkSettings = async (
    novelId: string,
    patch: {
      title: string;
      subtitle: string;
      authorName: string;
      synopsis: string;
      workType: WorkType;
      coverImageUrl: string | null;
      status: NovelStatus;
    },
  ) => {
    setSavingWorkSettings(true);
    try {
      const updated = await updateNovel(novelId, patch);
      setNovels((prev) =>
        prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)),
      );
      setWorkSettingsTarget(null);
      showNotice(`Pengaturan "${updated.title}" diperbarui.`);
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan karya.',
      );
    } finally {
      setSavingWorkSettings(false);
    }
  };

  const handleDeleteWork = async (target: StudioNovel) => {
    setSavingWorkSettings(true);
    try {
      await deleteNovelById(target.id);
      const remaining = novels.filter((n) => n.id !== target.id);
      setNovels(remaining);
      setWorkSettingsTarget(null);
      if (activeNovelId === target.id) {
        setActiveNovelId(null);
        commitChaptersState([]);
        setActiveChapterId(null);
        setStudioScreen('hub');
      }
      showNotice(`Karya "${target.title}" dihapus permanen.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Gagal menghapus karya.');
    } finally {
      setSavingWorkSettings(false);
    }
  };

  const handleManualRefreshFromServer = async () => {
    if (!activeChapter) return;
    try {
      const saveResult = await autosave.flushSave();
      if (saveResult.status === 'conflict') {
        reportSaveResult(saveResult);
        return;
      }
      const fresh = await fetchChapterById(activeChapter.id);
      handleChapterSynced(fresh, false, true);
      showNotice('Bagian dimuat ulang dari Supabase.');
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : 'Gagal memuat ulang dari server.',
      );
    }
  };

  const metrics = useMemo(
    () => extractDocumentMetrics(activeChapter?.draftDoc),
    [activeChapter?.draftDoc],
  );
  const outline = useMemo(
    () => extractDocumentOutline(activeChapter?.draftDoc),
    [activeChapter?.draftDoc],
  );

  // Security Gate: Never mount studio workspace until admin auth passes
  if (auth.status !== 'authenticated') {
    return (
      <AdminLoginView
        status={auth.status}
        error={auth.error}
        sessionExpiredNotice={auth.sessionExpiredNotice}
        submitting={auth.submitting}
        userEmail={auth.user?.email}
        studioTheme={studioTheme}
        onToggleTheme={toggleStudioTheme}
        onSignIn={auth.signIn}
        onSignOut={auth.signOut}
      />
    );
  }

  const marginPreset: MarginPreset =
    activeChapter?.draftMetadata?.marginPreset ?? 'normal';

  const isSaveBusy =
    autosave.saveState === 'saving' || autosave.saveState === 'syncing';

  const saveStatusText =
    autosave.saveState === 'saving'
      ? 'Menyimpan…'
      : autosave.saveState === 'syncing'
        ? 'Sinkronisasi…'
        : autosave.saveState === 'offline'
          ? 'Offline'
          : autosave.saveState === 'conflict'
            ? 'Konflik versi'
            : autosave.saveState === 'error'
              ? 'Gagal sinkron'
              : autosave.lastSavedAt
                ? `Tersimpan ${new Date(autosave.lastSavedAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Tersimpan';

  const toggleMobileSheet = (target: Exclude<MobileSheetKind, null>) => {
    setMobileSheet((prev) => (prev === target ? null : target));
  };

  return (
    <>
      {studioScreen === 'hub' ? (
        <StudioHubView
          works={novels}
          loading={loadingHub}
          userEmail={auth.adminProfile?.email}
          studioTheme={studioTheme}
          onToggleTheme={toggleStudioTheme}
          onSignOut={() => void auth.signOut()}
          onOpenNewWork={() => setNewNovelOpen(true)}
          onOpenWork={(work) =>
            void openNovelInWorkspace(work.id, work.latestChapterId)
          }
          onOpenWorkSettings={(work) => setWorkSettingsTarget(work)}
        />
      ) : (
        <div
          className={`studio-root studio-allow-select studio-theme-${studioTheme}`}
        >
          {/* Top Document Header Bar */}
          <header className="studio-header">
            <div className="studio-header-left">
              <button
                type="button"
                className="studio-btn studio-btn-secondary studio-btn-sm studio-hub-back-btn"
                title="Kembali ke Beranda Studio (Semua Karya)"
                aria-label="Kembali ke semua proyek"
                onClick={() => void handleBackToHub()}
              >
                <ArrowLeft size={14} />
                <span>Proyek</span>
              </button>

              <div className="studio-doc-heading">
                <div className="studio-doc-title-row">
                  <span className="studio-app-name">
                    {activeNovel?.title || 'Ruang Karya Studio'}
                  </span>
                  {activeChapter && (
                    <>
                      <span className="studio-sep-dot" aria-hidden="true">
                        ·
                      </span>
                      <span className="studio-doc-active-name">
                        {activeChapter.num}: {activeChapter.title}
                      </span>
                    </>
                  )}
                </div>
                <div className="studio-save-status" role="status" aria-live="polite">
                  {isSaveBusy ? (
                    <Loader2 size={12} className="studio-spin" />
                  ) : autosave.saveState === 'offline' ? (
                    <CloudOff size={12} />
                  ) : autosave.saveState === 'error' ? (
                    <RefreshCw size={12} />
                  ) : (
                    <Check size={12} />
                  )}
                  <span className="tabular-nums">{saveStatusText}</span>
                </div>
              </div>
            </div>

            <div className="studio-header-right">
              {!isMobileViewport && (
                <>
                  <button
                    type="button"
                    className="studio-icon-btn"
                    title="Toggle Sidebar Karya"
                    aria-label="Toggle Sidebar Karya"
                    onClick={() => setShowSidebar((v) => !v)}
                  >
                    <PanelLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="studio-icon-btn"
                    title="Toggle Panel Inspektur"
                    aria-label="Toggle Panel Inspektur"
                    onClick={() => setShowInspector((v) => !v)}
                  >
                    <PanelRight size={16} />
                  </button>

                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary studio-btn-sm"
                    title="Simpan draft ke Supabase sekarang (Ctrl+S)"
                    disabled={!activeChapter || isSaveBusy}
                    onClick={() => void handleManualSave()}
                  >
                    {isSaveBusy ? (
                      <Loader2 size={14} className="studio-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>{isSaveBusy ? 'Menyimpan…' : 'Simpan'}</span>
                  </button>

                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary studio-btn-sm studio-theme-toggle-btn"
                    title={
                      studioTheme === 'dark'
                        ? 'Beralih ke Mode Terang'
                        : 'Beralih ke Mode Gelap'
                    }
                    aria-label={
                      studioTheme === 'dark'
                        ? 'Beralih ke Mode Terang'
                        : 'Beralih ke Mode Gelap'
                    }
                    onClick={toggleStudioTheme}
                  >
                    {studioTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    <span className="studio-hide-xs">
                      {studioTheme === 'dark' ? 'Terang' : 'Gelap'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary studio-btn-sm"
                    disabled={!activeChapter}
                    onClick={() =>
                      setViewMode((m) =>
                        m === 'editor' ? 'preview-chapter' : 'editor',
                      )
                    }
                  >
                    <Eye size={14} />
                    <span>{viewMode === 'editor' ? 'Pratinjau' : 'Edit'}</span>
                  </button>

                  <button
                    type="button"
                    className="studio-btn studio-btn-primary studio-btn-sm"
                    disabled={!activeChapter}
                    onClick={() => setPublishOpen(true)}
                  >
                    <UploadCloud size={14} />
                    <span>Publikasikan</span>
                  </button>

                  <Link
                    to={activeNovel ? `/read/${activeNovel.slug}` : '/'}
                    className="studio-btn studio-btn-secondary studio-btn-sm"
                    title="Buka di Reader Publik"
                  >
                    <ExternalLink size={13} />
                    <span className="studio-hide-xs">Reader</span>
                  </Link>

                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary studio-btn-sm"
                    title={`Keluar (${auth.adminProfile?.email ?? ''})`}
                    aria-label="Keluar dari Studio Editor"
                    onClick={() => void auth.signOut()}
                  >
                    <LogOut size={14} />
                    <span className="studio-hide-xs">Keluar</span>
                  </button>
                </>
              )}

              {isMobileViewport && (
                <>
                  <button
                    type="button"
                    className="studio-btn studio-btn-secondary studio-btn-sm"
                    disabled={!activeChapter}
                    aria-label="Pratinjau Reader"
                    onClick={() =>
                      setViewMode((m) =>
                        m === 'editor' ? 'preview-chapter' : 'editor',
                      )
                    }
                  >
                    <Eye size={14} />
                    <span>{viewMode === 'editor' ? 'Preview' : 'Edit'}</span>
                  </button>
                  <button
                    type="button"
                    className="studio-btn studio-btn-primary studio-btn-sm"
                    disabled={!activeChapter}
                    onClick={() => setPublishOpen(true)}
                  >
                    <UploadCloud size={14} />
                    <span>Terbit</span>
                  </button>
                </>
              )}
            </div>
          </header>

          {viewMode === 'editor' ? (
            <>
              <StudioMenuBar
                editor={editor}
                viewMode={viewMode}
                studioTheme={studioTheme}
                showSidebar={showSidebar}
                showInspector={showInspector}
                showRuler={showRuler}
                marginPreset={marginPreset}
                findOpen={findOpen}
                onSetFindOpen={setFindOpen}
                onBackToHub={() => void handleBackToHub()}
                onSaveNow={() => void handleManualSave()}
                onRefreshFromServer={() => void handleManualRefreshFromServer()}
                onNewChapter={() => void handleNewChapter()}
                onDuplicateChapter={() => {
                  if (activeChapter) void handleDuplicateChapter(activeChapter);
                }}
                onOpenNewNovel={() => setNewNovelOpen(true)}
                onOpenWorkSettings={() => {
                  if (activeNovel) setWorkSettingsTarget(activeNovel);
                }}
                onOpenPublishModal={() => setPublishOpen(true)}
                onToggleTheme={toggleStudioTheme}
                onToggleSidebar={() => setShowSidebar((v) => !v)}
                onToggleInspector={() => setShowInspector((v) => !v)}
                onToggleRuler={() => setShowRuler((v) => !v)}
                onChangeMarginPreset={(preset) => {
                  if (!activeChapter) return;
                  updateChapterLocalAndQueueSave(activeChapter.id, (prev) => ({
                    ...prev,
                    draftMetadata: {
                      ...prev.draftMetadata,
                      marginPreset: preset,
                    },
                  }));
                }}
                onChangeViewMode={setViewMode}
                onInsertBlock={handleInsertBlock}
                onOpenLinkModal={openLinkModalFromEditor}
                onOpenWordCountModal={() => setWordCountOpen(true)}
                onOpenShortcutsModal={() => setShortcutsOpen(true)}
                onPrint={() => window.print()}
              />

              {!isMobileViewport && (
                <StudioToolbar
                  editor={editor}
                  zoom={zoom}
                  onChangeZoom={setZoom}
                  onPrint={() => window.print()}
                  onOpenLinkModal={openLinkModalFromEditor}
                  onInsertBlock={handleInsertBlock}
                />
              )}

              {autosave.conflict && (
                <ConflictBanner
                  conflict={autosave.conflict}
                  onUseServer={autosave.resolveConflictUseServer}
                  onKeepMine={async () => {
                    const res = await autosave.resolveConflictKeepMine();
                    reportSaveResult(res);
                  }}
                  onDismiss={autosave.dismissConflict}
                />
              )}

              {loadingWorkspace ? (
                <div className="studio-loading-pane">
                  <Loader2 size={22} className="studio-spin" />
                  <span>Memuat naskah karya…</span>
                </div>
              ) : (
                <div className="studio-workspace">
                  {!isMobileViewport && showSidebar && (
                    <StudioSidebar
                      novels={novels}
                      activeNovelId={activeNovelId}
                      chapters={chapters}
                      activeChapterId={activeChapter?.id ?? null}
                      outline={outline}
                      onSelectNovel={(id) => void handleSelectNovel(id)}
                      onOpenNewNovel={() => setNewNovelOpen(true)}
                      onOpenWorkSettings={() => {
                        if (activeNovel) setWorkSettingsTarget(activeNovel);
                      }}
                      onSelectChapter={(id) => void handleSelectChapter(id)}
                      onNewChapter={() => void handleNewChapter()}
                      onDuplicateChapter={(ch) => void handleDuplicateChapter(ch)}
                      onArchiveToggle={(ch) => void handleArchiveToggle(ch)}
                      onRequestDeleteChapter={setDeleteTarget}
                      onReorderChapters={(draggedId, targetId) =>
                        void handleReorderChapters(draggedId, targetId)
                      }
                      onMoveChapterDelta={(id, delta) =>
                        void handleMoveChapterDelta(id, delta)
                      }
                      onJumpToOutlineItem={handleJumpToOutlineItem}
                    />
                  )}

                  <DocumentWorkspaceCanvas
                    editor={editor}
                    chapter={activeChapter}
                    zoom={zoom}
                    showRuler={showRuler}
                    marginPreset={marginPreset}
                    onUpdateHeaderField={(field, value) => {
                      if (!activeChapter) return;
                      updateChapterLocalAndQueueSave(activeChapter.id, (prev) => ({
                        ...prev,
                        [field]: value,
                      }));
                    }}
                  />

                  {!isMobileViewport && showInspector && (
                    <StudioInspectorPanel
                      novelId={activeNovelId}
                      chapter={activeChapter}
                      marginPreset={marginPreset}
                      onChangeMarginPreset={(preset) => {
                        if (!activeChapter) return;
                        updateChapterLocalAndQueueSave(activeChapter.id, (prev) => ({
                          ...prev,
                          draftMetadata: {
                            ...prev.draftMetadata,
                            marginPreset: preset,
                          },
                        }));
                      }}
                      onUpdateChapterPatch={(patch) => {
                        if (!activeChapter) return;
                        updateChapterLocalAndQueueSave(activeChapter.id, (prev) => ({
                          ...prev,
                          ...patch,
                        }));
                      }}
                      onRestoreRevision={(rev) => void handleRestoreRevision(rev)}
                      onOpenPublishModal={() => setPublishOpen(true)}
                      onToggleArchive={(ch) => void handleArchiveToggle(ch)}
                      onInsertAssetToEditor={handleInsertAsset}
                    />
                  )}
                </div>
              )}

              <SlashCommandMenu
                editor={editor}
                onInsertBlock={handleInsertBlock}
                keyDownHandlerRef={slashKeyDownRef}
              />

              {isMobileViewport ? (
                <StudioMobileDock
                  activeSheet={mobileSheet}
                  saveState={autosave.saveState}
                  hasChapter={Boolean(activeChapter)}
                  onToggleSheet={toggleMobileSheet}
                  onManualSave={() => void handleManualSave()}
                />
              ) : (
                <footer className="studio-status-bar">
                  <div className="studio-status-left">
                    <span className="tabular-nums">
                      {metrics.wordCount.toLocaleString('id-ID')} kata
                    </span>
                    <span className="studio-sep-dot" aria-hidden="true">
                      ·
                    </span>
                    <span className="tabular-nums">
                      {metrics.characterCount.toLocaleString('id-ID')} karakter
                    </span>
                    <span className="studio-sep-dot" aria-hidden="true">
                      ·
                    </span>
                    <span className="tabular-nums">{metrics.pageCount} halaman</span>
                  </div>
                  <div className="studio-status-right">
                    <span>{auth.adminProfile?.email}</span>
                    <span className="studio-sep-dot" aria-hidden="true">
                      ·
                    </span>
                    <span className="tabular-nums">{saveStatusText}</span>
                  </div>
                </footer>
              )}

              {isMobileViewport && mobileSheet && (
                <div
                  className="studio-mobile-sheet-backdrop"
                  onClick={() => setMobileSheet(null)}
                >
                  <div
                    className="studio-mobile-sheet"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {mobileSheet === 'chapters' && (
                      <div className="studio-mobile-sheet-panel">
                        <div className="studio-mobile-sheet-head">
                          <h3>Bab &amp; Kerangka Naskah</h3>
                          <button
                            type="button"
                            className="studio-icon-btn studio-mobile-close-btn"
                            aria-label="Tutup daftar bab"
                            onClick={() => setMobileSheet(null)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <StudioSidebar
                          novels={novels}
                          activeNovelId={activeNovelId}
                          chapters={chapters}
                          activeChapterId={activeChapter?.id ?? null}
                          outline={outline}
                          onSelectNovel={(id) => void handleSelectNovel(id)}
                          onOpenNewNovel={() => {
                            setMobileSheet(null);
                            setNewNovelOpen(true);
                          }}
                          onOpenWorkSettings={() => {
                            setMobileSheet(null);
                            if (activeNovel) setWorkSettingsTarget(activeNovel);
                          }}
                          onSelectChapter={(id) => void handleSelectChapter(id)}
                          onNewChapter={() => void handleNewChapter()}
                          onDuplicateChapter={(ch) => void handleDuplicateChapter(ch)}
                          onArchiveToggle={(ch) => void handleArchiveToggle(ch)}
                          onRequestDeleteChapter={(ch) => {
                            setMobileSheet(null);
                            setDeleteTarget(ch);
                          }}
                          onReorderChapters={(draggedId, targetId) =>
                            void handleReorderChapters(draggedId, targetId)
                          }
                          onMoveChapterDelta={(id, delta) =>
                            void handleMoveChapterDelta(id, delta)
                          }
                          onJumpToOutlineItem={handleJumpToOutlineItem}
                        />
                      </div>
                    )}

                    {mobileSheet === 'format' && (
                      <StudioMobileFormatSheet
                        editor={editor}
                        onInsertBlock={handleInsertBlock}
                        onClose={() => setMobileSheet(null)}
                      />
                    )}

                    {mobileSheet === 'inspector' && (
                      <div className="studio-mobile-sheet-panel">
                        <div className="studio-mobile-sheet-head">
                          <h3>Pengaturan Bab, Audio &amp; VFX</h3>
                          <button
                            type="button"
                            className="studio-icon-btn studio-mobile-close-btn"
                            aria-label="Tutup pengaturan bab"
                            onClick={() => setMobileSheet(null)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <StudioInspectorPanel
                          novelId={activeNovelId}
                          chapter={activeChapter}
                          marginPreset={marginPreset}
                          onChangeMarginPreset={(preset) => {
                            if (!activeChapter) return;
                            updateChapterLocalAndQueueSave(
                              activeChapter.id,
                              (prev) => ({
                                ...prev,
                                draftMetadata: {
                                  ...prev.draftMetadata,
                                  marginPreset: preset,
                                },
                              }),
                            );
                          }}
                          onUpdateChapterPatch={(patch) => {
                            if (!activeChapter) return;
                            updateChapterLocalAndQueueSave(
                              activeChapter.id,
                              (prev) => ({
                                ...prev,
                                ...patch,
                              }),
                            );
                          }}
                          onRestoreRevision={(rev) =>
                            void handleRestoreRevision(rev)
                          }
                          onOpenPublishModal={() => {
                            setMobileSheet(null);
                            setPublishOpen(true);
                          }}
                          onToggleArchive={(ch) => void handleArchiveToggle(ch)}
                          onInsertAssetToEditor={handleInsertAsset}
                        />
                      </div>
                    )}

                    {mobileSheet === 'more' && (
                      <StudioMobileMoreSheet
                        activeNovel={activeNovel}
                        studioTheme={studioTheme}
                        hasChapter={Boolean(activeChapter)}
                        wordCount={metrics.wordCount}
                        onPublish={() => setPublishOpen(true)}
                        onPreview={() => setViewMode('preview-chapter')}
                        onFindReplace={() => setFindOpen(true)}
                        onRefreshFromServer={() =>
                          void handleManualRefreshFromServer()
                        }
                        onOpenWorkSettings={() => {
                          if (activeNovel) setWorkSettingsTarget(activeNovel);
                        }}
                        onOpenWordCount={() => setWordCountOpen(true)}
                        onOpenShortcuts={() => setShortcutsOpen(true)}
                        onToggleTheme={toggleStudioTheme}
                        onBackToHub={() => void handleBackToHub()}
                        onSignOut={() => void auth.signOut()}
                        onClose={() => setMobileSheet(null)}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            activeChapter && (
              <StudioLivePreview
                mode={viewMode}
                chapters={chapters}
                activeChapter={activeChapter}
                initialTheme={studioTheme}
                onExitPreview={() => setViewMode('editor')}
                onChangeMode={setViewMode}
              />
            )
          )}

          {/* Test VFX overlay for Editor mode (Live Preview mounts its own isolated layer) */}
          {viewMode === 'editor' && testVfx && (
            <VisualEffectsLayer
              chapterId={`studio-vfx-${testVfx.key}`}
              effect={testVfx.effect}
              triggerMode="immediate"
              durationMs={testVfx.durationMs}
            />
          )}
        </div>
      )}

      {notice && (
        <div className="studio-toast" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <PublishModal
        open={publishOpen}
        chapter={activeChapter}
        publishing={publishing}
        onConfirmPublish={handleConfirmPublish}
        onClose={() => setPublishOpen(false)}
      />

      <DeleteChapterModal
        chapter={deleteTarget}
        deleting={deleting}
        onConfirmDelete={handleConfirmDeleteChapter}
        onClose={() => setDeleteTarget(null)}
      />

      <NewWorkModal
        open={newNovelOpen}
        busy={creatingNovel}
        onCreateWork={handleCreateWork}
        onClose={() => setNewNovelOpen(false)}
      />

      <WorkSettingsModal
        open={Boolean(workSettingsTarget)}
        novel={workSettingsTarget}
        busy={savingWorkSettings}
        onSaveWork={handleSaveWorkSettings}
        onDeleteWork={handleDeleteWork}
        onClose={() => setWorkSettingsTarget(null)}
      />

      <InsertLinkModal
        open={linkModalOpen}
        initialHref={linkInitialHref}
        onApplyLink={(href) => {
          editor?.chain().focus().setLink({ href }).run();
          setLinkModalOpen(false);
        }}
        onRemoveLink={() => {
          editor?.chain().focus().unsetLink().run();
          setLinkModalOpen(false);
        }}
        onClose={() => setLinkModalOpen(false)}
      />

      <WordCountModal
        open={wordCountOpen}
        metrics={metrics}
        onClose={() => setWordCountOpen(false)}
      />

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}

export default NovelStudioPage;
