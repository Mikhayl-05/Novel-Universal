import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { audioManager } from '../services/audioManager';
import {
  loadWorkReaderState,
  saveCurrentChapterProgress,
} from '../services/storageService';
import type { PublishedReaderChapter } from '../studio/services/studioRepository';
import type { ChapterId } from '../types/novel';
import { ChapterHtmlCache } from '../utils/chapterCache';
import { vibrate } from '../utils/haptics';

export type ChapterTransitionPhase = 'idle' | 'fade-out' | 'fade-in';

interface UseChapterNavigationParams {
  workSlug: string;
  chapters: PublishedReaderChapter[];
  storyOpened: boolean;
  focusMode: boolean;
  onCloseModals: () => void;
}

export function useChapterNavigation({
  workSlug,
  chapters,
  storyOpened,
  focusMode,
  onCloseModals,
}: UseChapterNavigationParams) {
  const { chapterId: routeChapterId } = useParams<{ chapterId?: string }>();
  const navigate = useNavigate();

  const chapterListRef = useRef(chapters);
  chapterListRef.current = chapters;

  const findChapterById = useCallback(
    (id: string | undefined) =>
      id ? chapterListRef.current.find((c) => c.id === id) : undefined,
    [],
  );

  const findChapterIndexById = useCallback(
    (id: string) => chapterListRef.current.findIndex((c) => c.id === id),
    [],
  );

  const savedProgressId = useMemo(
    () => loadWorkReaderState(workSlug).currentChapterId,
    [workSlug],
  );

  const resolvedInitialId = useMemo(() => {
    if (chapters.length === 0) return '';
    if (routeChapterId && chapters.find((c) => c.id === routeChapterId)) {
      return routeChapterId;
    }
    if (savedProgressId && chapters.find((c) => c.id === savedProgressId)) {
      return savedProgressId;
    }
    return chapters[0].id;
  }, [chapters, routeChapterId, savedProgressId]);

  const [activeChapterId, setActiveChapterId] =
    useState<ChapterId>(resolvedInitialId);
  const [displayedChapterId, setDisplayedChapterId] =
    useState<ChapterId>(resolvedInitialId);
  const [transitionPhase, setTransitionPhase] =
    useState<ChapterTransitionPhase>('idle');
  const [subtitleTransitioning, setSubtitleTransitioning] = useState(false);
  const [endingCinematicOpen, setEndingCinematicOpen] = useState(false);

  const chapterCacheRef = useRef<ChapterHtmlCache>(new ChapterHtmlCache());
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEndingCallbackRef = useRef<(() => void) | null>(null);
  const activeChapterIdRef = useRef<ChapterId>(activeChapterId);
  activeChapterIdRef.current = activeChapterId;
  const storyOpenedRef = useRef(storyOpened);
  storyOpenedRef.current = storyOpened;

  useEffect(() => {
    chapterCacheRef.current.clear();
  }, [chapters]);

  // Reset active/displayed chapters when work or loaded chapters settle
  useEffect(() => {
    if (!resolvedInitialId) return;
    if (!chapters.some((c) => c.id === activeChapterIdRef.current)) {
      setActiveChapterId(resolvedInitialId);
      setDisplayedChapterId(resolvedInitialId);
    }
  }, [chapters, resolvedInitialId]);

  const activeChapter: PublishedReaderChapter | null = useMemo(
    () => chapters.find((c) => c.id === activeChapterId) ?? chapters[0] ?? null,
    [activeChapterId, chapters],
  );

  const displayedChapter: PublishedReaderChapter | null = useMemo(
    () => chapters.find((c) => c.id === displayedChapterId) ?? chapters[0] ?? null,
    [displayedChapterId, chapters],
  );

  const activeIndex = useMemo(() => {
    if (!activeChapter) return 0;
    return Math.max(0, chapters.findIndex((c) => c.id === activeChapter.id));
  }, [activeChapter, chapters]);

  const displayedIndex = useMemo(() => {
    if (!displayedChapter) return 0;
    return Math.max(0, chapters.findIndex((c) => c.id === displayedChapter.id));
  }, [displayedChapter, chapters]);

  const displayedChapterHtml = useMemo(
    () => (displayedChapter ? chapterCacheRef.current.get(displayedChapter) : ''),
    [displayedChapter],
  );

  const preloadAdjacent = useCallback((idx: number) => {
    const list = chapterListRef.current;
    if (list.length === 0) return;
    const cache = chapterCacheRef.current;
    const keepIds: ChapterId[] = [];
    for (const nIdx of [idx - 1, idx, idx + 1]) {
      if (nIdx >= 0 && nIdx < list.length) {
        keepIds.push(list[nIdx].id);
      }
    }
    cache.prune(keepIds);

    for (const nIdx of [idx - 1, idx + 1]) {
      if (nIdx < 0 || nIdx >= list.length) continue;
      const neighbor = list[nIdx];
      // Preload BGM track immediately so chapter transitions have zero audio delay
      audioManager.preloadChapterBgm(neighbor);
      if (cache.has(neighbor.id)) continue;
      const doPreload = () => cache.preload(neighbor);
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(doPreload, { timeout: 1200 });
      } else {
        setTimeout(doPreload, 250);
      }
    }
  }, []);

  // Preload neighbors & save current progress on display change
  useEffect(() => {
    if (!displayedChapter || !workSlug) return;
    saveCurrentChapterProgress(workSlug, displayedChapter.id);
    preloadAdjacent(displayedIndex);
  }, [displayedChapter, displayedIndex, preloadAdjacent, workSlug]);

  const executeChapterTransition = useCallback(
    (targetChapter: PublishedReaderChapter, onComplete?: () => void) => {
      if (fadeOutTimerRef.current !== null) {
        clearTimeout(fadeOutTimerRef.current);
      }
      if (fadeInTimerRef.current !== null) {
        clearTimeout(fadeInTimerRef.current);
      }

      if (storyOpenedRef.current) {
        const targetAudio = targetChapter.bgm || 'default';
        audioManager.play(targetAudio, {
          bgmUrl: targetChapter.bgmUrl,
          volume: targetChapter.bgmVolume,
          loop: targetChapter.bgmLoop,
        });
      }

      setTransitionPhase('fade-out');
      setSubtitleTransitioning(true);

      fadeOutTimerRef.current = setTimeout(() => {
        setDisplayedChapterId(targetChapter.id);
        setSubtitleTransitioning(false);
        setTransitionPhase('fade-in');

        fadeInTimerRef.current = setTimeout(() => {
          setTransitionPhase('idle');
        }, 420);

        if (typeof onComplete === 'function') {
          onComplete();
        }
      }, 200);
    },
    [],
  );

  const goToChapter = useCallback(
    (targetId: ChapterId, onComplete?: () => void) => {
      const targetChapter = findChapterById(targetId);
      if (!targetChapter) return;

      setActiveChapterId(targetChapter.id);
      if (workSlug && routeChapterId !== targetChapter.id) {
        navigate(`/read/${workSlug}/${targetChapter.id}`);
      }

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      if (targetChapter.isEnding && storyOpened) {
        pendingEndingCallbackRef.current = () => {
          executeChapterTransition(targetChapter, onComplete);
        };
        setEndingCinematicOpen(true);
        return;
      }

      executeChapterTransition(targetChapter, onComplete);
    },
    [
      executeChapterTransition,
      findChapterById,
      navigate,
      routeChapterId,
      storyOpened,
      workSlug,
    ],
  );

  const completeEndingCinematic = useCallback(() => {
    setEndingCinematicOpen(false);
    const cb = pendingEndingCallbackRef.current;
    pendingEndingCallbackRef.current = null;
    if (cb) cb();
  }, []);

  const goToIndex = useCallback(
    (idx: number, onComplete?: () => void) => {
      const list = chapterListRef.current;
      if (idx < 0 || idx >= list.length) return;
      goToChapter(list[idx].id, onComplete);
    },
    [goToChapter],
  );

  const changeChapter = useCallback(
    (direction: -1 | 1) => {
      const list = chapterListRef.current;
      const currentIdx = findChapterIndexById(activeChapterIdRef.current);
      const targetIdx = currentIdx + direction;
      if (targetIdx >= 0 && targetIdx < list.length) {
        goToIndex(targetIdx);
        vibrate(10);
      }
    },
    [findChapterIndexById, goToIndex],
  );

  // Sync browser back/forward route changes
  useEffect(() => {
    if (chapters.length === 0) return;
    const targetChapter = routeChapterId
      ? findChapterById(routeChapterId)
      : findChapterById(resolvedInitialId);
    if (targetChapter && targetChapter.id !== activeChapterIdRef.current) {
      setActiveChapterId(targetChapter.id);
      executeChapterTransition(targetChapter);
    }
  }, [chapters.length, routeChapterId, resolvedInitialId, executeChapterTransition, findChapterById]);

  // Keyboard navigation (ArrowLeft / ArrowRight / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        onCloseModals();
        return;
      }

      if (isEditable) return;
      if (e.key === 'ArrowLeft') changeChapter(-1);
      if (e.key === 'ArrowRight') changeChapter(1);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [changeChapter, onCloseModals]);

  // Swipe navigation (only active when Focus Mode is ON and touch starts inside <main>)
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let swipeTrackingActive = false;

    const handleTouchStart = (e: TouchEvent) => {
      swipeTrackingActive = false;
      touchStartX = 0;
      touchStartY = 0;
      if (!focusMode) return;
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest || !target.closest('main')) return;
      swipeTrackingActive = true;
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!swipeTrackingActive || !focusMode) {
        swipeTrackingActive = false;
        return;
      }
      if (!e.changedTouches || !e.changedTouches[0]) {
        swipeTrackingActive = false;
        return;
      }
      swipeTrackingActive = false;
      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;
      const threshold = 80;
      const swipeLength = touchEndX - touchStartX;
      const verticalDrift = Math.abs(touchEndY - touchStartY);
      if (Math.abs(swipeLength) > threshold && verticalDrift < 60) {
        changeChapter(swipeLength < 0 ? 1 : -1);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [focusMode, changeChapter]);

  useEffect(() => {
    return () => {
      if (fadeOutTimerRef.current !== null) clearTimeout(fadeOutTimerRef.current);
      if (fadeInTimerRef.current !== null) clearTimeout(fadeInTimerRef.current);
    };
  }, []);

  return {
    activeChapter,
    activeIndex,
    displayedChapter,
    displayedIndex,
    displayedChapterHtml,
    totalChapters: chapters.length,
    transitionPhase,
    subtitleTransitioning,
    endingCinematicOpen,
    completeEndingCinematic,
    goToChapter,
    goToIndex,
    changeChapter,
  };
}
