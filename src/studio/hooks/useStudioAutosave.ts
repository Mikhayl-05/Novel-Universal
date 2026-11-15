import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearLocalDraftBackup,
  loadLocalDraftBackup,
  saveLocalDraftBackup,
} from '../services/indexedDbDraftStore';
import {
  createChapterRevision,
  saveChapterDraftWithConcurrency,
  type SaveDraftPatch,
} from '../services/studioRepository';
import type {
  ConflictPayload,
  FlushSaveResult,
  SaveState,
  StudioChapter,
} from '../types/studio';
import {
  detectVersionConflict,
  hasLocalBackupChanges,
  shouldClearPendingSave,
} from '../utils/chapterOrdering';

interface UseStudioAutosaveOptions {
  novelId: string | null;
  activeChapter: StudioChapter | null;
  onChapterSynced: (
    chapter: StudioChapter,
    preserveNewerLocalEdits: boolean,
    forceReloadEditor?: boolean,
  ) => void;
  onRecoverLocalBackup?: (
    chapterId: string,
    patch: SaveDraftPatch,
    baseUpdatedAt: string,
  ) => void;
}

export interface UseStudioAutosaveResult {
  saveState: SaveState;
  lastSavedAt: number | null;
  saveError: string | null;
  conflict: ConflictPayload | null;
  pendingBackup: boolean;
  hasPendingChanges: boolean;
  scheduleSave: (chapterId: string, baseVersion: number, patch: SaveDraftPatch) => void;
  flushSave: (forceOverwrite?: boolean) => Promise<FlushSaveResult>;
  resolveConflictUseServer: () => Promise<void>;
  resolveConflictKeepMine: () => Promise<FlushSaveResult>;
  dismissConflict: () => void;
}

const DEBOUNCE_MS = 1000;
const AUTO_REVISION_INTERVAL_MS = 5 * 60 * 1000;

export function useStudioAutosave({
  novelId,
  activeChapter,
  onChapterSynced,
  onRecoverLocalBackup,
}: UseStudioAutosaveOptions): UseStudioAutosaveResult {
  const [saveState, setSaveState] = useState<SaveState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'saved',
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictPayload | null>(null);
  const [pendingBackup, setPendingBackup] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const lastRevisionAtRef = useRef<Record<string, number>>({});
  const inFlightPromiseRef = useRef<Promise<FlushSaveResult> | null>(null);
  const editSeqRef = useRef(0);

  const latestServerVersionRef = useRef<
    Record<string, { version: number; updatedAt: string }>
  >({});

  const pendingPayloadRef = useRef<{
    chapterId: string;
    baseVersion: number;
    baseUpdatedAt: string;
    patch: SaveDraftPatch;
    seq: number;
  } | null>(null);

  const activeChapterRef = useRef(activeChapter);
  activeChapterRef.current = activeChapter;
  const onRecoverLocalBackupRef = useRef(onRecoverLocalBackup);
  onRecoverLocalBackupRef.current = onRecoverLocalBackup;

  useEffect(() => {
    if (!activeChapter) return;
    const known = latestServerVersionRef.current[activeChapter.id];
    if (!known || activeChapter.draftVersion > known.version) {
      latestServerVersionRef.current[activeChapter.id] = {
        version: activeChapter.draftVersion,
        updatedAt: activeChapter.updatedAt,
      };
    }
  }, [activeChapter?.id, activeChapter?.draftVersion, activeChapter?.updatedAt]);

  const commitToSupabase = useCallback(
    async (
      chapterId: string,
      baseVersion: number,
      patch: SaveDraftPatch,
      forceOverwrite = false,
      dispatchedSeq = editSeqRef.current,
    ): Promise<FlushSaveResult> => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSaveState('offline');
        setPendingBackup(true);
        return {
          status: 'offline',
          chapter: null,
          message: 'Perangkat sedang offline. Perubahan diamankan secara lokal.',
        };
      }

      if (inFlightPromiseRef.current) {
        return inFlightPromiseRef.current;
      }

      const knownServer = latestServerVersionRef.current[chapterId];
      const resolvedBaseVersion =
        knownServer && knownServer.version > baseVersion
          ? knownServer.version
          : baseVersion;

      const run = (async (): Promise<FlushSaveResult> => {
        setSaveState('syncing');
        setSaveError(null);

        let hadConflict = false;
        let shouldFollowUp = false;

        try {
          const result = await saveChapterDraftWithConcurrency(
            chapterId,
            resolvedBaseVersion,
            patch,
            forceOverwrite,
          );

          if (result.kind === 'conflict') {
            hadConflict = true;
            latestServerVersionRef.current[chapterId] = {
              version: result.serverChapter.draftVersion,
              updatedAt: result.serverChapter.updatedAt,
            };
            setSaveState('conflict');
            setConflict({
              chapterId,
              localVersion: resolvedBaseVersion,
              serverVersion: result.serverChapter.draftVersion,
              serverUpdatedAt: result.serverChapter.updatedAt,
              serverChapter: result.serverChapter,
            });
            return {
              status: 'conflict',
              chapter: result.serverChapter,
              message: 'Konflik versi terdeteksi dengan salinan terbaru di Supabase.',
            };
          }

          retryCountRef.current = 0;
          latestServerVersionRef.current[chapterId] = {
            version: result.chapter.draftVersion,
            updatedAt: result.chapter.updatedAt,
          };

          const canClear = shouldClearPendingSave(dispatchedSeq, editSeqRef.current);

          if (canClear) {
            pendingPayloadRef.current = null;
            setConflict(null);
            setPendingBackup(false);
            setSaveState('saved');
            setLastSavedAt(Date.now());
            await clearLocalDraftBackup(chapterId);
            onChapterSynced(result.chapter, false, false);
          } else {
            if (
              pendingPayloadRef.current &&
              pendingPayloadRef.current.chapterId === chapterId
            ) {
              pendingPayloadRef.current = {
                ...pendingPayloadRef.current,
                baseVersion: result.chapter.draftVersion,
                baseUpdatedAt: result.chapter.updatedAt,
              };
              shouldFollowUp = true;
            }
            setConflict(null);
            setSaveState('saving');
            setLastSavedAt(Date.now());
            onChapterSynced(result.chapter, true, false);
          }

          const now = Date.now();
          const prevRevTime = lastRevisionAtRef.current[chapterId] ?? 0;
          if (now - prevRevTime >= AUTO_REVISION_INTERVAL_MS) {
            lastRevisionAtRef.current[chapterId] = now;
            void createChapterRevision(result.chapter, 'autosave').catch(() => {
              // Non-blocking snapshot failure
            });
          }

          return {
            status: 'saved',
            chapter: result.chapter,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Gagal menyinkronkan ke cloud.';
          setSaveError(msg);
          const isOffline =
            typeof navigator !== 'undefined' && !navigator.onLine;
          setSaveState(isOffline ? 'offline' : 'error');

          if (retryCountRef.current < 3 && !isOffline) {
            retryCountRef.current += 1;
            const backoffMs = 1500 * Math.pow(2, retryCountRef.current - 1);
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => {
              const latest = pendingPayloadRef.current;
              if (latest && latest.chapterId === chapterId) {
                void commitToSupabase(
                  latest.chapterId,
                  latest.baseVersion,
                  latest.patch,
                  false,
                  latest.seq,
                );
              }
            }, backoffMs);
          }

          return {
            status: isOffline ? 'offline' : 'error',
            chapter: null,
            message: msg,
          };
        } finally {
          inFlightPromiseRef.current = null;

          if (
            shouldFollowUp &&
            !hadConflict &&
            pendingPayloadRef.current &&
            pendingPayloadRef.current.chapterId === chapterId
          ) {
            if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
            followUpTimerRef.current = setTimeout(() => {
              const nextQueued = pendingPayloadRef.current;
              if (nextQueued && nextQueued.chapterId === chapterId) {
                void commitToSupabase(
                  nextQueued.chapterId,
                  nextQueued.baseVersion,
                  nextQueued.patch,
                  false,
                  nextQueued.seq,
                );
              }
            }, 140);
          }
        }
      })();

      inFlightPromiseRef.current = run;
      return run;
    },
    [onChapterSynced],
  );

  const scheduleSave = useCallback(
    (chapterId: string, baseVersion: number, patch: SaveDraftPatch) => {
      const current = activeChapterRef.current;
      const knownServer = latestServerVersionRef.current[chapterId];
      const effectiveBaseVersion =
        knownServer && knownServer.version > baseVersion
          ? knownServer.version
          : baseVersion;
      const baseUpdatedAt =
        knownServer?.updatedAt ??
        current?.updatedAt ??
        new Date().toISOString();

      editSeqRef.current += 1;
      const seq = editSeqRef.current;

      pendingPayloadRef.current = {
        chapterId,
        baseVersion: effectiveBaseVersion,
        baseUpdatedAt,
        patch,
        seq,
      };

      setSaveState(
        typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'saving',
      );
      setSaveError(null);
      setPendingBackup(true);

      // Immediate IndexedDB/localStorage crash-safe backup
      void saveLocalDraftBackup({
        chapterId,
        novelId: novelId ?? current?.novelId ?? '',
        baseVersion: effectiveBaseVersion,
        baseUpdatedAt,
        dirty: true,
        savedAt: Date.now(),
        patch,
      });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const queued = pendingPayloadRef.current;
        if (!queued || queued.chapterId !== chapterId) return;
        void commitToSupabase(
          queued.chapterId,
          queued.baseVersion,
          queued.patch,
          false,
          queued.seq,
        );
      }, DEBOUNCE_MS);
    },
    [commitToSupabase, novelId],
  );

  const flushSave = useCallback(
    async (forceOverwrite = false): Promise<FlushSaveResult> => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (followUpTimerRef.current) {
        clearTimeout(followUpTimerRef.current);
        followUpTimerRef.current = null;
      }

      // If an autosave request is currently in-flight, wait for it to finish cleanly
      // so any newer keystrokes entered while it was running are flushed next.
      if (inFlightPromiseRef.current) {
        try {
          const prevResult = await inFlightPromiseRef.current;
          if (!pendingPayloadRef.current) {
            return prevResult;
          }
        } catch {
          // Continue to evaluate pending payload below
        }
      }

      let lastResult: FlushSaveResult = {
        status: 'noop',
        chapter: activeChapterRef.current,
        message: 'Semua perubahan sudah tersimpan di Supabase.',
      };

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const queued = pendingPayloadRef.current;
        if (!queued) break;

        lastResult = await commitToSupabase(
          queued.chapterId,
          queued.baseVersion,
          queued.patch,
          forceOverwrite,
          queued.seq,
        );

        if (lastResult.status !== 'saved') {
          return lastResult;
        }
        if (!pendingPayloadRef.current) {
          return lastResult;
        }
      }

      return lastResult;
    },
    [commitToSupabase],
  );

  // Check if local IndexedDB has an unsynced backup when opening a chapter
  useEffect(() => {
    if (!activeChapter) return;
    let cancelled = false;
    void loadLocalDraftBackup(activeChapter.id).then(async (backup) => {
      if (cancelled || !backup || !backup.dirty) {
        if (!cancelled && !pendingPayloadRef.current) {
          setPendingBackup(false);
        }
        return;
      }

      const hasConflict = detectVersionConflict({
        localBaseVersion: backup.baseVersion,
        localBaseUpdatedAt: backup.baseUpdatedAt,
        serverVersion: activeChapter.draftVersion,
        serverUpdatedAt: activeChapter.updatedAt,
      });

      if (hasConflict) {
        setPendingBackup(true);
        editSeqRef.current += 1;
        pendingPayloadRef.current = {
          chapterId: activeChapter.id,
          baseVersion: backup.baseVersion,
          baseUpdatedAt: backup.baseUpdatedAt,
          patch: backup.patch,
          seq: editSeqRef.current,
        };
        setConflict({
          chapterId: activeChapter.id,
          localVersion: backup.baseVersion,
          serverVersion: activeChapter.draftVersion,
          serverUpdatedAt: activeChapter.updatedAt,
          serverChapter: activeChapter,
        });
        setSaveState('conflict');
        return;
      }

      // No version conflict, check whether the local backup differs from server draft
      if (!hasLocalBackupChanges(activeChapter, backup.patch)) {
        await clearLocalDraftBackup(activeChapter.id);
        if (!cancelled) setPendingBackup(false);
        return;
      }

      // Restore unsynced local changes into editor and immediately upload to Supabase
      setPendingBackup(true);
      onRecoverLocalBackupRef.current?.(
        activeChapter.id,
        backup.patch,
        backup.baseUpdatedAt,
      );
      editSeqRef.current += 1;
      const seq = editSeqRef.current;
      pendingPayloadRef.current = {
        chapterId: activeChapter.id,
        baseVersion: activeChapter.draftVersion,
        baseUpdatedAt: activeChapter.updatedAt,
        patch: backup.patch,
        seq,
      };
      void commitToSupabase(
        activeChapter.id,
        activeChapter.draftVersion,
        backup.patch,
        false,
        seq,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [activeChapter?.id, commitToSupabase]);

  // Online / Offline reconnection auto-sync (no Realtime background overwrite)
  useEffect(() => {
    const handleOnline = () => {
      const queued = pendingPayloadRef.current;
      if (queued) {
        void commitToSupabase(
          queued.chapterId,
          queued.baseVersion,
          queued.patch,
          false,
          queued.seq,
        );
      } else {
        setSaveState('saved');
      }
    };
    const handleOffline = () => {
      setSaveState('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [commitToSupabase]);

  // Warn before unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingPayloadRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const resolveConflictUseServer = useCallback(async () => {
    if (!conflict) return;
    pendingPayloadRef.current = null;
    await clearLocalDraftBackup(conflict.chapterId);
    onChapterSynced(conflict.serverChapter, false, true);
    setConflict(null);
    setPendingBackup(false);
    setSaveState('saved');
  }, [conflict, onChapterSynced]);

  const resolveConflictKeepMine = useCallback(async (): Promise<FlushSaveResult> => {
    return flushSave(true);
  }, [flushSave]);

  const dismissConflict = useCallback(() => {
    setConflict(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
    };
  }, []);

  return {
    saveState,
    lastSavedAt,
    saveError,
    conflict,
    pendingBackup,
    hasPendingChanges: Boolean(pendingPayloadRef.current),
    scheduleSave,
    flushSave,
    resolveConflictUseServer,
    resolveConflictKeepMine,
    dismissConflict,
  };
}
